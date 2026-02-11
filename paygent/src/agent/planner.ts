/**
 * Task Planner - AI-powered task decomposition
 * 
 * Analyzes complex tasks and breaks them into executable steps,
 * matching each step to available x402 services.
 */

import OpenAI from 'openai';
import { X402Service, TaskPlan, TaskStep } from '../types';
import { logger } from '../utils/logger';
import { formatPrice } from '../utils/formatting';

export class TaskPlanner {
  private openai: OpenAI | null;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4-turbo-preview') {
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    this.model = model;
  }

  /**
   * Create an execution plan for a complex task
   */
  async createPlan(
    query: string,
    availableServices: X402Service[],
    options: {
      maxBudget?: bigint;
      maxSteps?: number;
    } = {}
  ): Promise<TaskPlan | null> {
    const maxSteps = options.maxSteps || 5;
    const maxBudget = options.maxBudget || BigInt(1000000); // 1 STX default

    // If AI is available, use it for planning
    if (this.openai) {
      try {
        return await this.createAIPlan(query, availableServices, maxSteps, maxBudget);
      } catch (error) {
        logger.warn('AI planning failed, using heuristic planner');
      }
    }

    // Fallback to heuristic planning
    return this.createHeuristicPlan(query, availableServices, maxSteps, maxBudget);
  }

  /**
   * AI-powered plan creation
   */
  private async createAIPlan(
    query: string,
    services: X402Service[],
    maxSteps: number,
    maxBudget: bigint
  ): Promise<TaskPlan | null> {
    const servicesDescription = services.map(s => 
      `- ID: "${s.id}", Name: "${s.name}", Description: "${s.description}", Price: ${formatPrice(s.price.amount, s.price.asset)}, Tags: [${s.tags?.join(', ') || ''}]`
    ).join('\n');

    const prompt = `You are Paygent, an AI agent that orchestrates multi-step tasks using paid API services.

USER REQUEST: "${query}"

AVAILABLE SERVICES:
${servicesDescription}

CONSTRAINTS:
- Maximum ${maxSteps} steps
- Maximum budget: ${formatPrice(maxBudget.toString(), 'STX')}
- Each step must use exactly ONE service from the list

Analyze the user's request and create an execution plan. Break it into logical steps that chain together.
For each step, you can use {{stepN}} or {{lastResult}} to reference previous step outputs.

Respond in JSON format:
{
  "description": "Brief description of what this plan accomplishes",
  "steps": [
    {
      "id": "unique-step-id",
      "description": "What this step does",
      "serviceId": "the-service-id-to-use",
      "requestData": { "any": "params to send", "input": "{{lastResult}}" },
      "required": true
    }
  ],
  "outputTemplate": "Final result: {{step1}} and {{step2}}"
}

If the task can be accomplished with a SINGLE service, that's fine - create a 1-step plan.
If NO services can help with this task, return: { "error": "reason" }`;

    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty AI response');
    }

    const parsed = JSON.parse(content);
    
    if (parsed.error) {
      logger.warn(`AI planner: ${parsed.error}`);
      return null;
    }

    // Calculate total estimated cost
    let totalCost = BigInt(0);
    const steps: TaskStep[] = parsed.steps.map((step: any, index: number) => {
      const service = services.find(s => s.id === step.serviceId);
      const cost = service ? BigInt(service.price.amount) : BigInt(0);
      totalCost += cost;
      
      return {
        id: step.id || `step-${index + 1}`,
        description: step.description,
        serviceId: step.serviceId,
        requestData: step.requestData,
        required: step.required !== false,
        estimatedCost: cost,
      };
    });

    return {
      id: `plan-${Date.now()}`,
      query,
      description: parsed.description,
      steps,
      estimatedTotalCost: totalCost,
      outputTemplate: parsed.outputTemplate,
    };
  }

  /**
   * Heuristic plan creation (fallback when AI unavailable)
   * Uses a task decomposition approach to understand logical flow
   */
  private createHeuristicPlan(
    query: string,
    services: X402Service[],
    maxSteps: number,
    maxBudget: bigint
  ): TaskPlan | null {
    const queryLower = query.toLowerCase();
    
    // Detect task types in order of execution
    const taskPatterns = [
      // Data gathering tasks (do first)
      { pattern: /bitcoin\s*(news|headlines?|updates?)/i, category: 'news', keywords: ['bitcoin', 'news'] },
      { pattern: /stacks?\s*(news|headlines?|updates?)/i, category: 'news', keywords: ['stacks', 'news'] },
      { pattern: /(news|headlines?|updates?)/i, category: 'news', keywords: ['news'] },
      { pattern: /bitcoin\s*price/i, category: 'market', keywords: ['bitcoin', 'price', 'btc'] },
      { pattern: /stx\s*price|stacks?\s*price/i, category: 'market', keywords: ['stx', 'price'] },
      { pattern: /blockchain\s*info/i, category: 'blockchain', keywords: ['blockchain', 'info'] },
      
      // Processing tasks (do middle)
      { pattern: /summarize|summary/i, category: 'ai', keywords: ['summarize', 'ai'] },
      { pattern: /sentiment|analyze/i, category: 'ai', keywords: ['sentiment', 'analysis'] },
      { pattern: /translate/i, category: 'ai', keywords: ['translate', 'language'] },
      
      // Output tasks (do last)
      { pattern: /tweet|post|social/i, category: 'generation', keywords: ['tweet', 'generate', 'social'] },
      { pattern: /report/i, category: 'generation', keywords: ['report', 'generate'] },
    ];

    // Find what tasks are mentioned in the query
    const detectedTasks: Array<{ pattern: RegExp; category: string; keywords: string[] }> = [];
    for (const task of taskPatterns) {
      if (task.pattern.test(queryLower)) {
        // Avoid duplicates of same category
        if (!detectedTasks.some(t => t.category === task.category)) {
          detectedTasks.push(task);
        }
      }
    }

    // If no tasks detected, fall back to keyword scoring
    if (detectedTasks.length === 0) {
      return this.createKeywordBasedPlan(query, services, maxSteps, maxBudget);
    }

    // Limit to maxSteps
    const tasksToExecute = detectedTasks.slice(0, maxSteps);

    // Match each task to the best service
    const selectedServices: X402Service[] = [];
    let runningCost = BigInt(0);

    for (const task of tasksToExecute) {
      // Score services for this specific task
      let bestService: X402Service | null = null;
      let bestScore = 0;

      for (const service of services) {
        const nameLower = service.name.toLowerCase();
        const descLower = service.description.toLowerCase();
        const tags = service.tags?.map(t => t.toLowerCase()) || [];
        
        let score = 0;
        
        // Category match is strongest
        if (service.category === task.category) score += 10;
        
        // Keyword matches
        for (const keyword of task.keywords) {
          if (nameLower.includes(keyword)) score += 5;
          if (descLower.includes(keyword)) score += 3;
          if (tags.includes(keyword)) score += 4;
        }
        
        // Avoid selecting same service twice
        if (selectedServices.includes(service)) score = 0;
        
        if (score > bestScore) {
          bestScore = score;
          bestService = service;
        }
      }

      if (bestService && bestScore > 0) {
        const cost = BigInt(bestService.price.amount);
        if (runningCost + cost <= maxBudget) {
          selectedServices.push(bestService);
          runningCost += cost;
        }
      }
    }

    if (selectedServices.length === 0) {
      // No relevant services, pick the cheapest
      const cheapest = [...services].sort((a, b) => 
        Number(BigInt(a.price.amount) - BigInt(b.price.amount))
      )[0];
      
      if (cheapest && BigInt(cheapest.price.amount) <= maxBudget) {
        selectedServices.push(cheapest);
        runningCost = BigInt(cheapest.price.amount);
      } else {
        return null;
      }
    }

    // Create steps
    const steps: TaskStep[] = selectedServices.map((service, index) => ({
      id: `step-${index + 1}`,
      description: `Use ${service.name}: ${service.description}`,
      serviceId: service.id,
      requestData: index > 0 ? { input: '{{lastResult}}' } : undefined,
      required: true,
      estimatedCost: BigInt(service.price.amount),
    }));

    return {
      id: `plan-${Date.now()}`,
      query,
      description: `Execute ${steps.length} service(s) to complete the task`,
      steps,
      estimatedTotalCost: runningCost,
    };
  }

  /**
   * Fallback keyword-based planning when task patterns don't match
   */
  private createKeywordBasedPlan(
    query: string,
    services: X402Service[],
    maxSteps: number,
    maxBudget: bigint
  ): TaskPlan | null {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter(w => w.length >= 3);

    // Score services by keyword relevance
    const scoredServices = services.map(service => {
      let score = 0;
      const nameLower = service.name.toLowerCase();
      const descLower = service.description.toLowerCase();
      const tags = service.tags?.map(t => t.toLowerCase()) || [];

      for (const word of words) {
        if (nameLower.includes(word)) score += 3;
        if (descLower.includes(word)) score += 2;
        if (tags.some(t => t.includes(word))) score += 2;
      }

      return { service, score };
    });

    // Sort by score descending, then by price ascending
    scoredServices.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(BigInt(a.service.price.amount) - BigInt(b.service.price.amount));
    });

    // Take top N services within budget
    const selectedServices: X402Service[] = [];
    let runningCost = BigInt(0);

    for (const { service, score } of scoredServices) {
      if (selectedServices.length >= maxSteps) break;
      if (score === 0 && selectedServices.length > 0) break;
      
      const cost = BigInt(service.price.amount);
      if (runningCost + cost <= maxBudget) {
        selectedServices.push(service);
        runningCost += cost;
      }
    }

    if (selectedServices.length === 0) {
      // Pick cheapest
      const cheapest = [...services].sort((a, b) => 
        Number(BigInt(a.price.amount) - BigInt(b.price.amount))
      )[0];
      
      if (cheapest && BigInt(cheapest.price.amount) <= maxBudget) {
        selectedServices.push(cheapest);
        runningCost = BigInt(cheapest.price.amount);
      } else {
        return null;
      }
    }

    // Create steps
    const steps: TaskStep[] = selectedServices.map((service, index) => ({
      id: `step-${index + 1}`,
      description: `Use ${service.name}: ${service.description}`,
      serviceId: service.id,
      requestData: index > 0 ? { input: '{{lastResult}}' } : undefined,
      required: true,
      estimatedCost: BigInt(service.price.amount),
    }));

    return {
      id: `plan-${Date.now()}`,
      query,
      description: `Execute ${steps.length} service(s) to complete the task`,
      steps,
      estimatedTotalCost: runningCost,
    };
  }

  /**
   * Detect if a query requires multiple steps
   */
  isMultiStepQuery(query: string): boolean {
    const multiStepIndicators = [
      'and then',
      'after that',
      'then',
      'next',
      'finally',
      'first',
      'second',
      'summarize',
      'analyze',
      'combine',
      'based on',
      'using the',
      'create a .* from',
      'get .* and .*',
    ];

    const queryLower = query.toLowerCase();
    return multiStepIndicators.some(indicator => 
      new RegExp(indicator).test(queryLower)
    );
  }
}
