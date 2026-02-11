/**
 * Spending Tracker Service
 * Tracks and enforces spending limits for the agent
 */

import { SpendingSummary } from '../types';
import { logger } from '../utils/logger';
import { formatSTX } from '../utils/formatting';

interface SpendingRecord {
  timestamp: Date;
  amount: bigint;
  asset: string;
  serviceId: string;
  serviceName: string;
  txId?: string;
}

export class SpendingTracker {
  private records: SpendingRecord[] = [];
  private maxPerTask: bigint;
  private maxPerDay: bigint;

  constructor(maxPerTask: bigint, maxPerDay: bigint) {
    this.maxPerTask = maxPerTask;
    this.maxPerDay = maxPerDay;
  }

  /**
   * Record a new payment
   */
  recordPayment(
    amount: bigint,
    asset: string,
    serviceId: string,
    serviceName: string,
    txId?: string
  ): void {
    this.records.push({
      timestamp: new Date(),
      amount,
      asset,
      serviceId,
      serviceName,
      txId,
    });

    logger.debug(`Recorded payment: ${formatSTX(amount)} to ${serviceName}`);
  }

  /**
   * Check if a payment is within limits
   */
  canSpend(amount: bigint): { allowed: boolean; reason?: string } {
    // Check per-task limit
    if (amount > this.maxPerTask) {
      return {
        allowed: false,
        reason: `Amount ${formatSTX(amount)} exceeds per-task limit of ${formatSTX(this.maxPerTask)}`,
      };
    }

    // Check daily limit
    const todaySpent = this.getTodaySpent();
    if (todaySpent + amount > this.maxPerDay) {
      return {
        allowed: false,
        reason: `Would exceed daily limit. Spent today: ${formatSTX(todaySpent)}, Limit: ${formatSTX(this.maxPerDay)}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get total spent today (in microSTX equivalent)
   */
  getTodaySpent(): bigint {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.records
      .filter(r => r.timestamp >= today && r.asset === 'STX')
      .reduce((sum, r) => sum + r.amount, BigInt(0));
  }

  /**
   * Get spending summary
   */
  getSummary(): SpendingSummary {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecords = this.records.filter(r => r.timestamp >= today);
    const todayByService: Record<string, bigint> = {};

    for (const record of todayRecords) {
      if (record.asset === 'STX') {
        todayByService[record.serviceName] = 
          (todayByService[record.serviceName] || BigInt(0)) + record.amount;
      }
    }

    const todayTotal = this.getTodaySpent();
    const allTimeTotal = this.records
      .filter(r => r.asset === 'STX')
      .reduce((sum, r) => sum + r.amount, BigInt(0));

    return {
      today: {
        total: todayTotal,
        transactions: todayRecords.length,
        byService: todayByService,
      },
      allTime: {
        total: allTimeTotal,
        transactions: this.records.length,
      },
      limits: {
        perTask: this.maxPerTask,
        perDay: this.maxPerDay,
        remainingToday: this.maxPerDay > todayTotal ? this.maxPerDay - todayTotal : BigInt(0),
      },
    };
  }

  /**
   * Get recent transactions
   */
  getRecentTransactions(limit: number = 10): SpendingRecord[] {
    return [...this.records]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Update spending limits
   */
  setLimits(maxPerTask?: bigint, maxPerDay?: bigint): void {
    if (maxPerTask !== undefined) {
      this.maxPerTask = maxPerTask;
      logger.info(`Per-task limit set to ${formatSTX(maxPerTask)}`);
    }
    if (maxPerDay !== undefined) {
      this.maxPerDay = maxPerDay;
      logger.info(`Daily limit set to ${formatSTX(maxPerDay)}`);
    }
  }

  /**
   * Reset daily spending (for testing)
   */
  resetDaily(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.records = this.records.filter(r => r.timestamp < today);
    logger.info('Daily spending reset');
  }

  /**
   * Export records for persistence
   */
  exportRecords(): SpendingRecord[] {
    return [...this.records];
  }

  /**
   * Import records (for persistence)
   */
  importRecords(records: SpendingRecord[]): void {
    this.records = records.map(r => ({
      ...r,
      timestamp: new Date(r.timestamp),
      amount: BigInt(r.amount),
    }));
  }
}
