/**
 * Paygent REST API Server
 * HTTP interface for the AI Payment Agent
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig } from './config';
import { Paygent } from './agent';
import { logger } from './utils/logger';
import { formatSTX } from './utils/formatting';

const app = express();
const config = loadConfig();
const agent = new Paygent(config);

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  logger.info('WebSocket client connected');
  
  // Send initial connection message
  ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
  
  ws.on('close', () => {
    clients.delete(ws);
    logger.info('WebSocket client disconnected');
  });
  
  ws.on('error', (err) => {
    logger.error(`WebSocket error: ${err.message}`);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(message: object) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// In-memory history storage
interface HistoryEntry {
  id: string;
  query: string;
  stepCount: number;
  totalCostSTX: number;
  durationMs: number;
  status: 'success' | 'failed';
  txHashes: string[];
  timestamp: string;
  output?: any;
  serviceName?: string;
}

const pipelineHistory: HistoryEntry[] = [];
const MAX_HISTORY = 50;

function addToHistory(entry: HistoryEntry) {
  pipelineHistory.unshift(entry);
  if (pipelineHistory.length > MAX_HISTORY) {
    pipelineHistory.pop();
  }
}

// Multi-step pipeline definitions
interface PipelineStepDef {
  id: string;
  name: string;
  description: string;
  serviceQuery: string;
  outputLabel?: string;
}

interface PipelinePlan {
  steps: PipelineStepDef[];
  description: string;
}

// Known multi-step pipeline patterns
// IMPORTANT: More specific patterns (5-step, 4-step) must come BEFORE less specific (2-step)
function planPipeline(query: string): PipelinePlan {
  const q = query.toLowerCase();
  
  // === 5-STEP PIPELINES (most specific - check first) ===
  
  // Full market intelligence: Price + News + Sentiment + Summary + Report
  if ((q.includes('full') || q.includes('complete') || q.includes('comprehensive')) && 
      (q.includes('market') || q.includes('analysis') || q.includes('intelligence'))) {
    return {
      description: 'Complete market intelligence report',
      steps: [
        { id: 'step-0', name: 'Get BTC Price', description: 'Current market data', serviceQuery: 'Get Bitcoin price', outputLabel: 'price' },
        { id: 'step-1', name: 'Fetch News', description: 'Latest headlines', serviceQuery: 'Get Bitcoin news headlines', outputLabel: 'news' },
        { id: 'step-2', name: 'Analyze Sentiment', description: 'Market sentiment', serviceQuery: 'Analyze sentiment', outputLabel: 'sentiment' },
        { id: 'step-3', name: 'Summarize All', description: 'Combine insights', serviceQuery: 'Summarize this content', outputLabel: 'summary' },
        { id: 'step-4', name: 'Generate Report', description: 'Final report', serviceQuery: 'Generate a market report' },
      ],
    };
  }
  
  // Content creation pipeline: Topic + News + Summarize + Tweet + Report
  if (q.includes('content') && (q.includes('create') || q.includes('make') || q.includes('generate'))) {
    return {
      description: 'Full content creation workflow',
      steps: [
        { id: 'step-0', name: 'Get Price Context', description: 'Market backdrop', serviceQuery: 'Get Bitcoin price', outputLabel: 'context' },
        { id: 'step-1', name: 'Research Topic', description: 'Gather info', serviceQuery: 'Get Bitcoin news headlines', outputLabel: 'research' },
        { id: 'step-2', name: 'Extract Key Points', description: 'Main themes', serviceQuery: 'Summarize this content', outputLabel: 'points' },
        { id: 'step-3', name: 'Write Tweet', description: 'Social post', serviceQuery: 'Generate a tweet about this', outputLabel: 'social' },
        { id: 'step-4', name: 'Draft Report', description: 'Long-form', serviceQuery: 'Generate a market report' },
      ],
    };
  }
  
  // === 4-STEP PIPELINES ===
  
  // Research pipeline: News + Summarize + Sentiment + Tweet
  if ((q.includes('research') || q.includes('investigate')) && 
      (q.includes('bitcoin') || q.includes('crypto') || q.includes('btc') || q.includes('publish') || q.includes('findings'))) {
    return {
      description: 'Research and publish findings',
      steps: [
        { id: 'step-0', name: 'Gather News', description: 'Research sources', serviceQuery: 'Get Bitcoin news headlines', outputLabel: 'sources' },
        { id: 'step-1', name: 'Summarize Findings', description: 'Key insights', serviceQuery: 'Summarize this content', outputLabel: 'insights' },
        { id: 'step-2', name: 'Sentiment Check', description: 'Market mood', serviceQuery: 'Analyze sentiment', outputLabel: 'mood' },
        { id: 'step-3', name: 'Create Thread', description: 'Twitter thread', serviceQuery: 'Generate a tweet about this' },
      ],
    };
  }
  
  // === 3-STEP PIPELINES ===
  
  // News + Summarize + Tweet pattern
  if ((q.includes('news') || q.includes('headlines')) && 
      (q.includes('summarize') || q.includes('summary')) && 
      (q.includes('tweet') || q.includes('twitter') || q.includes('post'))) {
    return {
      description: 'Fetch news, summarize, and create tweet',
      steps: [
        { id: 'step-0', name: 'Fetch Headlines', description: 'Get latest news', serviceQuery: 'Get Bitcoin news headlines', outputLabel: 'headlines' },
        { id: 'step-1', name: 'Summarize News', description: 'AI summarization', serviceQuery: 'Summarize the news', outputLabel: 'summary' },
        { id: 'step-2', name: 'Compose Tweet', description: 'Generate tweet', serviceQuery: 'Generate a tweet about this' },
      ],
    };
  }
  
  // === 2-STEP PIPELINES (least specific - check last) ===
  
  // News + Summarize pattern
  if ((q.includes('news') || q.includes('headlines')) && 
      (q.includes('summarize') || q.includes('summary'))) {
    return {
      description: 'Fetch news and summarize',
      steps: [
        { id: 'step-0', name: 'Fetch Headlines', description: 'Get latest news', serviceQuery: q.includes('bitcoin') || q.includes('btc') ? 'Get Bitcoin news' : 'Get Stacks news', outputLabel: 'headlines' },
        { id: 'step-1', name: 'Summarize Content', description: 'AI summarization', serviceQuery: 'Summarize this content' },
      ],
    };
  }
  
  // Price + Report pattern
  if ((q.includes('price') || q.includes('market')) && 
      (q.includes('report') || q.includes('analysis'))) {
    return {
      description: 'Get price data and generate report',
      steps: [
        { id: 'step-0', name: 'Get Price Data', description: 'Fetch market data', serviceQuery: q.includes('stx') || q.includes('stacks') ? 'Get STX price' : 'Get Bitcoin price', outputLabel: 'data' },
        { id: 'step-1', name: 'Generate Report', description: 'Create analysis', serviceQuery: 'Generate a market report' },
      ],
    };
  }
  
  // News + Tweet pattern  
  if ((q.includes('news') || q.includes('headlines')) && 
      (q.includes('tweet') || q.includes('twitter'))) {
    return {
      description: 'Fetch news and create tweet',
      steps: [
        { id: 'step-0', name: 'Fetch Headlines', description: 'Get latest news', serviceQuery: 'Get Bitcoin news headlines', outputLabel: 'headlines' },
        { id: 'step-1', name: 'Compose Tweet', description: 'Generate tweet', serviceQuery: 'Generate a tweet' },
      ],
    };
  }
  
  // Single step (default)
  return {
    description: 'Execute single task',
    steps: [
      { id: 'step-0', name: 'Execute Task', description: query, serviceQuery: query },
    ],
  };
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'paygent',
    version: '1.0.0',
    network: agent.getNetwork(),
    address: agent.getAddress(),
  });
});

/**
 * POST /task
 * Execute a task and pay for the best service
 * 
 * Body: { query: string, maxBudget?: number, preferredAsset?: string }
 */
app.post('/task', async (req: Request, res: Response) => {
  try {
    const { query, maxBudget, preferredAsset } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    const result = await agent.executeTask(query, {
      maxBudget: maxBudget ? BigInt(Math.floor(maxBudget * 1_000_000)) : undefined,
      preferredAsset,
    });

    // Convert BigInt to string for JSON serialization
    const response = {
      ...result,
      payment: result.payment ? {
        ...result.payment,
        amount: result.payment.amount?.toString(),
      } : undefined,
    };

    res.json(response);
  } catch (error: any) {
    logger.error(`Task error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /preview
 * Preview what a task would cost without executing
 * 
 * Body: { query: string }
 */
app.post('/preview', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    const preview = await agent.previewTask(query);

    res.json({
      success: true,
      data: {
        serviceCount: preview.services.length,
        recommended: preview.recommended ? {
          id: preview.recommended.id,
          name: preview.recommended.name,
          description: preview.recommended.description,
          price: preview.recommended.price,
        } : null,
        estimatedCost: preview.estimatedCost,
        canAfford: preview.canAfford,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /services
 * List available x402 services
 */
app.get('/services', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string | undefined;
    const services = await agent.discoverServices(query);

    res.json({
      success: true,
      count: services.length,
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        url: s.url,
        price: s.price,
        category: s.category,
        tags: s.tags,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /wallet
 * Get wallet information
 */
app.get('/wallet', async (req: Request, res: Response) => {
  try {
    const info = await agent.getWalletInfo();

    res.json({
      success: true,
      wallet: {
        address: info.address,
        network: info.network,
        balances: {
          stx: info.balances.stx.toString(),
          stxFormatted: formatSTX(info.balances.stx),
          sbtc: info.balances.sbtc?.toString(),
          usdcx: info.balances.usdcx?.toString(),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /spending
 * Get spending summary
 */
app.get('/spending', (req: Request, res: Response) => {
  const summary = agent.getSpendingSummary();

  // Convert BigInt values to strings
  const response = {
    success: true,
    spending: {
      today: {
        total: summary.today.total.toString(),
        totalFormatted: formatSTX(summary.today.total),
        transactions: summary.today.transactions,
        byService: Object.fromEntries(
          Object.entries(summary.today.byService).map(([k, v]) => [k, v.toString()])
        ),
      },
      allTime: {
        total: summary.allTime.total.toString(),
        totalFormatted: formatSTX(summary.allTime.total),
        transactions: summary.allTime.transactions,
      },
      limits: {
        perTask: summary.limits.perTask.toString(),
        perTaskFormatted: formatSTX(summary.limits.perTask),
        perDay: summary.limits.perDay.toString(),
        perDayFormatted: formatSTX(summary.limits.perDay),
        remainingToday: summary.limits.remainingToday.toString(),
        remainingTodayFormatted: formatSTX(summary.limits.remainingToday),
      },
    },
  };

  res.json(response);
});

/**
 * PUT /limits
 * Update spending limits
 * 
 * Body: { maxPerTask?: number, maxPerDay?: number } (in STX)
 */
app.put('/limits', (req: Request, res: Response) => {
  const { maxPerTask, maxPerDay } = req.body;

  if (maxPerTask !== undefined) {
    agent.setLimits(BigInt(Math.floor(maxPerTask * 1_000_000)), undefined);
  }
  if (maxPerDay !== undefined) {
    agent.setLimits(undefined, BigInt(Math.floor(maxPerDay * 1_000_000)));
  }

  const summary = agent.getSpendingSummary();

  res.json({
    success: true,
    limits: {
      perTask: formatSTX(summary.limits.perTask),
      perDay: formatSTX(summary.limits.perDay),
    },
  });
});

// API prefix routes (for frontend compatibility)
app.get('/api/services', async (req, res) => {
  const query = req.query.q as string | undefined;
  try {
    const services = await agent.discoverServices(query);
    res.json({
      success: true,
      count: services.length,
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        url: s.url,
        price: s.price,
        category: s.category,
        tags: s.tags,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/wallet', async (req, res) => {
  try {
    const info = await agent.getWalletInfo();
    res.json({
      success: true,
      wallet: {
        address: info.address,
        network: info.network,
        balances: {
          stx: info.balances.stx.toString(),
          stxFormatted: formatSTX(info.balances.stx),
          sbtc: info.balances.sbtc?.toString(),
          usdcx: info.balances.usdcx?.toString(),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/spending', (req, res) => {
  const summary = agent.getSpendingSummary();
  res.json({
    success: true,
    spending: {
      today: {
        total: summary.today.total.toString(),
        totalFormatted: formatSTX(summary.today.total),
        transactions: summary.today.transactions,
      },
      allTime: {
        total: summary.allTime.total.toString(),
        totalFormatted: formatSTX(summary.allTime.total),
        transactions: summary.allTime.transactions,
      },
    },
  });
});
app.get('/api/history', (req, res) => {
  res.json({ success: true, history: pipelineHistory });
});

// Pipeline execution with WebSocket updates
app.post('/api/pipeline/execute', async (req, res) => {
  const { query, budget, maxSteps } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Send initial response with pipeline ID
  res.json({ success: true, pipelineId });
  
  // Execute pipeline asynchronously with WebSocket updates
  (async () => {
    const startTime = Date.now();
    let totalCost = 0;
    const txHashes: string[] = [];
    let lastOutput: any = null;
    
    // Accumulated context from all steps for richer data flow (only serializable data)
    const accumulatedContext: {
      price?: any;
      news?: any;
      sentiment?: any;
      summary?: any;
    } = {};
    
    try {
      // Broadcast pipeline started
      broadcast({
        event: 'pipeline:started',
        data: { pipelineId, query },
      });
      
      // Broadcast planning phase with proper timing for UX
      broadcast({
        event: 'pipeline:planning',
        data: { pipelineId, message: 'Parsing query...' },
      });
      
      await new Promise(r => setTimeout(r, 1000));
      
      broadcast({
        event: 'pipeline:planning',
        data: { pipelineId, message: 'Analyzing intent...' },
      });
      
      await new Promise(r => setTimeout(r, 800));
      
      // Plan the pipeline
      const plan = planPipeline(query);
      
      broadcast({
        event: 'pipeline:planning',
        data: { pipelineId, message: `Planning ${plan.steps.length}-step pipeline...` },
      });
      
      await new Promise(r => setTimeout(r, 800));
      
      broadcast({
        event: 'pipeline:planning',
        data: { pipelineId, message: 'Discovering services...' },
      });
      
      await new Promise(r => setTimeout(r, 600));
      
      // Build steps with estimated costs
      const plannedSteps = plan.steps.map((s, i) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        costSTX: 0, // Will be updated as we execute
        outputLabel: s.outputLabel,
      }));
      
      // Broadcast planned steps - UI switches to pipeline view
      broadcast({
        event: 'pipeline:planned',
        data: {
          pipelineId,
          totalSteps: plan.steps.length,
          steps: plannedSteps,
        },
      });
      
      // Execute each step
      for (let i = 0; i < plan.steps.length; i++) {
        const stepDef = plan.steps[i];
        const step = plannedSteps[i];
        
        // Broadcast step started
        broadcast({
          event: 'pipeline:step:started',
          data: { pipelineId, stepIndex: i, step },
        });
        
        try {
          // Safe clone helper to avoid circular references
          const safeClone = (obj: any): any => {
            if (!obj) return null;
            try {
              return JSON.parse(JSON.stringify(obj));
            } catch {
              return null;
            }
          };
          
          // Build enriched context with all previous step outputs (safely cloned)
          const enrichedContext = lastOutput ? {
            ...safeClone(lastOutput),
            // Include accumulated data for richer context
            _accumulated: safeClone(accumulatedContext),
          } : null;
          
          // Execute the task with enriched context
          const result = await agent.executeTask(stepDef.serviceQuery, {
            maxBudget: budget ? BigInt(Math.floor(budget * 1_000_000)) : undefined,
            context: enrichedContext,
          });
          
          if (!result.success) {
            throw new Error(result.error || 'Step execution failed');
          }
          
          const stepCost = result.payment?.amount ? Number(result.payment.amount) / 1_000_000 : 0;
          totalCost += stepCost;
          
          if (result.payment?.txId) {
            txHashes.push(result.payment.txId);
          }
          
          // Safe clone the output before storing
          lastOutput = safeClone(result.data);
          
          // Accumulate data by type for later steps (safely cloned)
          if (result.data?.type === 'price') {
            accumulatedContext.price = safeClone(result.data.data);
          } else if (result.data?.type === 'news') {
            accumulatedContext.news = safeClone(result.data.data);
          } else if (result.data?.type === 'sentiment') {
            accumulatedContext.sentiment = safeClone(result.data.data);
          } else if (result.data?.type === 'summary') {
            accumulatedContext.summary = safeClone(result.data.data);
          }
          // Don't accumulate allOutputs - just keep typed data
          
          // Update step with actual data
          step.costSTX = stepCost;
          
          // Broadcast step completed
          broadcast({
            event: 'pipeline:step:completed',
            data: {
              pipelineId,
              stepIndex: i,
              step: { ...step, txId: result.payment?.txId },
              result: result.data,
            },
          });
          
          // Small delay between steps for better UX
          if (i < plan.steps.length - 1) {
            await new Promise(r => setTimeout(r, 500));
          }
        } catch (stepError: any) {
          // Broadcast step failed
          broadcast({
            event: 'pipeline:step:failed',
            data: {
              pipelineId,
              stepIndex: i,
              error: stepError.message,
            },
          });
          
          throw stepError;
        }
      }
      
      // All steps completed successfully
      const durationMs = Date.now() - startTime;
      
      // Broadcast pipeline completed
      broadcast({
        event: 'pipeline:completed',
        data: {
          pipelineId,
          totalCost,
          result: lastOutput,
        },
      });
      
      // Save to history
      addToHistory({
        id: pipelineId,
        query,
        stepCount: plan.steps.length,
        totalCostSTX: totalCost,
        durationMs,
        status: 'success',
        txHashes,
        timestamp: new Date().toISOString(),
        output: lastOutput,
      });
      
    } catch (error: any) {
      broadcast({
        event: 'pipeline:failed',
        data: { pipelineId, error: error.message },
      });
      
      // Save failed pipeline to history
      addToHistory({
        id: pipelineId,
        query,
        stepCount: 0,
        totalCostSTX: totalCost,
        durationMs: Date.now() - startTime,
        status: 'failed',
        txHashes,
        timestamp: new Date().toISOString(),
      });
    }
  })();
});

// Pipeline preview
app.post('/api/pipeline/preview', async (req, res) => {
  const { query, maxSteps } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }
  
  try {
    const preview = await agent.previewTask(query);
    
    res.json({
      success: true,
      steps: preview.recommended ? [{
        name: preview.recommended.name,
        description: preview.recommended.description,
        priceSTX: Number(preview.recommended.price.amount) / 1_000_000,
      }] : [],
      totalCostSTX: Number(preview.estimatedCost) / 1_000_000,
      canAfford: preview.canAfford,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  🤖 PAYGENT API Server                ║
╚═══════════════════════════════════════╝

  Server:   http://localhost:${PORT}
  WebSocket: ws://localhost:${PORT}/ws
  Network:  ${config.network}
  Wallet:   ${agent.getAddress()}

  Endpoints:
    POST /task      Execute a task
    POST /preview   Preview task cost
    GET  /services  List available services
    GET  /wallet    Wallet info
    GET  /spending  Spending summary
    PUT  /limits    Update limits
    GET  /health    Health check

  Ready to accept requests! 🚀
`);
});

export default app;
