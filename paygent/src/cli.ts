#!/usr/bin/env ts-node
/**
 * Paygent CLI
 * Interactive command-line interface for the AI Payment Agent
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './config';
import { Paygent, OrchestratorEvents } from './agent';
import { formatSTX, formatPrice, truncateAddress } from './utils/formatting';
import { TaskPlan, TaskStep, StepResult, PipelineResult } from './types';

const program = new Command();

// ASCII Art Logo
const logo = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('🤖 PAYGENT')} - ${chalk.yellow('AI Payment Agent for x402')}              ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Autonomous multi-step task execution with payments')}      ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════╝')}
`;

let agent: Paygent;

async function initAgent() {
  try {
    const config = loadConfig();
    agent = new Paygent(config);
    return true;
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Failed to initialize: ${error.message}\n`));
    return false;
  }
}

program
  .name('paygent')
  .description('AI Payment Agent - Autonomous payments for the agentic economy')
  .version('1.0.0');

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    console.log(logo);
    
    if (!await initAgent()) return;

    const walletInfo = await agent.getWalletInfo();
    console.log(chalk.gray(`Network: ${walletInfo.network}`));
    console.log(chalk.gray(`Wallet: ${walletInfo.address}`));
    console.log(chalk.gray(`Balance: ${formatSTX(walletInfo.balances.stx)}\n`));

    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🎯 Execute a single task', value: 'task' },
            { name: '🔗 Execute a multi-step pipeline', value: 'pipeline' },
            { name: '🔍 Discover services', value: 'discover' },
            { name: '💰 Check wallet', value: 'wallet' },
            { name: '📊 Spending summary', value: 'spending' },
            { name: '📜 History', value: 'history' },
            { name: '👋 Exit', value: 'exit' },
          ],
        },
      ]);

      if (action === 'exit') {
        console.log(chalk.cyan('\nGoodbye! 👋\n'));
        break;
      }

      await handleAction(action);
    }
  });

// Execute task command
program
  .command('task <query>')
  .description('Execute a task and pay for the best service')
  .option('-b, --budget <amount>', 'Maximum budget in STX', '0.1')
  .option('-y, --yes', 'Auto-approve payment without confirmation')
  .action(async (query: string, options) => {
    if (!await initAgent()) return;

    const spinner = ora('Processing task...').start();

    try {
      const budget = BigInt(Math.floor(parseFloat(options.budget) * 1_000_000));
      
      const result = await agent.executeTask(query, {
        maxBudget: budget,
        autoApprove: options.yes,
      });

      spinner.stop();

      if (result.success) {
        console.log(chalk.green('\n✅ Task completed successfully!\n'));
        console.log(chalk.gray('Service:'), result.service?.name);
        console.log(chalk.gray('Cost:'), formatPrice(
          result.payment?.amount?.toString() || '0',
          result.payment?.asset || 'STX'
        ));
        if (result.payment?.explorerUrl) {
          console.log(chalk.gray('Explorer:'), result.payment.explorerUrl);
        }
        console.log(chalk.gray('\nResponse:'));
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.log(chalk.red(`\n❌ Task failed: ${result.error}\n`));
      }
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
    }
  });

// Discover services command
program
  .command('discover [query]')
  .description('Discover available x402 services')
  .action(async (query?: string) => {
    if (!await initAgent()) return;

    const spinner = ora('Discovering services...').start();

    try {
      const services = await agent.discoverServices(query);
      spinner.stop();

      console.log(chalk.cyan(`\n📡 Found ${services.length} services:\n`));

      for (const service of services) {
        console.log(chalk.bold(service.name));
        console.log(chalk.gray(`  ${service.description}`));
        console.log(chalk.yellow(`  Price: ${formatPrice(service.price.amount, service.price.asset)}`));
        console.log(chalk.gray(`  URL: ${service.url}`));
        console.log();
      }
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
    }
  });

// Wallet command
program
  .command('wallet')
  .description('Show wallet information')
  .action(async () => {
    if (!await initAgent()) return;

    const spinner = ora('Fetching wallet info...').start();

    try {
      const info = await agent.getWalletInfo();
      spinner.stop();

      console.log(chalk.cyan('\n💳 Wallet Information:\n'));
      console.log(chalk.gray('Address:'), info.address);
      console.log(chalk.gray('Network:'), info.network);
      console.log(chalk.gray('STX Balance:'), formatSTX(info.balances.stx));
      if (info.balances.sbtc) {
        console.log(chalk.gray('sBTC Balance:'), `${Number(info.balances.sbtc) / 100_000_000} sBTC`);
      }
      console.log();
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
    }
  });

// Spending command
program
  .command('spending')
  .description('Show spending summary')
  .action(async () => {
    if (!await initAgent()) return;

    const summary = agent.getSpendingSummary();

    console.log(chalk.cyan('\n📊 Spending Summary:\n'));
    console.log(chalk.bold('Today:'));
    console.log(chalk.gray('  Total:'), formatSTX(summary.today.total));
    console.log(chalk.gray('  Transactions:'), summary.today.transactions);
    console.log(chalk.gray('  Remaining:'), formatSTX(summary.limits.remainingToday));
    
    console.log(chalk.bold('\nLimits:'));
    console.log(chalk.gray('  Per Task:'), formatSTX(summary.limits.perTask));
    console.log(chalk.gray('  Per Day:'), formatSTX(summary.limits.perDay));
    
    console.log(chalk.bold('\nAll Time:'));
    console.log(chalk.gray('  Total:'), formatSTX(summary.allTime.total));
    console.log(chalk.gray('  Transactions:'), summary.allTime.transactions);
    console.log();
  });

// Pipeline command - execute multi-step tasks
program
  .command('pipeline <query>')
  .description('Execute a multi-step pipeline task')
  .option('-b, --budget <amount>', 'Maximum budget in STX', '0.1')
  .option('-s, --steps <number>', 'Maximum number of steps', '5')
  .option('-y, --yes', 'Auto-approve without confirmation')
  .option('-p, --preview', 'Preview the plan without executing')
  .action(async (query: string, options) => {
    if (!await initAgent()) return;

    const budget = BigInt(Math.floor(parseFloat(options.budget) * 1_000_000));
    const maxSteps = parseInt(options.steps, 10);

    console.log(chalk.cyan('\n🤖 Paygent Pipeline Executor\n'));
    console.log(chalk.gray(`Query: "${query}"`));
    console.log(chalk.gray(`Budget: ${formatSTX(budget)}`));
    console.log(chalk.gray(`Max Steps: ${maxSteps}\n`));

    if (options.preview) {
      const spinner = ora('Creating execution plan...').start();
      try {
        const plan = await agent.previewPipeline(query, { maxBudget: budget, maxSteps });
        spinner.stop();

        if (!plan) {
          console.log(chalk.yellow('Could not create a plan for this query.\n'));
          return;
        }

        displayPlan(plan);
      } catch (error: any) {
        spinner.fail(`Error: ${error.message}`);
      }
      return;
    }

    // Execute the pipeline with live updates
    console.log(chalk.cyan('═'.repeat(60)));
    
    const spinner = ora('Initializing pipeline...').start();

    try {
      const result = await agent.executePipeline(query, {
        maxBudget: budget,
        maxSteps,
        autoApprove: options.yes,
      });

      spinner.stop();

      if (result.success) {
        console.log(chalk.green('\n✅ Pipeline completed successfully!\n'));
        
        // Show summary
        console.log(chalk.bold('📊 Summary:'));
        console.log(chalk.gray(`  Steps executed: ${result.stepResults.length}`));
        console.log(chalk.gray(`  Total cost: ${formatSTX(result.totalCost)}`));
        console.log(chalk.gray(`  Duration: ${(result.timing.durationMs / 1000).toFixed(1)}s`));
        
        // Show each step result
        console.log(chalk.bold('\n📋 Step Results:'));
        result.stepResults.forEach((step, i) => {
          const icon = step.success ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${icon} Step ${i + 1}: ${step.success ? 'Success' : 'Failed'}`);
          if (step.payment?.txId) {
            console.log(chalk.gray(`    TX: ${step.payment.txId.slice(0, 20)}...`));
          }
        });
        
        // Show final output
        if (result.finalOutput) {
          console.log(chalk.bold('\n📤 Final Output:'));
          console.log(JSON.stringify(result.finalOutput, null, 2));
        }
      } else {
        console.log(chalk.red(`\n❌ Pipeline failed: ${result.error}\n`));
      }
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
    }
  });

// History command
program
  .command('history')
  .description('Show execution history')
  .option('-n, --limit <number>', 'Number of entries to show', '10')
  .action(async (options) => {
    if (!await initAgent()) return;

    const history = agent.getHistory(parseInt(options.limit, 10));

    console.log(chalk.cyan('\n📜 Execution History:\n'));

    if (history.length === 0) {
      console.log(chalk.gray('No history yet.\n'));
      return;
    }

    history.forEach((entry, i) => {
      const icon = entry.success ? chalk.green('✓') : chalk.red('✗');
      console.log(`${i + 1}. ${icon} ${entry.query.slice(0, 50)}...`);
      console.log(chalk.gray(`   Cost: ${formatSTX(entry.totalCost)} | Steps: ${entry.stepResults.length}`));
      console.log(chalk.gray(`   Time: ${entry.timing.startedAt.toLocaleString()}`));
      console.log();
    });
  });

// Helper to display a plan
function displayPlan(plan: TaskPlan) {
  console.log(chalk.cyan('\n📋 Execution Plan:\n'));
  console.log(chalk.bold(plan.description));
  console.log(chalk.gray(`Estimated cost: ${formatSTX(plan.estimatedTotalCost)}\n`));

  plan.steps.forEach((step, i) => {
    const required = step.required !== false ? chalk.green('●') : chalk.yellow('○');
    console.log(`${required} Step ${i + 1}: ${step.description}`);
    console.log(chalk.gray(`   Service: ${step.serviceId}`));
    if (step.estimatedCost) {
      console.log(chalk.gray(`   Cost: ${formatSTX(step.estimatedCost)}`));
    }
  });

  console.log();
}

// Handle interactive actions
async function handleAction(action: string) {
  switch (action) {
    case 'task':
      const { query } = await inquirer.prompt([
        {
          type: 'input',
          name: 'query',
          message: 'What do you need?',
        },
      ]);

      if (!query) return;

      const spinner = ora('Finding best service...').start();
      
      try {
        const preview = await agent.previewTask(query);
        spinner.stop();

        if (preview.services.length === 0) {
          console.log(chalk.yellow('\nNo matching services found.\n'));
          return;
        }

        if (preview.recommended) {
          console.log(chalk.cyan('\n📋 Recommended service:'));
          console.log(chalk.bold(`  ${preview.recommended.name}`));
          console.log(chalk.gray(`  ${preview.recommended.description}`));
          console.log(chalk.yellow(`  Cost: ${preview.estimatedCost}`));
          console.log(chalk.gray(`  Can afford: ${preview.canAfford ? '✅ Yes' : '❌ No'}`));

          if (preview.canAfford) {
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: 'Proceed with payment?',
                default: true,
              },
            ]);

            if (confirm) {
              const execSpinner = ora('Executing task...').start();
              const result = await agent.executeTask(query);
              execSpinner.stop();

              if (result.success) {
                console.log(chalk.green('\n✅ Success!\n'));
                console.log(chalk.gray('Response:'));
                console.log(JSON.stringify(result.data, null, 2));
                if (result.payment?.explorerUrl) {
                  console.log(chalk.gray('\nTransaction:'), result.payment.explorerUrl);
                }
              } else {
                console.log(chalk.red(`\n❌ Failed: ${result.error}\n`));
              }
            }
          }
        }
      } catch (error: any) {
        spinner.stop();
        console.log(chalk.red(`\nError: ${error.message}\n`));
      }
      break;

    case 'discover':
      const { searchQuery } = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchQuery',
          message: 'Search query (or press Enter for all):',
        },
      ]);

      const discoverSpinner = ora('Searching...').start();
      const services = await agent.discoverServices(searchQuery || undefined);
      discoverSpinner.stop();

      console.log(chalk.cyan(`\n📡 Found ${services.length} services:\n`));
      for (const service of services.slice(0, 10)) {
        console.log(`  ${chalk.bold(service.name)} - ${formatPrice(service.price.amount, service.price.asset)}`);
        console.log(chalk.gray(`    ${service.description.slice(0, 60)}...`));
      }
      if (services.length > 10) {
        console.log(chalk.gray(`  ... and ${services.length - 10} more`));
      }
      console.log();
      break;

    case 'wallet':
      const walletSpinner = ora('Fetching...').start();
      const info = await agent.getWalletInfo();
      walletSpinner.stop();

      console.log(chalk.cyan('\n💳 Wallet:\n'));
      console.log(`  Address: ${info.address}`);
      console.log(`  Network: ${info.network}`);
      console.log(`  STX: ${formatSTX(info.balances.stx)}`);
      console.log();
      break;

    case 'spending':
      const summary = agent.getSpendingSummary();
      console.log(chalk.cyan('\n📊 Today\'s Spending:\n'));
      console.log(`  Spent: ${formatSTX(summary.today.total)}`);
      console.log(`  Transactions: ${summary.today.transactions}`);
      console.log(`  Remaining: ${formatSTX(summary.limits.remainingToday)}`);
      console.log();
      break;

    case 'pipeline':
      const { pipelineQuery } = await inquirer.prompt([
        {
          type: 'input',
          name: 'pipelineQuery',
          message: 'Describe your multi-step task:',
          default: 'Get Bitcoin news, summarize it, and create a tweet',
        },
      ]);

      if (!pipelineQuery) return;

      // Show plan first
      const planSpinner = ora('Creating execution plan...').start();
      
      try {
        const plan = await agent.previewPipeline(pipelineQuery);
        planSpinner.stop();

        if (!plan) {
          console.log(chalk.yellow('\nCould not create a plan for this task.\n'));
          return;
        }

        displayPlan(plan);

        const { confirmPipeline } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmPipeline',
            message: `Execute this ${plan.steps.length}-step pipeline for ${formatSTX(plan.estimatedTotalCost)}?`,
            default: true,
          },
        ]);

        if (confirmPipeline) {
          console.log(chalk.cyan('\n🚀 Executing pipeline...\n'));
          
          const result = await agent.executePipeline(pipelineQuery);

          if (result.success) {
            console.log(chalk.green('\n✅ Pipeline completed!\n'));
            console.log(chalk.gray(`Steps: ${result.stepResults.length}`));
            console.log(chalk.gray(`Total cost: ${formatSTX(result.totalCost)}`));
            console.log(chalk.gray(`Duration: ${(result.timing.durationMs / 1000).toFixed(1)}s`));
            
            if (result.finalOutput) {
              console.log(chalk.bold('\n📤 Result:'));
              console.log(JSON.stringify(result.finalOutput, null, 2));
            }
          } else {
            console.log(chalk.red(`\n❌ Pipeline failed: ${result.error}\n`));
          }
        }
      } catch (error: any) {
        planSpinner.stop();
        console.log(chalk.red(`\nError: ${error.message}\n`));
      }
      break;

    case 'history':
      const historyResults = agent.getHistory(10);
      console.log(chalk.cyan('\n📜 Recent Executions:\n'));
      
      if (historyResults.length === 0) {
        console.log(chalk.gray('No history yet.\n'));
      } else {
        historyResults.forEach((entry, i) => {
          const icon = entry.success ? chalk.green('✓') : chalk.red('✗');
          console.log(`${i + 1}. ${icon} ${entry.query.slice(0, 40)}...`);
          console.log(chalk.gray(`   ${formatSTX(entry.totalCost)} | ${entry.stepResults.length} steps`));
        });
        console.log();
      }
      break;
  }
}

// Parse arguments
program.parse();

// Default to interactive if no command
if (!process.argv.slice(2).length) {
  program.parseAsync(['', '', 'interactive']);
}
