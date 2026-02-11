/**
 * AI Service Selector
 * Uses AI to intelligently select the best service for a given task
 */

import OpenAI from 'openai';
import { X402Service, AgentTask, ServiceSelection, AIReasoning } from '../types';
import { logger } from '../utils/logger';
import { formatPrice } from '../utils/formatting';

export class ServiceSelector {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4-turbo-preview') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Select the best service for a given task
   */
  async selectService(
    task: AgentTask,
    availableServices: X402Service[]
  ): Promise<ServiceSelection | null> {
    if (availableServices.length === 0) {
      logger.warn('No services available for selection');
      return null;
    }

    // If only one service, return it
    if (availableServices.length === 1) {
      return {
        service: availableServices[0],
        reason: 'Only available service matching criteria',
        estimatedCost: BigInt(availableServices[0].price.amount),
        confidence: 1.0,
      };
    }

    // Use AI to select the best service
    const reasoning = await this.getAIReasoning(task, availableServices);
    
    const selectedService = availableServices.find(s => s.id === reasoning.selectedServiceId);
    
    if (!selectedService) {
      // Fallback to first service
      logger.warn('AI selected unknown service, falling back to first');
      return {
        service: availableServices[0],
        reason: 'Fallback selection',
        estimatedCost: BigInt(availableServices[0].price.amount),
        confidence: 0.5,
      };
    }

    return {
      service: selectedService,
      reason: reasoning.reasoning,
      estimatedCost: BigInt(selectedService.price.amount),
      confidence: reasoning.confidence,
    };
  }

  /**
   * Get AI reasoning for service selection
   */
  private async getAIReasoning(
    task: AgentTask,
    services: X402Service[]
  ): Promise<AIReasoning> {
    const servicesDescription = services.map((s, i) => 
      `${i + 1}. ID: "${s.id}"
   Name: ${s.name}
   Description: ${s.description}
   Price: ${formatPrice(s.price.amount, s.price.asset)}
   Tags: ${s.tags?.join(', ') || 'none'}
   Uptime: ${s.uptime ? `${s.uptime}%` : 'unknown'}`
    ).join('\n\n');

    const prompt = `You are Paygent, an AI agent that autonomously pays for API services.

USER TASK: "${task.query}"

AVAILABLE SERVICES:
${servicesDescription}

CONSTRAINTS:
- Max budget: ${task.maxBudget ? formatPrice(task.maxBudget.toString(), task.preferredAsset || 'STX') : 'No limit'}
- Preferred asset: ${task.preferredAsset || 'Any'}

Select the BEST service for this task. Consider:
1. Relevance to the user's query
2. Price (prefer cheaper if equally relevant)
3. Reliability (uptime if available)
4. Description match

Respond in JSON format:
{
  "selectedServiceId": "the-service-id",
  "reasoning": "Brief explanation of why this service was selected",
  "confidence": 0.0-1.0,
  "alternativeServices": ["other-service-id"] // optional
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty AI response');
      }

      const parsed = JSON.parse(content);
      
      return {
        selectedServiceId: parsed.selectedServiceId,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence || 0.8,
        alternativeServices: parsed.alternativeServices,
      };
    } catch (error) {
      logger.error('AI reasoning failed, using heuristic selection');
      
      // Fallback: Score services and select highest scoring
      const scored = services.map(s => ({
        service: s,
        score: this.scoreService(s, task),
      })).sort((a, b) => b.score - a.score);
      
      const best = scored[0];
      logger.info(`Heuristic selected: ${best.service.name} (score: ${best.score})`);
      
      return {
        selectedServiceId: best.service.id,
        reasoning: `Selected best matching service (score: ${best.score})`,
        confidence: Math.min(0.9, best.score / 100),
      };
    }
  }

  /**
   * Score a service based on task relevance (heuristic)
   */
  scoreService(service: X402Service, task: AgentTask): number {
    let score = 0;
    const queryLower = task.query.toLowerCase();
    
    // Check for keyword matches
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const serviceText = `${service.name} ${service.description} ${service.tags?.join(' ') || ''}`.toLowerCase();
    
    // Strong keyword matches
    const strongMatches = ['bitcoin', 'btc', 'stacks', 'stx', 'price', 'news', 'tweet', 'summarize', 'sentiment', 'translate'];
    for (const kw of strongMatches) {
      if (queryLower.includes(kw) && serviceText.includes(kw)) {
        score += 40;
      }
    }
    
    // Name match
    for (const word of keywords) {
      if (service.name.toLowerCase().includes(word)) {
        score += 30;
      }
    }
    
    // Description match
    const descWords = service.description.toLowerCase().split(' ');
    const queryWords = keywords;
    const matchingWords = queryWords.filter(w => 
      descWords.some(d => d.includes(w) || w.includes(d))
    );
    score += matchingWords.length * 15;
    
    // Tag match
    if (service.tags) {
      const matchingTags = service.tags.filter(t => 
        keywords.some(kw => t.toLowerCase().includes(kw) || kw.includes(t.toLowerCase()))
      );
      score += matchingTags.length * 20;
    }
    
    // Price bonus (cheaper is better, max 10 points)
    const priceNum = Number(BigInt(service.price.amount));
    if (priceNum < 10000) score += 10;
    else if (priceNum < 100000) score += 5;
    
    // Uptime bonus
    if (service.uptime && service.uptime > 99) score += 5;
    
    return score;
  }
}
