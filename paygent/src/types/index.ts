/**
 * Paygent Type Definitions
 */

// Service discovered from x402scan
export interface X402Service {
  id: string;
  name: string;
  description: string;
  url: string;
  endpoint: string;
  price: {
    amount: string;
    asset: 'STX' | 'sBTC' | 'USDCx';
  };
  network: string;
  seller: string;
  category?: string;
  tags?: string[];
  uptime?: number;
  avgResponseTime?: number;
  totalTransactions?: number;
  lastActive?: string;
}

// Task submitted to Paygent
export interface AgentTask {
  id: string;
  query: string;
  maxBudget?: bigint;
  preferredAsset?: 'STX' | 'sBTC' | 'USDCx';
  constraints?: {
    maxLatency?: number;
    minUptime?: number;
    requiredTags?: string[];
  };
  createdAt: Date;
}

// Result of service selection
export interface ServiceSelection {
  service: X402Service;
  reason: string;
  estimatedCost: bigint;
  confidence: number;
}

// Payment execution result
export interface PaymentResult {
  success: boolean;
  txId?: string;
  amount?: bigint;
  asset?: string;
  error?: string;
  explorerUrl?: string;
}

// Complete task result
export interface TaskResult {
  taskId: string;
  query: string;
  success: boolean;
  data?: any;
  service?: X402Service;
  payment?: PaymentResult;
  timing: {
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
  };
  error?: string;
}

// Agent spending summary
export interface SpendingSummary {
  today: {
    total: bigint;
    transactions: number;
    byService: Record<string, bigint>;
  };
  allTime: {
    total: bigint;
    transactions: number;
  };
  limits: {
    perTask: bigint;
    perDay: bigint;
    remainingToday: bigint;
  };
}

// AI reasoning output
export interface AIReasoning {
  selectedServiceId: string;
  reasoning: string;
  confidence: number;
  alternativeServices?: string[];
}

// Wallet info
export interface WalletInfo {
  address: string;
  network: string;
  balances: {
    stx: bigint;
    sbtc?: bigint;
    usdcx?: bigint;
  };
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ============================================
// Multi-Step Pipeline Types
// ============================================

// A single step in a task pipeline
export interface TaskStep {
  id: string;
  description: string;
  serviceId: string;
  requestData?: any;
  required?: boolean;
  estimatedCost?: bigint;
}

// A complete execution plan
export interface TaskPlan {
  id: string;
  query: string;
  description: string;
  steps: TaskStep[];
  estimatedTotalCost: bigint;
  outputTemplate?: string;
}

// Result of executing a single step
export interface StepResult {
  stepId: string;
  success: boolean;
  data?: any;
  service?: X402Service;
  payment?: PaymentResult;
  cost?: bigint;
  error?: string;
}

// Context passed between pipeline steps
export interface ExecutionContext {
  pipelineId: string;
  query: string;
  variables: Record<string, any>;
  results: StepResult[];
  totalSpent: bigint;
}

// Result of a complete pipeline execution
export interface PipelineResult {
  pipelineId: string;
  query: string;
  success: boolean;
  plan?: TaskPlan;
  stepResults: StepResult[];
  finalOutput?: any;
  totalCost: bigint;
  timing: {
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
  };
  error?: string;
}

// Event callbacks for real-time updates
export interface PipelineEvents {
  onPlanCreated?: (plan: TaskPlan) => void;
  onStepStart?: (step: TaskStep, index: number, total: number) => void;
  onStepComplete?: (step: TaskStep, result: StepResult) => void;
  onStepError?: (step: TaskStep, error: string) => void;
  onPipelineComplete?: (result: PipelineResult) => void;
}
