/**
 * Task Memory - Execution history and learning
 * 
 * Stores past executions for:
 * - History display
 * - Learning patterns
 * - Avoiding repeated failures
 */

import { PipelineResult, TaskResult } from '../types';

interface MemoryEntry {
  id: string;
  timestamp: Date;
  query: string;
  success: boolean;
  servicesUsed: string[];
  totalCost: bigint;
  durationMs: number;
}

export class TaskMemory {
  private pipelines: PipelineResult[] = [];
  private tasks: TaskResult[] = [];
  private maxHistory: number = 100;

  /**
   * Save a pipeline execution to memory
   */
  savePipeline(result: PipelineResult): void {
    this.pipelines.unshift(result);
    
    // Trim to max history
    if (this.pipelines.length > this.maxHistory) {
      this.pipelines = this.pipelines.slice(0, this.maxHistory);
    }
  }

  /**
   * Save a single task execution to memory
   */
  saveTask(result: TaskResult): void {
    this.tasks.unshift(result);
    
    if (this.tasks.length > this.maxHistory) {
      this.tasks = this.tasks.slice(0, this.maxHistory);
    }
  }

  /**
   * Get recent pipeline executions
   */
  getRecentPipelines(limit: number = 10): PipelineResult[] {
    return this.pipelines.slice(0, limit);
  }

  /**
   * Get recent task executions
   */
  getRecentTasks(limit: number = 10): TaskResult[] {
    return this.tasks.slice(0, limit);
  }

  /**
   * Get all executions (both pipelines and tasks)
   */
  getAllHistory(limit: number = 20): MemoryEntry[] {
    const entries: MemoryEntry[] = [];

    for (const pipeline of this.pipelines) {
      entries.push({
        id: pipeline.pipelineId,
        timestamp: pipeline.timing.startedAt,
        query: pipeline.query,
        success: pipeline.success,
        servicesUsed: pipeline.stepResults
          .filter(r => r.service)
          .map(r => r.service!.name),
        totalCost: pipeline.totalCost,
        durationMs: pipeline.timing.durationMs,
      });
    }

    for (const task of this.tasks) {
      entries.push({
        id: task.taskId,
        timestamp: task.timing.startedAt,
        query: task.query,
        success: task.success,
        servicesUsed: task.service ? [task.service.name] : [],
        totalCost: task.payment?.amount || BigInt(0),
        durationMs: task.timing.durationMs,
      });
    }

    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return entries.slice(0, limit);
  }

  /**
   * Get statistics about service usage
   */
  getServiceStats(): Record<string, { uses: number; successes: number; totalSpent: bigint }> {
    const stats: Record<string, { uses: number; successes: number; totalSpent: bigint }> = {};

    for (const pipeline of this.pipelines) {
      for (const step of pipeline.stepResults) {
        if (!step.service) continue;
        
        const name = step.service.name;
        if (!stats[name]) {
          stats[name] = { uses: 0, successes: 0, totalSpent: BigInt(0) };
        }
        
        stats[name].uses++;
        if (step.success) stats[name].successes++;
        stats[name].totalSpent += step.cost || BigInt(0);
      }
    }

    for (const task of this.tasks) {
      if (!task.service) continue;
      
      const name = task.service.name;
      if (!stats[name]) {
        stats[name] = { uses: 0, successes: 0, totalSpent: BigInt(0) };
      }
      
      stats[name].uses++;
      if (task.success) stats[name].successes++;
      stats[name].totalSpent += task.payment?.amount || BigInt(0);
    }

    return stats;
  }

  /**
   * Find similar past queries
   */
  findSimilarQueries(query: string, limit: number = 5): MemoryEntry[] {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    
    const scored = this.getAllHistory(100).map(entry => {
      const entryWords = new Set(entry.query.toLowerCase().split(/\s+/));
      let overlap = 0;
      
      for (const word of queryWords) {
        if (entryWords.has(word)) overlap++;
      }
      
      return { entry, score: overlap };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  /**
   * Clear all memory
   */
  clear(): void {
    this.pipelines = [];
    this.tasks = [];
  }

  /**
   * Get total spending from memory
   */
  getTotalSpent(): bigint {
    let total = BigInt(0);
    
    for (const pipeline of this.pipelines) {
      total += pipeline.totalCost;
    }
    
    for (const task of this.tasks) {
      total += task.payment?.amount || BigInt(0);
    }
    
    return total;
  }
}
