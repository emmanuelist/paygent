/**
 * Payment Execution Service
 * Handles making x402 payments to services
 */

import axios from 'axios';
import { 
  withPaymentInterceptor,
  wrapAxiosWithPaymentV1,
  privateKeyToAccount,
  decodePaymentResponse,
  decodeXPaymentResponse,
} from 'x402-stacks';
import { X402Service, PaymentResult } from '../types';
import { WalletService } from './wallet';
import { logger } from '../utils/logger';
import { getExplorerUrl, formatPrice } from '../utils/formatting';

export class PaymentService {
  private wallet: WalletService;
  private facilitatorUrl: string;
  private network: 'mainnet' | 'testnet';

  constructor(
    wallet: WalletService,
    facilitatorUrl: string = 'https://facilitator.stacksx402.com'
  ) {
    this.wallet = wallet;
    this.facilitatorUrl = facilitatorUrl;
    this.network = wallet.getNetwork();
  }

  /**
   * Execute a payment to an x402 service and get the response
   */
  async executePayment(
    service: X402Service,
    requestData?: any
  ): Promise<{ payment: PaymentResult; data?: any }> {
    const startTime = Date.now();
    
    logger.info(`Initiating payment to ${service.name}`);
    logger.debug(`Service URL: ${service.url}`);
    logger.debug(`Price: ${formatPrice(service.price.amount, service.price.asset)}`);

    // Check balance first
    const hasBalance = await this.wallet.hasSufficientBalance(
      BigInt(service.price.amount),
      service.price.asset
    );

    if (!hasBalance) {
      return {
        payment: {
          success: false,
          error: `Insufficient ${service.price.asset} balance`,
        },
      };
    }

    try {
      // Create axios instance with payment interceptor
      // Try V1 first (more common), fall back to V2
      const account = this.wallet.getAccount();
      
      // Use V1 interceptor for broader compatibility
      const client = wrapAxiosWithPaymentV1(
        axios.create({
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        account
      );

      // Make the request - payment is handled automatically on 402
      // Determine HTTP method based on endpoint pattern
      // POST for generation/processing endpoints, GET for data retrieval
      const isPostEndpoint = service.url.includes('/generate/') || 
                             service.url.includes('/summarize') ||
                             service.url.includes('/sentiment') ||
                             service.url.includes('/translate') ||
                             service.url.includes('/echo');
      
      // Data retrieval endpoints (news, price) are always GET
      const isGetEndpoint = service.url.includes('/news/') ||
                            service.url.includes('/price/');
      
      // Only use POST for processing endpoints, even if we have context data
      const usePost = isPostEndpoint && !isGetEndpoint;
      
      const response = await client.request({
        method: usePost ? 'POST' : 'GET',
        url: service.url,
        data: usePost ? (requestData || { query: 'execute' }) : undefined,
      });

      // Extract payment info from response headers
      const paymentResponseHeader = response.headers['x-payment-response'];
      let paymentInfo: any = null;
      
      if (paymentResponseHeader) {
        try {
          // Try V1 decode first
          paymentInfo = decodeXPaymentResponse(paymentResponseHeader);
        } catch {
          try {
            // Try V2 decode
            paymentInfo = decodePaymentResponse(paymentResponseHeader);
          } catch {
            // Try raw base64 decode
            try {
              paymentInfo = JSON.parse(
                Buffer.from(paymentResponseHeader, 'base64').toString('utf-8')
              );
            } catch {
              logger.debug('Could not parse payment response header');
            }
          }
        }
      }

      const txId = paymentInfo?.txId || paymentInfo?.transaction;
      const duration = Date.now() - startTime;

      logger.info(`Payment successful in ${duration}ms`);
      if (txId) {
        logger.info(`Transaction: ${txId}`);
      }

      return {
        payment: {
          success: true,
          txId,
          amount: BigInt(service.price.amount),
          asset: service.price.asset,
          explorerUrl: txId ? getExplorerUrl(txId, this.network) : undefined,
        },
        data: response.data,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Unknown payment error';
      
      logger.error(`Payment failed: ${errorMessage}`);

      return {
        payment: {
          success: false,
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Preview a payment without executing
   */
  async previewPayment(service: X402Service): Promise<{
    canAfford: boolean;
    cost: string;
    balance: string;
    remainingAfter: string;
  }> {
    const balances = await this.wallet.getBalances();
    const cost = BigInt(service.price.amount);
    
    let balance: bigint;
    switch (service.price.asset) {
      case 'sBTC':
        balance = balances.sbtc || BigInt(0);
        break;
      case 'USDCx':
        balance = balances.usdcx || BigInt(0);
        break;
      default:
        balance = balances.stx;
    }

    const canAfford = balance >= cost;
    const remainingAfter = canAfford ? balance - cost : BigInt(0);

    return {
      canAfford,
      cost: formatPrice(cost.toString(), service.price.asset),
      balance: formatPrice(balance.toString(), service.price.asset),
      remainingAfter: formatPrice(remainingAfter.toString(), service.price.asset),
    };
  }

  /**
   * Probe an endpoint to get payment requirements without paying
   */
  async getPaymentRequirements(url: string): Promise<any | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: (status) => status === 402,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 402) {
        return error.response.data;
      }
      return null;
    }
  }
}
