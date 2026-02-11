/**
 * Paygent API Server
 * REST API layer for the frontend to communicate with the agent
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Paygent } from '../agent';
import { PaygentConfig, loadConfig } from '../config';
import { logger } from '../utils/logger';
import { formatSTX, formatDuration } from '../utils/formatting';
import { PipelineResult, TaskPlan, StepResult, TaskStep } from '../types';
import { OrchestratorEvents } from '../agent/orchestrator';

// Types for API responses
interface WalletResponse {
  address: string;
  balance: string;
  balanceFormatted: string;
  network: 'mainnet' | 'testnet';
}

interface ServiceResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  priceSTX: number;
  tags: string[];
}

interface PipelineStatusResponse {
  id: string;
  query: string;
  status: 'planning' | 'running' | 'complete' | 'failed';
  steps: StepStatusResponse[];
  totalCostSTX: number;
  durationMs: number;
  output?: any;
  error?: string;
}

interface StepStatusResponse {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  costSTX: number;
  txId?: string;
  output?: any;
  error?: string;
}

interface ActivityResponse {
  id: string;
  query: string;
  stepCount: number;
  totalCostSTX: number;
  durationMs: number;
  status: 'success' | 'failed';
  txHashes: string[];
  timestamp: string;
  output?: any;
}

// Store active pipelines with their step states
const activePipelines = new Map<string, {
  status: PipelineStatusResponse;
  promise: Promise<PipelineResult>;
}>();

// WebSocket clients for real-time updates
const wsClients = new Set<WebSocket>();

// Broadcast helper
function broadcastUpdate(event: string, data: any) {
  const message = JSON.stringify({ event, data });
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function createAPIServer(config?: PaygentConfig): { app: express.Application; start: (port?: number) => Promise<Server> } {
  const app = express();
  const paygentConfig = config || loadConfig();
  
  // Current pipeline context for events
  let currentPipelineId: string | null = null;
  let currentSteps: StepStatusResponse[] = [];
  
  // Create orchestrator event handlers that broadcast to WebSocket
  const orchestratorEvents: OrchestratorEvents = {
    onPlanCreated: (plan: TaskPlan) => {
      if (currentPipelineId) {
        // Initialize steps as pending
        currentSteps = plan.steps.map((step, i) => ({
          id: step.id,
          name: step.description.split(':')[0] || `Step ${i + 1}`,
          description: step.description,
          status: 'pending' as const,
          costSTX: Number(step.estimatedCost || 0) / 1_000_000,
        }));
        
        broadcastUpdate('pipeline:planned', {
          pipelineId: currentPipelineId,
          totalSteps: plan.steps.length,
          steps: currentSteps,
          estimatedCost: Number(plan.estimatedTotalCost) / 1_000_000,
        });
        
        // Update pipeline status
        const pipeline = activePipelines.get(currentPipelineId);
        if (pipeline) {
          pipeline.status.steps = currentSteps;
          pipeline.status.status = 'running';
        }
      }
    },
    
    onStepStart: (step: TaskStep, index: number, total: number) => {
      if (currentPipelineId && currentSteps[index]) {
        currentSteps[index].status = 'running';
        
        broadcastUpdate('pipeline:step:started', {
          pipelineId: currentPipelineId,
          stepIndex: index,
          totalSteps: total,
          step: currentSteps[index],
        });
        
        // Update pipeline status
        const pipeline = activePipelines.get(currentPipelineId);
        if (pipeline) {
          pipeline.status.steps = [...currentSteps];
        }
      }
    },
    
    onStepComplete: (step: TaskStep, result: StepResult) => {
      const index = currentSteps.findIndex(s => s.id === step.id);
      if (currentPipelineId && index >= 0) {
        currentSteps[index] = {
          ...currentSteps[index],
          status: 'complete',
          costSTX: result.cost ? Number(result.cost) / 1_000_000 : currentSteps[index].costSTX,
          txId: result.payment?.txId,
          output: result.data,
        };
        
        broadcastUpdate('pipeline:step:completed', {
          pipelineId: currentPipelineId,
          stepIndex: index,
          step: currentSteps[index],
          result: result.data,
        });
        
        // Update pipeline status
        const pipeline = activePipelines.get(currentPipelineId);
        if (pipeline) {
          pipeline.status.steps = [...currentSteps];
          pipeline.status.totalCostSTX = currentSteps.reduce((sum, s) => sum + (s.costSTX || 0), 0);
        }
      }
    },
    
    onStepError: (step: TaskStep, error: string) => {
      const index = currentSteps.findIndex(s => s.id === step.id);
      if (currentPipelineId && index >= 0) {
        currentSteps[index] = {
          ...currentSteps[index],
          status: 'failed',
          error,
        };
        
        broadcastUpdate('pipeline:step:failed', {
          pipelineId: currentPipelineId,
          stepIndex: index,
          step: currentSteps[index],
          error,
        });
        
        // Update pipeline status
        const pipeline = activePipelines.get(currentPipelineId);
        if (pipeline) {
          pipeline.status.steps = [...currentSteps];
        }
      }
    },
  };
  
  const agent = new Paygent(paygentConfig, orchestratorEvents);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // ============ WALLET ENDPOINTS ============

  /**
   * GET /api/wallet
   * Get wallet information
   */
  app.get('/api/wallet', async (_req: Request, res: Response) => {
    try {
      const walletInfo = await agent.getWalletInfo();
      
      const response: WalletResponse = {
        address: walletInfo.address,
        balance: walletInfo.balances.stx.toString(),
        balanceFormatted: formatSTX(walletInfo.balances.stx),
        network: paygentConfig.network,
      };
      
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SERVICES ENDPOINTS ============

  /**
   * GET /api/services
   * Get available x402 services
   */
  app.get('/api/services', async (_req: Request, res: Response) => {
    try {
      const services = await agent.discoverServices();
      
      const response: ServiceResponse[] = services.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category || 'general',
        priceSTX: Number(s.price.amount) / 1_000_000,
        tags: s.tags || [],
      }));
      
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PIPELINE ENDPOINTS ============

  /**
   * POST /api/pipeline/execute
   * Start a new pipeline execution
   */
  app.post('/api/pipeline/execute', async (req: Request, res: Response) => {
    try {
      const { query, budget, maxSteps } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }

      const pipelineId = `pipeline-${Date.now()}`;
      
      // Set current pipeline context for event handlers
      currentPipelineId = pipelineId;
      currentSteps = [];
      
      // Initialize pipeline status
      const status: PipelineStatusResponse = {
        id: pipelineId,
        query,
        status: 'planning',
        steps: [],
        totalCostSTX: 0,
        durationMs: 0,
      };

      activePipelines.set(pipelineId, { status, promise: null as any });

      // Broadcast initial status
      broadcastUpdate('pipeline:started', { 
        pipelineId, 
        query,
        status: 'planning',
      });

      // Return immediately with pipeline ID so frontend can start showing UI
      res.json({ pipelineId, status: 'started' });

      // Start pipeline execution in background
      const promise = agent.executePipeline(query, {
        maxBudget: budget ? BigInt(Math.floor(budget * 1_000_000)) : undefined,
        maxSteps: maxSteps || 5,
      });

      activePipelines.set(pipelineId, { status, promise });

      // Handle pipeline completion
      promise.then(result => {
        const finalStatus: PipelineStatusResponse = {
          id: pipelineId,
          query,
          status: result.success ? 'complete' : 'failed',
          steps: currentSteps.length > 0 ? currentSteps : result.stepResults?.map((sr, i) => ({
            id: sr.stepId,
            name: sr.service?.name || `Step ${i + 1}`,
            description: sr.service?.description || '',
            status: sr.success ? 'complete' : 'failed',
            costSTX: sr.cost ? Number(sr.cost) / 1_000_000 : 0,
            txId: sr.payment?.txId,
            output: sr.data,
            error: sr.error,
          })) || [],
          totalCostSTX: Number(result.totalCost || 0) / 1_000_000,
          durationMs: result.timing?.durationMs || 0,
          output: result.finalOutput,
          error: result.error,
        };

        activePipelines.set(pipelineId, { status: finalStatus, promise });
        broadcastUpdate('pipeline:completed', {
          pipelineId,
          status: finalStatus,
          result: result.finalOutput,
          totalCost: finalStatus.totalCostSTX,
          txIds: currentSteps.filter(s => s.txId).map(s => s.txId),
        });
        
        // Clear current pipeline context
        if (currentPipelineId === pipelineId) {
          currentPipelineId = null;
          currentSteps = [];
        }
      }).catch(error => {
        const errorStatus: PipelineStatusResponse = {
          ...status,
          status: 'failed',
          error: error.message,
        };
        activePipelines.set(pipelineId, { status: errorStatus, promise });
        broadcastUpdate('pipeline:failed', { 
          pipelineId, 
          error: error.message 
        });
        
        // Clear current pipeline context
        if (currentPipelineId === pipelineId) {
          currentPipelineId = null;
          currentSteps = [];
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/pipeline/preview
   * Preview a pipeline plan without executing
   */
  app.post('/api/pipeline/preview', async (req: Request, res: Response) => {
    try {
      const { query, maxSteps } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }

      const plan = await agent.previewPipeline(query, {
        maxSteps: maxSteps || 5,
      });

      if (!plan) {
        return res.status(400).json({ error: 'Could not create plan for this query' });
      }

      const response = {
        query,
        description: plan.description,
        steps: plan.steps.map(s => ({
          id: s.id,
          description: s.description,
          serviceId: s.serviceId,
          costSTX: Number(s.estimatedCost || 0) / 1_000_000,
        })),
        estimatedCostSTX: Number(plan.estimatedTotalCost) / 1_000_000,
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/pipeline/:id
   * Get pipeline status
   */
  app.get('/api/pipeline/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const pipeline = activePipelines.get(id);
    
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    res.json(pipeline.status);
  });

  // ============ HISTORY ENDPOINTS ============

  /**
   * GET /api/history
   * Get execution history
   */
  app.get('/api/history', async (_req: Request, res: Response) => {
    try {
      const history = agent.getHistory(20);
      
      const response: ActivityResponse[] = history.map(h => ({
        id: h.pipelineId,
        query: h.query,
        stepCount: h.stepResults?.length || 0,
        totalCostSTX: Number(h.totalCost || 0) / 1_000_000,
        durationMs: h.timing?.durationMs || 0,
        status: h.success ? 'success' : 'failed',
        txHashes: h.stepResults?.map(sr => sr.payment?.txId).filter(Boolean) as string[] || [],
        timestamp: h.timing?.startedAt?.toISOString() || new Date().toISOString(),
        output: h.finalOutput,
      }));

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/stats
   * Get service usage stats
   */
  app.get('/api/stats', async (_req: Request, res: Response) => {
    try {
      const stats = agent.getServiceStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SIMPLE TASK ENDPOINT ============

  /**
   * POST /api/task
   * Execute a simple single-service task
   */
  app.post('/api/task', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }

      const result = await agent.executeTask(query);
      
      res.json({
        success: result.success,
        service: result.service?.name,
        data: result.data,
        cost: result.payment?.amount ? Number(result.payment.amount) / 1_000_000 : 0,
        txId: result.payment?.txId,
        error: result.error,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ HEALTH CHECK ============

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      network: paygentConfig.network,
      version: '1.0.0',
    });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(`API Error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start server function
  function start(port: number = 3402): Promise<Server> {
    return new Promise((resolve) => {
      const server = app.listen(port, () => {
        logger.info(`Paygent API server running on http://localhost:${port}`);
        
        // Setup WebSocket server
        const wss = new WebSocketServer({ server, path: '/ws' });
        
        wss.on('connection', (ws) => {
          logger.debug('WebSocket client connected');
          wsClients.add(ws);
          
          ws.on('close', () => {
            wsClients.delete(ws);
            logger.debug('WebSocket client disconnected');
          });
          
          ws.on('error', (error) => {
            logger.error(`WebSocket error: ${error.message}`);
            wsClients.delete(ws);
          });
        });

        resolve(server);
      });
    });
  }

  return { app, start };
}

// CLI entry point
if (require.main === module) {
  const { start } = createAPIServer();
  start(3402);
}
