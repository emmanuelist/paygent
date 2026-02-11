import winston from 'winston';
import chalk from 'chalk';

const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const levelColors: Record<string, (s: string) => string> = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.blue,
    debug: chalk.gray,
  };
  
  const colorize = levelColors[level] || chalk.white;
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  
  return `${chalk.gray(timestamp)} ${colorize(level.toUpperCase().padEnd(5))} ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Pretty print for agent actions
export const agentLog = {
  task: (msg: string) => console.log(chalk.cyan('🎯 ') + msg),
  discover: (msg: string) => console.log(chalk.magenta('🔍 ') + msg),
  select: (msg: string) => console.log(chalk.yellow('⚡ ') + msg),
  pay: (msg: string) => console.log(chalk.green('💰 ') + msg),
  success: (msg: string) => console.log(chalk.green('✅ ') + msg),
  error: (msg: string) => console.log(chalk.red('❌ ') + msg),
  info: (msg: string) => console.log(chalk.blue('ℹ️  ') + msg),
  thinking: (msg: string) => console.log(chalk.gray('🤔 ') + msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠️  ') + msg),
  step: (msg: string) => console.log(chalk.cyan('📍 ') + msg),
  plan: (msg: string) => console.log(chalk.magenta('📋 ') + msg),
  chain: (msg: string) => console.log(chalk.blue('🔗 ') + msg),
};
