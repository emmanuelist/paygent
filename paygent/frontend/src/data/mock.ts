export interface WalletInfo {
  address: string;
  balance: number;
  network: "testnet" | "mainnet";
}

export interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  category: "News" | "AI Processing" | "Content Generation";
  priceSTX: number;
  icon: string; // lucide icon name
}

export type StepStatus = "pending" | "running" | "done" | "failed";

export interface PipelineStep {
  id: string;
  service: string;
  label: string;
  status: StepStatus;
  inputLabel?: string;
  outputLabel?: string;
  txHash?: string;
  costSTX?: number;
  output?: string;
  error?: string;
  durationMs?: number;
}

export interface PipelineExecution {
  id: string;
  query: string;
  steps: PipelineStep[];
  budgetSTX: number;
  spentSTX: number;
  etaSeconds: number;
  status: "running" | "done" | "failed";
  startedAt: Date;
  finalOutput?: string;
}

export interface ActivityEntry {
  id: string;
  query: string;
  stepCount: number;
  totalCostSTX: number;
  durationMs: number;
  status: "success" | "failed";
  txHash: string;
  timestamp: Date;
  output?: string;
}

export const mockWallet: WalletInfo = {
  address: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
  balance: 1247.83,
  network: "testnet",
};

export const mockServices: ServiceInfo[] = [
  { id: "s1", name: "HackerNews Feed", description: "Top stories from HN with summaries", category: "News", priceSTX: 0.5, icon: "Newspaper" },
  { id: "s2", name: "CoinGecko Price", description: "Real-time crypto price data", category: "News", priceSTX: 0.3, icon: "TrendingUp" },
  { id: "s3", name: "GPT-4 Summarizer", description: "AI-powered text summarization", category: "AI Processing", priceSTX: 2.0, icon: "Brain" },
  { id: "s4", name: "Sentiment Engine", description: "Analyze sentiment of any text", category: "AI Processing", priceSTX: 1.5, icon: "Activity" },
  { id: "s5", name: "Tweet Composer", description: "Generate viral-ready tweets", category: "Content Generation", priceSTX: 1.0, icon: "MessageSquare" },
  { id: "s6", name: "Blog Writer", description: "Long-form content generation", category: "Content Generation", priceSTX: 3.0, icon: "FileText" },
  { id: "s7", name: "Image Generator", description: "AI image generation from prompts", category: "Content Generation", priceSTX: 5.0, icon: "Image" },
  { id: "s8", name: "RSS Aggregator", description: "Aggregate feeds from multiple sources", category: "News", priceSTX: 0.8, icon: "Rss" },
  { id: "s9", name: "Translation API", description: "Translate text to 50+ languages", category: "AI Processing", priceSTX: 1.2, icon: "Globe" },
];

export const mockStepResults = [
  {
    txHash: "0x8a3f...c4d2",
    costSTX: 0.5,
    output: '["AI startup raises $50M", "New Rust framework released", "Bitcoin hits new ATH"]',
  },
  {
    txHash: "0x1b7e...9f3a",
    costSTX: 2.0,
    output: "Today's top tech stories: An AI startup secured $50M in Series B funding, a new Rust web framework challenges existing solutions, and Bitcoin reached a new all-time high.",
  },
  {
    txHash: "0x3c9d...7e5f",
    costSTX: 1.0,
    output: "🚀 AI startup raises $50M | New Rust framework drops | BTC hits ATH — the future is being built RIGHT NOW. #Tech #AI #Bitcoin",
  },
];

export const mockPipelineSteps: PipelineStep[] = [
  {
    id: "p1",
    service: "HackerNews Feed",
    label: "Fetch Headlines",
    status: "pending",
    outputLabel: "headlines",
  },
  {
    id: "p2",
    service: "GPT-4 Summarizer",
    label: "Summarize News",
    status: "pending",
    inputLabel: "headlines",
    outputLabel: "summary",
  },
  {
    id: "p3",
    service: "Tweet Composer",
    label: "Compose Tweet",
    status: "pending",
    inputLabel: "summary",
    outputLabel: "tweet",
  },
];

export const mockActivity: ActivityEntry[] = [
  {
    id: "a1",
    query: "Summarize today's AI news and tweet it",
    stepCount: 3,
    totalCostSTX: 3.5,
    durationMs: 8400,
    status: "success",
    txHash: "0x4f2a8b...7e3c1d",
    timestamp: new Date(Date.now() - 1800000),
    output: "🚀 AI News Roundup: Major breakthroughs in autonomous agents...",
  },
  {
    id: "a2",
    query: "Get BTC price and generate market report",
    stepCount: 2,
    totalCostSTX: 2.3,
    durationMs: 5200,
    status: "success",
    txHash: "0x9c1d3e...5a8f2b",
    timestamp: new Date(Date.now() - 7200000),
    output: "Bitcoin Market Report: BTC trading at $67,432...",
  },
  {
    id: "a3",
    query: "Translate press release to Spanish",
    stepCount: 1,
    totalCostSTX: 1.2,
    durationMs: 3100,
    status: "failed",
    txHash: "0x2e7f4a...8b1c3d",
    timestamp: new Date(Date.now() - 14400000),
  },
  {
    id: "a4",
    query: "Aggregate RSS feeds and create blog post",
    stepCount: 3,
    totalCostSTX: 4.8,
    durationMs: 12300,
    status: "success",
    txHash: "0x6d3b9c...2f4e7a",
    timestamp: new Date(Date.now() - 28800000),
    output: "Weekly Tech Digest: The biggest stories from this week...",
  },
];
