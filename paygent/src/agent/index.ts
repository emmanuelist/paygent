/**
 * Paygent - The AI Payment Agent
 * Core agent that orchestrates service discovery, selection, and payment
 */

import { v4 as uuidv4 } from 'uuid';
import { ServiceDiscovery } from '../services/discovery';
import { ServiceSelector } from '../services/selector';
import { WalletService } from '../services/wallet';
import { PaymentService } from '../services/payment';
import { SpendingTracker } from '../services/spending';
import { TaskOrchestrator, OrchestratorEvents } from './orchestrator';
import { TaskMemory } from './memory';
import { PaygentConfig } from '../config';
import { 
  AgentTask, 
  TaskResult, 
  X402Service, 
  SpendingSummary, 
  WalletInfo,
  TaskPlan,
  PipelineResult,
  TaskStep,
  StepResult,
} from '../types';
import { logger, agentLog } from '../utils/logger';
import { formatSTX, formatDuration, formatPrice } from '../utils/formatting';

export class Paygent {
  private discovery: ServiceDiscovery;
  private selector: ServiceSelector;
  private wallet: WalletService;
  private payment: PaymentService;
  private spending: SpendingTracker;
  private orchestrator: TaskOrchestrator;
  private memory: TaskMemory;
  private config: PaygentConfig;

  constructor(config: PaygentConfig, events?: OrchestratorEvents) {
    this.config = config;

    // Initialize services
    this.discovery = new ServiceDiscovery(config.x402scanUrl);
    this.selector = new ServiceSelector(config.openaiApiKey, config.openaiModel);
    this.wallet = new WalletService(config.privateKey, config.network);
    this.payment = new PaymentService(this.wallet, config.facilitatorUrl);
    this.spending = new SpendingTracker(config.maxSpendPerTask, config.maxSpendPerDay);
    this.orchestrator = new TaskOrchestrator(config, events || {});
    this.memory = new TaskMemory();

    logger.info(`Paygent initialized on ${config.network}`);
    logger.info(`Wallet: ${this.wallet.getAddress()}`);
  }

  /**
   * Execute a task - the main entry point
   * @param query - The task query
   * @param options.context - Data from previous pipeline step to pass to the service
   */
  async executeTask(query: string, options?: {
    maxBudget?: bigint;
    preferredAsset?: 'STX' | 'sBTC' | 'USDCx';
    autoApprove?: boolean;
    context?: any; // Data from previous step
  }): Promise<TaskResult> {
    const startTime = new Date();
    const task: AgentTask = {
      id: uuidv4(),
      query,
      maxBudget: options?.maxBudget || this.config.maxSpendPerTask,
      preferredAsset: options?.preferredAsset || 'STX',
      createdAt: startTime,
    };

    agentLog.task(`Task: "${query}"`);
    logger.debug(`Task ID: ${task.id}`);

    try {
      // Step 1: Discover available services
      agentLog.discover('Discovering available services...');
      const services = await this.discovery.searchServices(query);
      
      if (services.length === 0) {
        // Try getting all services if search returns nothing
        const allServices = await this.discovery.getAllServices();
        if (allServices.length === 0) {
          throw new Error('No x402 services available');
        }
        services.push(...allServices);
      }

      agentLog.info(`Found ${services.length} potential services`);

      // Step 2: Filter by budget
      const affordableServices = services.filter(s => 
        BigInt(s.price.amount) <= task.maxBudget!
      );

      if (affordableServices.length === 0) {
        throw new Error(`No services within budget of ${formatSTX(task.maxBudget!)}`);
      }

      // Step 3: AI selects best service
      agentLog.thinking('Analyzing services...');
      const selection = await this.selector.selectService(task, affordableServices);

      if (!selection) {
        throw new Error('Could not select a suitable service');
      }

      agentLog.select(`Selected: ${selection.service.name}`);
      agentLog.info(`Reason: ${selection.reason}`);
      agentLog.info(`Cost: ${formatPrice(selection.service.price.amount, selection.service.price.asset)}`);
      agentLog.info(`Confidence: ${(selection.confidence * 100).toFixed(0)}%`);

      // Step 4: Check spending limits
      const canSpend = this.spending.canSpend(selection.estimatedCost);
      if (!canSpend.allowed) {
        throw new Error(canSpend.reason);
      }

      // Step 5: Execute payment and get response
      agentLog.pay('Executing payment...');
      
      // Build request data with context from previous step if available
      const requestData = options?.context ? this.extractContextData(options.context) : undefined;
      
      const { payment, data } = await this.payment.executePayment(selection.service, requestData);

      if (!payment.success) {
        throw new Error(payment.error || 'Payment failed');
      }

      // Step 6: Record spending
      this.spending.recordPayment(
        payment.amount!,
        payment.asset!,
        selection.service.id,
        selection.service.name,
        payment.txId
      );

      // Build result
      const completedAt = new Date();
      const result: TaskResult = {
        taskId: task.id,
        query: task.query,
        success: true,
        data,
        service: selection.service,
        payment,
        timing: {
          startedAt: startTime,
          completedAt,
          durationMs: completedAt.getTime() - startTime.getTime(),
        },
      };

      agentLog.success(`Task completed in ${formatDuration(result.timing.durationMs)}`);
      if (payment.explorerUrl) {
        agentLog.info(`Explorer: ${payment.explorerUrl}`);
      }

      return result;

    } catch (error: any) {
      const completedAt = new Date();
      
      agentLog.error(`Task failed: ${error.message}`);

      return {
        taskId: task.id,
        query: task.query,
        success: false,
        error: error.message,
        timing: {
          startedAt: startTime,
          completedAt,
          durationMs: completedAt.getTime() - startTime.getTime(),
        },
      };
    }
  }

  /**
   * Get available services without executing
   */
  async discoverServices(query?: string): Promise<X402Service[]> {
    if (query) {
      return this.discovery.searchServices(query);
    }
    return this.discovery.getAllServices();
  }

  /**
   * Preview what a task would cost
   */
  async previewTask(query: string): Promise<{
    services: X402Service[];
    recommended?: X402Service;
    estimatedCost?: string;
    canAfford: boolean;
  }> {
    const services = await this.discovery.searchServices(query);
    
    if (services.length === 0) {
      return { services: [], canAfford: false };
    }

    // Get recommended service
    const task: AgentTask = {
      id: 'preview',
      query,
      maxBudget: this.config.maxSpendPerTask,
      createdAt: new Date(),
    };

    const selection = await this.selector.selectService(task, services);
    
    if (!selection) {
      return { services, canAfford: false };
    }

    const preview = await this.payment.previewPayment(selection.service);

    return {
      services,
      recommended: selection.service,
      estimatedCost: preview.cost,
      canAfford: preview.canAfford,
    };
  }

  /**
   * Get wallet info
   */
  async getWalletInfo(): Promise<WalletInfo> {
    return this.wallet.getWalletInfo();
  }

  /**
   * Get spending summary
   */
  getSpendingSummary(): SpendingSummary {
    return this.spending.getSummary();
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.getAddress();
  }

  /**
   * Get network
   */
  getNetwork(): string {
    return this.config.network;
  }

  /**
   * Extract meaningful content from pipeline context for passing to next step
   * This handles various response formats and extracts actual data, not metadata
   */
  private extractContextData(context: any): { input: any; data: any; text: string } {
    if (!context) {
      return { input: null, data: null, text: '' };
    }

    // If it's a string, use directly
    if (typeof context === 'string') {
      return { input: context, data: { content: context }, text: context };
    }

    // Extract the actual data payload (skip payment/success metadata)
    const actualData = context.data || context;
    
    // Check for accumulated context from pipeline
    const accumulated = context._accumulated || {};
    
    // Build a meaningful text representation based on data type
    const textParts: string[] = [];
    
    // Include accumulated price data if available
    if (accumulated.price) {
      const price = accumulated.price.price || accumulated.price.priceUSD;
      const change = accumulated.price.change24h || '';
      textParts.push(`Bitcoin Price: $${price}${change ? ` (${change})` : ''}`);
    }
    
    // Include accumulated news data if available
    if (accumulated.news?.headlines) {
      textParts.push(`\nLatest News Headlines:`);
      accumulated.news.headlines.slice(0, 5).forEach((h: any, i: number) => {
        textParts.push(`${i + 1}. ${h.title} - ${h.source}`);
      });
    }
    
    // Include accumulated sentiment if available
    if (accumulated.sentiment) {
      const s = accumulated.sentiment;
      textParts.push(`\nMarket Sentiment: ${s.sentiment?.toUpperCase() || 'UNKNOWN'} (score: ${s.score || 50}/100)`);
    }
    
    // Include accumulated summary if available
    if (accumulated.summary?.summary) {
      textParts.push(`\nSummary: ${accumulated.summary.summary}`);
    }
    
    // Now add the current step's data
    textParts.push('\n--- Current Step Data ---');
    
    // Handle price data
    if (context.type === 'price' && actualData) {
      const price = actualData.price || actualData.priceUSD;
      const change = actualData.change24h || actualData.changePercent;
      const asset = context.asset || 'BTC';
      textParts.push(`${asset} Price: $${price} (${change} 24h change)`);
      if (actualData.high24h) textParts.push(`24h High: $${actualData.high24h}, Low: $${actualData.low24h}`);
      if (actualData.marketCap) textParts.push(`Market Cap: ${actualData.marketCap}`);
    }
    
    // Handle news data
    if (context.type === 'news' && actualData?.headlines) {
      textParts.push(`Latest News Headlines:`);
      actualData.headlines.forEach((h: any, i: number) => {
        const sentiment = h.sentiment ? ` [${h.sentiment}]` : '';
        textParts.push(`${i + 1}. ${h.title} - ${h.source}${sentiment}`);
      });
    }
    
    // Handle sentiment data
    if (context.type === 'sentiment' && actualData) {
      const sentiment = actualData.sentiment || 'unknown';
      const score = actualData.score ?? 50;
      const confidence = actualData.confidence ? ` (${(actualData.confidence * 100).toFixed(0)}% confidence)` : '';
      textParts.push(`Sentiment Analysis: ${sentiment.toUpperCase()} with score ${score}/100${confidence}`);
    }
    
    // Handle summary data
    if (context.type === 'summary' && actualData) {
      if (actualData.summary) textParts.push(actualData.summary);
      if (actualData.keyPoints) {
        textParts.push('Key Points:');
        actualData.keyPoints.forEach((p: string) => textParts.push(`• ${p}`));
      }
    }
    
    // Handle generated content (tweet, report)
    if (context.type === 'generated_content' && actualData) {
      if (actualData.tweet) textParts.push(`Tweet: ${actualData.tweet}`);
      if (actualData.title) textParts.push(`Report: ${actualData.title}`);
      if (actualData.executive_summary) textParts.push(actualData.executive_summary);
      if (actualData.sections) {
        actualData.sections.forEach((s: any) => {
          textParts.push(`## ${s.heading}`);
          textParts.push(s.content);
        });
      }
    }
    
    // Fallback: try common content fields if no structured data found
    if (textParts.length <= 2) { // Only has accumulated header or is empty
      if (actualData?.content) textParts.push(actualData.content);
      else if (actualData?.text) textParts.push(actualData.text);
      else if (actualData?.summary) textParts.push(actualData.summary);
      else if (actualData?.message) textParts.push(actualData.message);
    }
    
    // Final fallback: stringify but skip metadata fields
    if (textParts.length <= 2) {
      const cleanData = { ...actualData };
      delete cleanData.payment;
      delete cleanData.success;
      delete cleanData.timestamp;
      delete cleanData.isRealData;
      delete cleanData._accumulated;
      textParts.push(JSON.stringify(cleanData, null, 2));
    }

    const text = textParts.join('\n');
    
    // Include accumulated data in the data field for structured access
    // Use safeClone to avoid circular references
    const safeClone = (obj: any): any => {
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch {
        return null;
      }
    };
    
    const enrichedData = {
      ...(safeClone(actualData) || {}),
      ...(accumulated.price && { priceData: safeClone(accumulated.price) }),
      ...(accumulated.news && { newsData: safeClone(accumulated.news) }),
      ...(accumulated.sentiment && { sentimentData: safeClone(accumulated.sentiment) }),
      ...(accumulated.summary && { summaryData: safeClone(accumulated.summary) }),
    };
    
    return {
      input: null, // Don't pass raw input to avoid circular refs
      data: enrichedData,
      text,
    };
  }

  /**
   * Update spending limits
   */
  setLimits(maxPerTask?: bigint, maxPerDay?: bigint): void {
    this.spending.setLimits(maxPerTask, maxPerDay);
  }

  // ============================================
  // Multi-Step Pipeline Methods
  // ============================================

  /**
   * Execute a multi-step pipeline
   * This is the advanced entry point for complex, multi-service tasks
   */
  async executePipeline(
    query: string,
    options?: {
      maxBudget?: bigint;
      maxSteps?: number;
      autoApprove?: boolean;
    }
  ): Promise<PipelineResult> {
    const result = await this.orchestrator.executePipeline(query, options);
    return result;
  }

  /**
   * Preview a pipeline without executing
   */
  async previewPipeline(
    query: string,
    options?: { maxBudget?: bigint; maxSteps?: number }
  ): Promise<TaskPlan | null> {
    return this.orchestrator.previewPipeline(query, options);
  }

  /**
   * Smart execute - automatically chooses single task or pipeline
   */
  async execute(
    query: string,
    options?: {
      maxBudget?: bigint;
      forcePipeline?: boolean;
      autoApprove?: boolean;
    }
  ): Promise<TaskResult | PipelineResult> {
    // Detect if this is a multi-step query
    const isMultiStep = options?.forcePipeline || this.isMultiStepQuery(query);
    
    if (isMultiStep) {
      return this.executePipeline(query, options);
    } else {
      return this.executeTask(query, options);
    }
  }

  /**
   * Detect if a query requires multiple steps
   */
  private isMultiStepQuery(query: string): boolean {
    const multiStepIndicators = [
      /\band\s+then\b/i,
      /\bafter\s+that\b/i,
      /\bthen\b.*\b(create|make|generate|write)\b/i,
      /\bfirst\b.*\bthen\b/i,
      /\bsummarize\b.*\band\b/i,
      /\banalyze\b.*\band\b/i,
      /\bcombine\b/i,
      /\bbased\s+on\b/i,
      /\busing\s+the\s+result\b/i,
      /\bcreate\s+a\s+\w+\s+from\b/i,
      /\bget\b.*\band\b.*\b(create|write|make|generate)\b/i,
    ];

    return multiStepIndicators.some(pattern => pattern.test(query));
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): PipelineResult[] {
    return this.orchestrator.getHistory(limit);
  }

  /**
   * Get service statistics from memory
   */
  getServiceStats(): Record<string, { uses: number; successes: number; totalSpent: bigint }> {
    return this.memory.getServiceStats();
  }
}

// Factory function for easy creation
export function createPaygent(config: PaygentConfig, events?: OrchestratorEvents): Paygent {
  return new Paygent(config, events);
}

// Export types and orchestrator
export { TaskOrchestrator, OrchestratorEvents } from './orchestrator';
export { TaskPlanner } from './planner';
export { TaskMemory } from './memory';
