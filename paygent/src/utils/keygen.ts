#!/usr/bin/env ts-node
/**
 * Paygent Key Generator
 * Generates a new Stacks wallet for the agent
 */

import { generateKeypair } from 'x402-stacks';
import chalk from 'chalk';

async function main() {
  console.log(chalk.cyan('\n🔐 Paygent Key Generator\n'));
  console.log(chalk.gray('Generating new Stacks wallet...\n'));

  // Generate testnet keypair
  const testnetKeypair = generateKeypair('testnet');
  
  // Generate mainnet keypair (same private key, different address format)
  const mainnetKeypair = generateKeypair('mainnet');

  console.log(chalk.green('✅ Wallet generated successfully!\n'));
  
  console.log(chalk.yellow('📋 Add this to your .env file:\n'));
  console.log(chalk.white(`PAYGENT_PRIVATE_KEY=${testnetKeypair.privateKey}\n`));

  console.log(chalk.cyan('📍 Wallet Addresses:'));
  console.log(chalk.gray('  Testnet:'), chalk.white(testnetKeypair.address));
  console.log(chalk.gray('  Mainnet:'), chalk.white(mainnetKeypair.address));

  console.log(chalk.cyan('\n💰 Get testnet STX:'));
  console.log(chalk.gray('  1. Go to https://platform.hiro.so'));
  console.log(chalk.gray('  2. Click on "Faucet" tab'));
  console.log(chalk.gray('  3. Paste your testnet address'));
  console.log(chalk.gray('  4. Request STX tokens\n'));

  console.log(chalk.red('⚠️  IMPORTANT: Keep your private key secret!'));
  console.log(chalk.red('   Never commit .env to git.\n'));
}

main().catch(console.error);
