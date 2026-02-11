/**
 * Service Discovery Module
 * Discovers and fetches x402-enabled services from x402scan
 */

import axios from 'axios';
import { X402Service } from '../types';
import { logger } from '../utils/logger';

export class ServiceDiscovery {
  private baseUrl: string;
  private cache: Map<string, { services: X402Service[]; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache

  constructor(x402scanUrl: string = 'https://scan.stacksx402.com') {
    this.baseUrl = x402scanUrl;
  }

  /**
   * Fetch all available x402 services
   */
  async getAllServices(): Promise<X402Service[]> {
    const cacheKey = 'all';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Returning cached services');
      return cached.services;
    }

    try {
      // Try the x402scan API
      const response = await axios.get(`${this.baseUrl}/api/services`, {
        timeout: 10000,
      });
      
      const services = this.normalizeServices(response.data);
      this.cache.set(cacheKey, { services, timestamp: Date.now() });
      
      logger.info(`Discovered ${services.length} x402 services`);
      return services;
    } catch (error) {
      logger.warn('x402scan API unavailable, using fallback services');
      return this.getFallbackServices();
    }
  }

  /**
   * Search services by query
   */
  async searchServices(query: string): Promise<X402Service[]> {
    const allServices = await this.getAllServices();
    const lowerQuery = query.toLowerCase();
    
    return allServices.filter(service => 
      service.name.toLowerCase().includes(lowerQuery) ||
      service.description.toLowerCase().includes(lowerQuery) ||
      service.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get services by category
   */
  async getServicesByCategory(category: string): Promise<X402Service[]> {
    const allServices = await this.getAllServices();
    return allServices.filter(s => 
      s.category?.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Get services within budget
   */
  async getServicesWithinBudget(maxAmount: bigint, asset: string = 'STX'): Promise<X402Service[]> {
    const allServices = await this.getAllServices();
    return allServices.filter(s => 
      s.price.asset === asset && 
      BigInt(s.price.amount) <= maxAmount
    );
  }

  /**
   * Normalize service data from various API formats
   */
  private normalizeServices(data: any): X402Service[] {
    if (!data) return [];
    
    // Handle array or object with services property
    const servicesArray = Array.isArray(data) ? data : data.services || [];
    
    return servicesArray.map((s: any, index: number) => ({
      id: s.id || s._id || `service-${index}`,
      name: s.name || s.title || 'Unnamed Service',
      description: s.description || '',
      url: s.url || s.endpoint || '',
      endpoint: s.endpoint || s.url || '',
      price: {
        amount: String(s.price?.amount || s.amount || '0'),
        asset: (s.price?.asset || s.asset || 'STX').toUpperCase(),
      },
      network: s.network || 'stacks:mainnet',
      seller: s.seller || s.owner || '',
      category: s.category,
      tags: s.tags || [],
      uptime: s.uptime,
      avgResponseTime: s.avgResponseTime,
      totalTransactions: s.totalTransactions,
      lastActive: s.lastActive,
    }));
  }

  /**
   * Fallback services when x402scan is unavailable
   * Includes local demo server + known working x402 services
   */
  private getFallbackServices(): X402Service[] {
    const demoServerUrl = process.env.DEMO_SERVER_URL || 'http://localhost:3403';
    
    return [
      // ============ NEWS SERVICES ============
      {
        id: 'demo-bitcoin-news',
        name: 'Bitcoin News API',
        description: 'Get latest Bitcoin news headlines with sentiment analysis',
        url: `${demoServerUrl}/api/news/bitcoin`,
        endpoint: '/api/news/bitcoin',
        price: { amount: '1000', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'news',
        tags: ['bitcoin', 'news', 'crypto', 'btc', 'headlines'],
      },
      {
        id: 'demo-stacks-news',
        name: 'Stacks News API',
        description: 'Get latest Stacks ecosystem news and updates',
        url: `${demoServerUrl}/api/news/stacks`,
        endpoint: '/api/news/stacks',
        price: { amount: '1000', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'news',
        tags: ['stacks', 'news', 'defi', 'headlines'],
      },
      
      // ============ AI PROCESSING SERVICES ============
      {
        id: 'demo-summarize',
        name: 'AI Summarizer',
        description: 'Summarize any text content with key points extraction',
        url: `${demoServerUrl}/api/summarize`,
        endpoint: '/api/summarize',
        price: { amount: '2000', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'ai',
        tags: ['ai', 'summarize', 'nlp', 'text', 'summary'],
      },
      {
        id: 'demo-sentiment',
        name: 'Sentiment Analyzer',
        description: 'Analyze sentiment of text - positive, negative, or neutral',
        url: `${demoServerUrl}/api/sentiment`,
        endpoint: '/api/sentiment',
        price: { amount: '1500', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'ai',
        tags: ['ai', 'sentiment', 'analysis', 'nlp'],
      },
      {
        id: 'demo-translate',
        name: 'Translation API',
        description: 'Translate text between multiple languages',
        url: `${demoServerUrl}/api/translate`,
        endpoint: '/api/translate',
        price: { amount: '1500', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'ai',
        tags: ['translate', 'language', 'ai', 'i18n'],
      },
      
      // ============ CONTENT GENERATION ============
      {
        id: 'demo-tweet-generator',
        name: 'Tweet Generator',
        description: 'Generate engaging tweets from any content or topic',
        url: `${demoServerUrl}/api/generate/tweet`,
        endpoint: '/api/generate/tweet',
        price: { amount: '1000', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'generation',
        tags: ['ai', 'tweet', 'social', 'generate', 'content', 'twitter'],
      },
      {
        id: 'demo-report-generator',
        name: 'Report Generator',
        description: 'Generate comprehensive reports from data and insights',
        url: `${demoServerUrl}/api/generate/report`,
        endpoint: '/api/generate/report',
        price: { amount: '3000', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'generation',
        tags: ['ai', 'report', 'generate', 'analysis', 'document'],
      },
      
      // ============ MARKET DATA ============
      {
        id: 'demo-btc-price',
        name: 'Bitcoin Price API',
        description: 'Get current Bitcoin price and market data',
        url: `${demoServerUrl}/api/price/bitcoin`,
        endpoint: '/api/price/bitcoin',
        price: { amount: '500', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'market',
        tags: ['bitcoin', 'price', 'btc', 'market', 'data'],
      },
      {
        id: 'demo-stx-price',
        name: 'STX Price API',
        description: 'Get current STX price and market data',
        url: `${demoServerUrl}/api/price/stx`,
        endpoint: '/api/price/stx',
        price: { amount: '500', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'market',
        tags: ['stx', 'stacks', 'price', 'market', 'data'],
      },
      {
        id: 'demo-blockchain-info',
        name: 'Blockchain Info API',
        description: 'Get Stacks blockchain information and statistics',
        url: `${demoServerUrl}/api/blockchain/info`,
        endpoint: '/api/blockchain/info',
        price: { amount: '500', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'blockchain',
        tags: ['stacks', 'blockchain', 'info', 'chain', 'blocks'],
      },
      
      // ============ UTILITY ============
      {
        id: 'demo-echo',
        name: 'Echo API',
        description: 'Simple echo service for testing payments',
        url: `${demoServerUrl}/api/echo`,
        endpoint: '/api/echo',
        price: { amount: '100', asset: 'STX' },
        network: 'stacks:testnet',
        seller: '',
        category: 'utility',
        tags: ['echo', 'test', 'demo'],
      },
    ];
  }

  /**
   * Probe an endpoint to get x402 payment requirements
   */
  async probeEndpoint(url: string): Promise<X402Service | null> {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: (status) => status === 402 || status === 200,
      });

      if (response.status === 402) {
        const paymentReq = response.data;
        return {
          id: `probed-${Date.now()}`,
          name: paymentReq.resource?.name || 'Probed Service',
          description: paymentReq.resource?.description || '',
          url,
          endpoint: new URL(url).pathname,
          price: {
            amount: paymentReq.accepts?.[0]?.amount || '0',
            asset: this.extractAsset(paymentReq.accepts?.[0]?.asset),
          },
          network: paymentReq.accepts?.[0]?.network || 'stacks:mainnet',
          seller: paymentReq.accepts?.[0]?.payTo || '',
        };
      }

      return null;
    } catch (error) {
      logger.debug(`Failed to probe ${url}`);
      return null;
    }
  }

  private extractAsset(asset: string | undefined): 'STX' | 'sBTC' | 'USDCx' {
    if (!asset) return 'STX';
    if (asset.includes('sbtc')) return 'sBTC';
    if (asset.includes('usdc')) return 'USDCx';
    return 'STX';
  }
}
