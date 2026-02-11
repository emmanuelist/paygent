/**
 * Formatting utilities for Paygent
 */

import { STXtoMicroSTX } from 'x402-stacks';

/**
 * Convert microSTX to human-readable STX string
 */
export function formatSTX(microSTX: bigint | string | number): string {
  const amount = BigInt(microSTX);
  const stx = Number(amount) / 1_000_000;
  return `${stx.toFixed(6)} STX`;
}

/**
 * Convert STX to microSTX
 */
export function toMicroSTX(stx: number): bigint {
  return BigInt(STXtoMicroSTX(stx));
}

/**
 * Format satoshis to readable BTC string
 */
export function formatSats(sats: bigint | string | number): string {
  const amount = BigInt(sats);
  const btc = Number(amount) / 100_000_000;
  if (btc < 0.001) {
    return `${amount} sats`;
  }
  return `${btc.toFixed(8)} sBTC`;
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Get Stacks explorer URL for a transaction
 */
export function getExplorerUrl(txId: string, network: 'mainnet' | 'testnet'): string {
  const base = 'https://explorer.hiro.so/txid';
  const chain = network === 'mainnet' ? '' : '?chain=testnet';
  return `${base}/${txId}${chain}`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

/**
 * Format price for display
 */
export function formatPrice(amount: string, asset: string): string {
  const num = BigInt(amount);
  
  switch (asset.toUpperCase()) {
    case 'STX':
      return formatSTX(num);
    case 'SBTC':
      return formatSats(num);
    case 'USDCX':
      return `$${(Number(num) / 1_000_000).toFixed(4)}`;
    default:
      return `${amount} ${asset}`;
  }
}
