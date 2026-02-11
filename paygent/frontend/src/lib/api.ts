/**
 * Paygent API Client
 * Connects the frontend to the Paygent backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3402';

// Types matching backend responses
export interface WalletInfo {
  address: string;
  balance: string;
  balanceFormatted: string;
  network: 'mainnet' | 'testnet';
}

export interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  priceSTX: number;
  tags: string[];
}

export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  costSTX: number;
  txId?: string;
  output?: any;
  error?: string;
}

export interface PipelineStatus {
  id: string;
  query: string;
  status: 'planning' | 'running' | 'complete' | 'failed';
  steps: PipelineStep[];
  totalCostSTX: number;
  durationMs: number;
  output?: any;
  error?: string;
}

export interface PipelinePreview {
  query: string;
  description: string;
  steps: Array<{
    id: string;
    description: string;
    serviceId: string;
    costSTX: number;
  }>;
  estimatedCostSTX: number;
}

export interface ActivityEntry {
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

export interface TaskResult {
  success: boolean;
  service?: string;
  data?: any;
  cost: number;
  txId?: string;
  error?: string;
}

class PaygentAPI {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // ============ REST API Methods ============

  async getWallet(): Promise<WalletInfo> {
    const response = await fetch(`${this.baseUrl}/api/wallet`);
    if (!response.ok) throw new Error('Failed to fetch wallet');
    const data = await response.json();
    const wallet = data.wallet || data;
    return {
      address: wallet.address,
      balance: wallet.balances?.stx || wallet.balance || '0',
      balanceFormatted: wallet.balances?.stxFormatted || wallet.balanceFormatted || '0 STX',
      network: wallet.network || 'testnet',
    };
  }

  async getServices(): Promise<ServiceInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/services`);
    if (!response.ok) throw new Error('Failed to fetch services');
    const data = await response.json();
    const services = data.services || data || [];
    return services.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category || 'general',
      priceSTX: s.price?.amount ? Number(s.price.amount) / 1_000_000 : s.priceSTX || 0,
      tags: s.tags || [],
    }));
  }

  async executePipeline(query: string, options?: { budget?: number; maxSteps?: number }): Promise<{ pipelineId: string }> {
    const response = await fetch(`${this.baseUrl}/api/pipeline/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute pipeline');
    }
    return response.json();
  }

  async previewPipeline(query: string, maxSteps?: number): Promise<PipelinePreview> {
    const response = await fetch(`${this.baseUrl}/api/pipeline/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxSteps }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to preview pipeline');
    }
    return response.json();
  }

  async getPipelineStatus(id: string): Promise<PipelineStatus> {
    const response = await fetch(`${this.baseUrl}/api/pipeline/${id}`);
    if (!response.ok) throw new Error('Failed to fetch pipeline status');
    return response.json();
  }

  async getHistory(): Promise<ActivityEntry[]> {
    const response = await fetch(`${this.baseUrl}/api/history`);
    if (!response.ok) throw new Error('Failed to fetch history');
    const data = await response.json();
    return data.history || [];
  }

  async executeTask(query: string): Promise<TaskResult> {
    const response = await fetch(`${this.baseUrl}/api/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute task');
    }
    return response.json();
  }

  async getHealth(): Promise<{ status: string; network: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) throw new Error('API not available');
    return response.json();
  }

  // ============ WebSocket Methods ============

  connectWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected to', wsUrl);
    };

    this.ws.onmessage = (messageEvent) => {
      try {
        const parsed = JSON.parse(messageEvent.data);
        const eventName = parsed.event;
        const eventData = parsed.data;
        
        console.log('WebSocket message:', eventName, eventData);
        
        // Call specific event handlers
        const handlers = this.eventHandlers.get(eventName);
        handlers?.forEach(handler => handler(eventData));
        
        // Also call global handlers with full event object
        const globalHandlers = this.eventHandlers.get('*');
        globalHandlers?.forEach(handler => handler({ event: eventName, data: eventData }));
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Reconnect after 3 seconds
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to WebSocket events
   * @param handler - Global handler that receives {event, data} for all events
   * @returns Unsubscribe function
   */
  on(handler: (event: { event: string; data: any }) => void): () => void {
    // Register as global handler
    if (!this.eventHandlers.has('*')) {
      this.eventHandlers.set('*', new Set());
    }
    this.eventHandlers.get('*')!.add(handler);

    return () => {
      this.eventHandlers.get('*')?.delete(handler);
    };
  }

  isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const api = new PaygentAPI();

export default api;
