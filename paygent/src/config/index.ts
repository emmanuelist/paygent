import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface PaygentConfig {
  // Wallet
  privateKey: string;
  network: 'mainnet' | 'testnet';
  
  // x402
  facilitatorUrl: string;
  x402scanUrl: string;
  
  // Spending limits (in microSTX)
  maxSpendPerTask: bigint;
  maxSpendPerDay: bigint;
  
  // AI
  openaiApiKey: string;
  openaiModel: string;
  
  // Server
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): PaygentConfig {
  const privateKey = process.env.PAYGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PAYGENT_PRIVATE_KEY is required. Run `npm run keygen` to generate one.');
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required. Get one at https://platform.openai.com/api-keys');
  }

  return {
    privateKey,
    network: (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet',
    facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.stacksx402.com',
    x402scanUrl: process.env.X402SCAN_URL || 'https://scan.stacksx402.com',
    maxSpendPerTask: BigInt(process.env.MAX_SPEND_PER_TASK || '100000'),
    maxSpendPerDay: BigInt(process.env.MAX_SPEND_PER_DAY || '1000000'),
    openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    port: parseInt(process.env.PORT || '3402', 10),
    logLevel: (process.env.LOG_LEVEL as PaygentConfig['logLevel']) || 'info',
  };
}

export const config = loadConfig();
