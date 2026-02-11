/**
 * Task Orchestrator - Multi-step task execution engine
 * 
 * This is the "brain" of Paygent - it breaks down complex tasks into steps,
 * executes them in sequence, chains service outputs, and manages the entire flow.
 */

import { v4 as uuidv4 } from 'uuid';
import { ServiceDiscovery } from '../services/discovery';
import { ServiceSelector } from '../services/selector';
import { WalletService } from '../services/wallet';
import { PaymentService } from '../services/payment';
import { SpendingTracker } from '../services/spending';
import { TaskPlanner } from './planner';
import { TaskMemory } from './memory';
import { PaygentConfig } from '../config';
import { 
  X402Service, 
  TaskPlan, 
  TaskStep, 
  StepResult,
  PipelineResult,
  ExecutionContext 
} from '../types';
import { logger, agentLog } from '../utils/logger';
import { formatSTX, formatDuration, formatPrice } from '../utils/formatting';

export interface OrchestratorEvents {
  onPlanCreated?: (plan: TaskPlan) => void;
  onStepStart?: (step: TaskStep, index: number, total: number) => void;
  onStepComplete?: (step: TaskStep, result: StepResult) => void;
  onStepError?: (step: TaskStep, error: string) => void;
  onPipelineComplete?: (result: PipelineResult) => void;
}

export class TaskOrchestrator {
  private discovery: ServiceDiscovery;
  private selector: ServiceSelector;
  private wallet: WalletService;
  private payment: PaymentService;
  private spending: SpendingTracker;
  private planner: TaskPlanner;
  private memory: TaskMemory;
  private config: PaygentConfig;
  private events: OrchestratorEvents;

  constructor(config: PaygentConfig, events: OrchestratorEvents = {}) {
    this.config = config;
    this.events = events;

    // Initialize services
    this.discovery = new ServiceDiscovery(config.x402scanUrl);
    this.selector = new ServiceSelector(config.openaiApiKey, config.openaiModel);
    this.wallet = new WalletService(config.privateKey, config.network);
    this.payment = new PaymentService(this.wallet, config.facilitatorUrl);
    this.spending = new SpendingTracker(config.maxSpendPerTask, config.maxSpendPerDay);
    this.planner = new TaskPlanner(config.openaiApiKey, config.openaiModel);
    this.memory = new TaskMemory();

    logger.info(`TaskOrchestrator initialized on ${config.network}`);
  }

  /**
   * Execute a complex task - the main entry point for multi-step tasks
   */
  async executePipeline(
    query: string,
    options: {
      maxBudget?: bigint;
      maxSteps?: number;
      autoApprove?: boolean;
    } = {}
  ): Promise<PipelineResult> {
    const startTime = new Date();
    const pipelineId = uuidv4();
    const maxBudget = options.maxBudget || this.config.maxSpendPerTask;
    const maxSteps = options.maxSteps || 5;

    agentLog.task(`Pipeline: "${query}"`);
    logger.debug(`Pipeline ID: ${pipelineId}`);

    try {
      // Step 1: Discover all available services
      agentLog.discover('Discovering available services...');
      const allServices = await this.discovery.getAllServices();
      
      if (allServices.length === 0) {
        throw new Error('No x402 services available');
      }
      agentLog.info(`Found ${allServices.length} services`);

      // Step 2: Create execution plan
      agentLog.thinking('Planning task execution...');
      const plan = await this.planner.createPlan(query, allServices, {
        maxBudget,
        maxSteps,
      });

      if (!plan || plan.steps.length === 0) {
        throw new Error('Could not create execution plan for this task');
      }

      this.events.onPlanCreated?.(plan);
      
      agentLog.info(`Created ${plan.steps.length}-step plan`);
      agentLog.info(`Estimated cost: ${formatPrice(plan.estimatedTotalCost.toString(), 'STX')}`);

      // Check if we can afford the plan
      const canAfford = this.spending.canSpend(plan.estimatedTotalCost);
      if (!canAfford.allowed) {
        throw new Error(`Budget exceeded: ${canAfford.reason}`);
      }

      // Step 3: Execute each step in sequence
      const context: ExecutionContext = {
        pipelineId,
        query,
        variables: {},
        results: [],
        totalSpent: BigInt(0),
      };

      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        
        agentLog.step(`Step ${i + 1}/${plan.steps.length}: ${step.description}`);
        this.events.onStepStart?.(step, i, plan.steps.length);

        try {
          const result = await this.executeStep(step, context, allServices);
          context.results.push(result);
          
          // Store step output in context for next steps
          if (result.success && result.data) {
            context.variables[`step${i + 1}`] = result.data;
            context.variables['lastResult'] = result.data;
          }
          
          context.totalSpent += result.cost || BigInt(0);
          
          this.events.onStepComplete?.(step, result);
          agentLog.success(`Step ${i + 1} complete`);
          
        } catch (error: any) {
          const errorResult: StepResult = {
            stepId: step.id,
            success: false,
            error: error.message,
          };
          context.results.push(errorResult);
          this.events.onStepError?.(step, error.message);
          
          // If step is required, abort pipeline
          if (step.required !== false) {
            throw new Error(`Required step failed: ${error.message}`);
          }
          
          agentLog.warn(`Optional step ${i + 1} failed, continuing...`);
        }
      }

      // Step 4: Compile final result
      const completedAt = new Date();
      const pipelineResult: PipelineResult = {
        pipelineId,
        query,
        success: true,
        plan,
        stepResults: context.results,
        finalOutput: this.compileFinalOutput(context, plan),
        totalCost: context.totalSpent,
        timing: {
          startedAt: startTime,
          completedAt,
          durationMs: completedAt.getTime() - startTime.getTime(),
        },
      };

      // Save to memory
      this.memory.savePipeline(pipelineResult);

      this.events.onPipelineComplete?.(pipelineResult);
      agentLog.success(`Pipeline completed in ${formatDuration(pipelineResult.timing.durationMs)}`);
      agentLog.info(`Total spent: ${formatPrice(context.totalSpent.toString(), 'STX')}`);

      return pipelineResult;

    } catch (error: any) {
      const completedAt = new Date();
      
      agentLog.error(`Pipeline failed: ${error.message}`);

      return {
        pipelineId,
        query,
        success: false,
        error: error.message,
        plan: undefined,
        stepResults: [],
        totalCost: BigInt(0),
        timing: {
          startedAt: startTime,
          completedAt,
          durationMs: completedAt.getTime() - startTime.getTime(),
        },
      };
    }
  }

  /**
   * Execute a single step in the pipeline
   */
  private async executeStep(
    step: TaskStep,
    context: ExecutionContext,
    allServices: X402Service[]
  ): Promise<StepResult> {
    // Find the service for this step
    const service = allServices.find(s => s.id === step.serviceId);
    
    if (!service) {
      throw new Error(`Service not found: ${step.serviceId}`);
    }

    // Prepare request data with context variables
    const requestData = this.interpolateVariables(step.requestData, context.variables);

    // Execute payment and get response
    const { payment, data } = await this.payment.executePayment(service, requestData);

    if (!payment.success) {
      throw new Error(payment.error || 'Payment failed');
    }

    // Record spending
    this.spending.recordPayment(
      payment.amount!,
      payment.asset!,
      service.id,
      service.name,
      payment.txId
    );

    return {
      stepId: step.id,
      success: true,
      data,
      service,
      payment,
      cost: payment.amount,
    };
  }

  /**
   * Replace {{variable}} placeholders with actual values
   */
  private interpolateVariables(
    data: any,
    variables: Record<string, any>
  ): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      return data.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return variables[key] !== undefined ? JSON.stringify(variables[key]) : `{{${key}}}`;
      });
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.interpolateVariables(item, variables));
    }
    
    if (typeof data === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.interpolateVariables(value, variables);
      }
      return result;
    }
    
    return data;
  }

  /**
   * Compile the final output from all step results
   */
  private compileFinalOutput(context: ExecutionContext, plan: TaskPlan): any {
    // If there's an output template, use it
    if (plan.outputTemplate) {
      return this.interpolateVariables(plan.outputTemplate, context.variables);
    }

    // Otherwise, return the last successful result
    const successfulResults = context.results.filter(r => r.success && r.data);
    if (successfulResults.length > 0) {
      return successfulResults[successfulResults.length - 1].data;
    }

    return null;
  }

  /**
   * Preview a pipeline without executing
   */
  async previewPipeline(
    query: string,
    options: { maxBudget?: bigint; maxSteps?: number } = {}
  ): Promise<TaskPlan | null> {
    const allServices = await this.discovery.getAllServices();
    return this.planner.createPlan(query, allServices, options);
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): PipelineResult[] {
    return this.memory.getRecentPipelines(limit);
  }

  /**
   * Get wallet info
   */
  getWallet(): WalletService {
    return this.wallet;
  }

  /**
   * Get spending tracker
   */
  getSpending(): SpendingTracker {
    return this.spending;
  }
}
