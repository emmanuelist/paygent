/**
 * Wallet Service
 * Manages the agent's Stacks wallet and balances
 */

import axios from 'axios';
import { privateKeyToAccount } from 'x402-stacks';
import { WalletInfo } from '../types';
import { logger } from '../utils/logger';

export class WalletService {
  private privateKey: string;
  private network: 'mainnet' | 'testnet';
  private address: string;
  private apiBaseUrl: string;

  constructor(privateKey: string, network: 'mainnet' | 'testnet' = 'testnet') {
    this.privateKey = privateKey;
    this.network = network;
    
    // Get address from private key
    const account = privateKeyToAccount(privateKey, network);
    this.address = account.address;
    
    // Set API base URL
    this.apiBaseUrl = network === 'mainnet'
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.address;
  }

  /**
   * Get wallet network
   */
  getNetwork(): 'mainnet' | 'testnet' {
    return this.network;
  }

  /**
   * Get account for signing transactions
   */
  getAccount() {
    return privateKeyToAccount(this.privateKey, this.network);
  }

  /**
   * Get full wallet info including balances
   */
  async getWalletInfo(): Promise<WalletInfo> {
    const balances = await this.getBalances();
    
    return {
      address: this.address,
      network: this.network,
      balances,
    };
  }

  /**
   * Get wallet balances
   */
  async getBalances(): Promise<{ stx: bigint; sbtc?: bigint; usdcx?: bigint }> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/extended/v1/address/${this.address}/balances`,
        { timeout: 10000 }
      );

      const data = response.data;
      
      const balances: { stx: bigint; sbtc?: bigint; usdcx?: bigint } = {
        stx: BigInt(data.stx?.balance || '0'),
      };

      // Check for sBTC balance
      const sbtcContract = this.network === 'mainnet'
        ? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token'
        : 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token';
      
      if (data.fungible_tokens?.[`${sbtcContract}::sbtc`]) {
        balances.sbtc = BigInt(data.fungible_tokens[`${sbtcContract}::sbtc`].balance || '0');
      }

      // Check for USDCx balance (xReserve USDC on Stacks)
      // Contract address may vary - this is a placeholder
      const usdcxKey = Object.keys(data.fungible_tokens || {}).find(k => 
        k.toLowerCase().includes('usdc')
      );
      if (usdcxKey) {
        balances.usdcx = BigInt(data.fungible_tokens[usdcxKey].balance || '0');
      }

      return balances;
    } catch (error) {
      logger.error('Failed to fetch balances:', error);
      return { stx: BigInt(0) };
    }
  }

  /**
   * Get STX balance only
   */
  async getSTXBalance(): Promise<bigint> {
    const balances = await this.getBalances();
    return balances.stx;
  }

  /**
   * Check if wallet has sufficient balance for a payment
   */
  async hasSufficientBalance(amount: bigint, asset: string = 'STX'): Promise<boolean> {
    const balances = await this.getBalances();
    
    switch (asset.toUpperCase()) {
      case 'STX':
        // Add buffer for transaction fees (0.01 STX)
        return balances.stx >= amount + BigInt(10000);
      case 'SBTC':
        return (balances.sbtc || BigInt(0)) >= amount;
      case 'USDCX':
        return (balances.usdcx || BigInt(0)) >= amount;
      default:
        return false;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(limit: number = 20): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/extended/v1/address/${this.address}/transactions`,
        {
          params: { limit },
          timeout: 10000,
        }
      );

      return response.data.results || [];
    } catch (error) {
      logger.error('Failed to fetch transaction history:', error);
      return [];
    }
  }
}
