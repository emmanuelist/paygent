/**
 * Paygent - AI Payment Agent
 * Autonomous payments for the agentic economy on Stacks
 * 
 * @packageDocumentation
 */

// Main exports
export { Paygent, createPaygent } from './agent';
export { loadConfig, PaygentConfig } from './config';

// Services
export { ServiceDiscovery } from './services/discovery';
export { ServiceSelector } from './services/selector';
export { WalletService } from './services/wallet';
export { PaymentService } from './services/payment';
export { SpendingTracker } from './services/spending';

// Types
export * from './types';

// Utilities
export { logger, agentLog } from './utils/logger';
export * from './utils/formatting';

// Quick start helper
import { loadConfig } from './config';
import { Paygent } from './agent';

/**
 * Quick start - create a Paygent instance with default config
 * 
 * @example
 * ```typescript
 * import { quickStart } from 'paygent';
 * 
 * const agent = quickStart();
 * const result = await agent.executeTask('Get Bitcoin price');
 * console.log(result.data);
 * ```
 */
export function quickStart(): Paygent {
  const config = loadConfig();
  return new Paygent(config);
}

// Default export
export default Paygent;
