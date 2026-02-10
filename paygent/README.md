<div align="center">

# Paygent

### AI Agent Payment Orchestrator for the Agentic Economy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Stacks](https://img.shields.io/badge/Stacks-Testnet-purple.svg)](https://www.stacks.co/)
[![x402](https://img.shields.io/badge/x402-v2.0.0-green.svg)](https://github.com/stacksx402/x402-stacks)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)

[Demo](https://paygent.vercel.app) • [Documentation](#-documentation) • [API Reference](#-api-reference) • [Contributing](#-contributing)

<img src="docs/demo.gif" alt="Paygent Demo" width="800"/>

</div>

---

## Overview

**Paygent** is a production-ready AI agent payment orchestrator that enables autonomous micropayments for AI services on the Stacks blockchain. It implements the [x402 payment protocol](https://www.x402.org/) to facilitate machine-to-machine transactions, allowing AI agents to discover, evaluate, and pay for services without human intervention.

### The Problem

In the emerging agentic economy, AI agents need to:
- Access paid APIs and services autonomously
- Make micropayments without pre-configured credentials
- Orchestrate multi-step workflows across different services
- Maintain spending controls and audit trails

### The Solution

Paygent provides a complete infrastructure for autonomous agent payments:

```
User: "Research Bitcoin and publish findings"

Paygent:
  ├─ Step 1: Fetch news (0.001 STX) ──────► NewsAPI
  ├─ Step 2: Summarize content (0.002 STX) ► Groq AI
  ├─ Step 3: Analyze sentiment (0.0015 STX) ► Sentiment API
  └─ Step 4: Generate tweet (0.001 STX) ───► Content Generator

Total: 0.0055 STX | 4 blockchain transactions | ~30 seconds
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Step Pipelines** | Orchestrate complex workflows with data flowing between steps |
| **Real-Time Execution** | WebSocket-powered live updates with step-by-step progress |
| **Autonomous Payments** | x402 protocol handles 402 Payment Required responses automatically |
| **Spending Controls** | Per-task and daily limits with real-time tracking |
| **Service Discovery** | Automatic discovery of x402-enabled services |
| **Multiple Interfaces** | Modern React UI, REST API, CLI, and programmatic SDK |
| **Blockchain Verified** | Every payment creates an auditable on-chain transaction |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    PAYGENT                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐     ┌──────────────────────────────────────────────────────┐ │
│  │   Frontend   │     │                    Backend                            │ │
│  │  (React 18)  │────▶│  ┌─────────────────────────────────────────────────┐ │ │
│  │   Port 8080  │ WS  │  │              Orchestration Server                │ │ │
│  └──────────────┘     │  │                  Port 3402                       │ │ │
│                       │  │  ┌───────────┐ ┌───────────┐ ┌───────────────┐  │ │ │
│                       │  │  │  Pipeline │ │  Context  │ │   x402        │  │ │ │
│                       │  │  │  Engine   │ │  Manager  │ │   Payment     │  │ │ │
│                       │  │  └─────┬─────┘ └─────┬─────┘ └───────┬───────┘  │ │ │
│                       │  └────────┼─────────────┼───────────────┼──────────┘ │ │
│                       │           │             │               │            │ │
│                       │  ┌────────▼─────────────▼───────────────▼──────────┐ │ │
│                       │  │              Service Layer                       │ │ │
│                       │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │ │ │
│                       │  │  │Discovery│ │ Wallet  │ │ Payment │ │Spending│ │ │ │
│                       │  │  └────┬────┘ └────┬────┘ └────┬────┘ └───┬────┘ │ │ │
│                       │  └───────┼───────────┼───────────┼──────────┼──────┘ │ │
│                       └──────────┼───────────┼───────────┼──────────┼────────┘ │
│                                  │           │           │          │          │
│  ┌───────────────────────────────┼───────────┼───────────┼──────────┼────────┐ │
│  │                    External Services      │           │          │        │ │
│  │  ┌────────────┐  ┌────────────┐  ┌───────▼────┐  ┌───▼────┐            │ │
│  │  │ CoinGecko  │  │  NewsAPI   │  │   Groq AI  │  │ Stacks │            │ │
│  │  │  (Prices)  │  │  (News)    │  │   (LLM)    │  │Testnet │            │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────┘            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Overview

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | React 18, Vite, TailwindCSS, shadcn/ui | Modern UI with real-time pipeline visualization |
| **Orchestrator** | Express.js, WebSocket | Pipeline execution, context management, service coordination |
| **Demo Server** | Express.js | x402-enabled API endpoints for testing |
| **Payment Layer** | x402-stacks v2.0.0 | HTTP 402 payment handling with Stacks transactions |

---

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Stacks Testnet Wallet** with STX tokens

### Installation

```bash
# Clone the repository
git clone https://github.com/emmanuelist/paygent.git
cd paygent

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Configuration

1. **Generate a wallet** (if you don't have one):

```bash
npm run keygen
```

2. **Create environment file**:

```bash
cp .env.example .env
```

3. **Configure environment variables**:

```env
# Wallet Configuration
PAYGENT_PRIVATE_KEY=your_stacks_private_key

# API Keys
GROQ_API_KEY=your_groq_api_key          # AI processing
NEWS_API_KEY=your_newsapi_key           # News headlines
COINGECKO_API_KEY=your_coingecko_key    # Price data (optional)

# Network Configuration
NETWORK=testnet
FACILITATOR_URL=https://x402.org/facilitator

# Server Configuration
PORT=3402
DEMO_SERVER_PORT=3403
```

4. **Get Testnet STX**:

Visit [Stacks Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet) and request tokens.

### Running Locally

```bash
# Terminal 1: Start the demo server (x402-enabled APIs)
npm run demo-server

# Terminal 2: Start the orchestration server
npm run server

# Terminal 3: Start the frontend
cd frontend && npm run dev
```

Access the application at `http://localhost:8080`

---

## Usage

### Web Interface

The web interface provides a visual way to execute agent pipelines:

1. **Enter a query** in the search bar (e.g., "Research Bitcoin and publish findings")
2. **Watch real-time progress** as each step executes
3. **View results** including news, summaries, sentiment, and generated content
4. **Track transactions** with clickable Stacks Explorer links

### Example Queries

| Query | Steps | Est. Cost | Description |
|-------|-------|-----------|-------------|
| `Get current Bitcoin price` | 1 | ~0.001 STX | Simple price lookup |
| `Get Bitcoin news` | 1 | ~0.001 STX | Fetch latest headlines |
| `Summarize Bitcoin news` | 2 | ~0.003 STX | News + AI summary |
| `Research Bitcoin and publish findings` | 4 | ~0.01 STX | News → Summary → Sentiment → Tweet |
| `Full market intelligence analysis` | 5 | ~0.0125 STX | Price → News → Sentiment → Summary → Report |

### REST API

```bash
# Execute a pipeline
curl -X POST http://localhost:3402/task \
  -H "Content-Type: application/json" \
  -d '{"query": "Get Bitcoin price"}'

# Preview pipeline (no payment)
curl -X POST http://localhost:3402/preview \
  -H "Content-Type: application/json" \
  -d '{"query": "Research Bitcoin"}'

# List available services
curl http://localhost:3402/services

# Check wallet balance
curl http://localhost:3402/wallet

# Get spending summary
curl http://localhost:3402/spending
```

### Programmatic SDK

```typescript
import { Paygent, loadConfig } from 'paygent';

const config = loadConfig();
const agent = new Paygent(config);

// Execute a task
const result = await agent.executeTask('Get latest Bitcoin news');

if (result.success) {
  console.log('Data:', result.data);
  console.log('Cost:', result.payment?.amount, 'microSTX');
  console.log('TxID:', result.payment?.txId);
}

// With spending limits
const limitedResult = await agent.executeTask('Market analysis', {
  maxBudget: 10000,  // 0.01 STX max
  timeout: 60000,     // 60 second timeout
});
```

---

## API Reference

### WebSocket Events

Connect to `ws://localhost:3402` for real-time updates:

```typescript
// Client → Server
{
  type: 'execute',
  payload: {
    query: 'Research Bitcoin',
    maxBudget: 100000  // Optional: max microSTX
  }
}

// Server → Client: Pipeline start
{
  type: 'pipeline_start',
  payload: {
    id: 'pipeline-uuid',
    description: 'Research and publish workflow',
    steps: [...],
    estimatedCost: '0.01 STX'
  }
}

// Server → Client: Step progress
{
  type: 'step_start' | 'step_complete' | 'step_error',
  payload: {
    stepId: 'step-0',
    stepName: 'Fetch News',
    result?: { ... },
    error?: string,
    txId?: 'transaction-hash'
  }
}

// Server → Client: Pipeline complete
{
  type: 'pipeline_complete',
  payload: {
    success: true,
    totalCost: '0.01 STX',
    duration: 45000,
    results: [...]
  }
}
```

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/task` | Execute a pipeline |
| `POST` | `/preview` | Preview pipeline without payment |
| `GET` | `/services` | List available services |
| `GET` | `/wallet` | Get wallet balance and address |
| `GET` | `/spending` | Get spending summary |
| `GET` | `/health` | Health check |

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAYGENT_PRIVATE_KEY` | Yes | - | Stacks wallet private key (hex) |
| `GROQ_API_KEY` | Yes | - | Groq API key for AI processing |
| `NEWS_API_KEY` | Yes | - | NewsAPI key for news headlines |
| `COINGECKO_API_KEY` | No | - | CoinGecko API key (optional, has free tier) |
| `NETWORK` | No | `testnet` | `mainnet` or `testnet` |
| `FACILITATOR_URL` | No | `https://x402.org/facilitator` | x402 facilitator endpoint |
| `MAX_SPEND_PER_TASK` | No | `100000` | Max microSTX per task (0.1 STX) |
| `MAX_SPEND_PER_DAY` | No | `1000000` | Max microSTX per day (1 STX) |
| `PORT` | No | `3402` | Orchestration server port |
| `DEMO_SERVER_PORT` | No | `3403` | Demo API server port |

### Spending Limits

Configure spending limits to prevent runaway costs:

```typescript
// Per-task limit
const result = await agent.executeTask('Query', {
  maxBudget: 50000,  // 0.05 STX maximum
});

// Daily limit (environment variable)
MAX_SPEND_PER_DAY=1000000  // 1 STX per day

// Per-task default (environment variable)
MAX_SPEND_PER_TASK=100000  // 0.1 STX per task
```

---

## Project Structure

```
paygent/
├── src/
│   ├── agent/                 # Core Paygent agent
│   │   └── index.ts           # Agent orchestration logic
│   ├── config/                # Configuration management
│   │   └── index.ts           # Config loader and validator
│   ├── services/              # Service modules
│   │   ├── discovery.ts       # x402 service discovery
│   │   ├── selector.ts        # AI-powered service selection
│   │   ├── wallet.ts          # Stacks wallet management
│   │   ├── payment.ts         # x402 payment execution
│   │   └── spending.ts        # Spending tracker
│   ├── types/                 # TypeScript definitions
│   │   └── index.ts
│   ├── utils/                 # Utility functions
│   │   ├── formatting.ts      # Output formatting
│   │   ├── keygen.ts          # Wallet key generation
│   │   └── logger.ts          # Winston logger setup
│   ├── cli.ts                 # Command-line interface
│   ├── server.ts              # WebSocket orchestration server
│   ├── demo-server.ts         # x402-enabled demo APIs
│   └── index.ts               # Main exports
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── HeroSection.tsx
│   │   │   ├── PipelineView.tsx
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── hooks/             # Custom React hooks
│   │   │   └── usePipelineWebSocket.ts
│   │   ├── pages/             # Page components
│   │   │   └── Index.tsx
│   │   └── App.tsx
│   ├── public/                # Static assets
│   ├── package.json
│   └── vite.config.ts
├── docs/                      # Documentation
├── .env.example               # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Deployment

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env.example .env

EXPOSE 3402 3403

CMD ["node", "dist/server.js"]
```

```bash
# Build and run
docker build -t paygent .
docker run -p 3402:3402 -p 3403:3403 --env-file .env paygent
```

### Railway / Render

1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Configure build command: `npm run build`
4. Configure start command: `npm run server`

### Vercel (Frontend)

```bash
cd frontend
vercel --prod
```

Configure `VITE_WS_URL` to point to your deployed backend.

---

## Security Considerations

### Key Management

- **Never commit** `.env` files containing private keys
- Use **environment variables** in production
- Consider **hardware wallets** for mainnet deployments
- Rotate keys periodically

### Spending Controls

- Set **conservative limits** initially
- Monitor **daily spending** via the `/spending` endpoint
- Implement **alerts** for unusual activity

### Network Security

- Use **HTTPS** in production
- Implement **rate limiting** on public endpoints
- **Validate** all user inputs
- Use **CORS** restrictions

---

## Development

### Local Development

```bash
# Install all dependencies
npm install && cd frontend && npm install && cd ..

# Start in development mode with hot reload
npm run dev          # Backend
cd frontend && npm run dev  # Frontend
```

### Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd frontend && npm test

# Run with coverage
npm test -- --coverage
```

### Building

```bash
# Build backend
npm run build

# Build frontend
cd frontend && npm run build
```

### Code Style

```bash
# Lint
npm run lint

# Format (if prettier configured)
npm run format
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

---

## Troubleshooting

### Common Issues

**WebSocket connection failed**
```
Error: WebSocket connection to 'ws://localhost:3402' failed
```
Solution: Ensure the orchestration server is running on port 3402.

**Insufficient balance**
```
Error: Insufficient STX balance for transaction
```
Solution: Request tokens from the [Stacks Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet).

**API rate limit**
```
Error: 429 Too Many Requests
```
Solution: Add API keys to `.env` or wait for rate limit reset.

---

## Roadmap

- [ ] **Multi-chain Support** - Extend to other x402-compatible chains
- [ ] **Plugin System** - Custom service integrations
- [ ] **Agent Memory** - Persistent context across sessions
- [ ] **Batch Operations** - Execute multiple queries efficiently
- [ ] **Advanced Analytics** - Spending insights and optimization
- [ ] **Mobile App** - React Native companion app

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [x402 Protocol](https://x402.org) - HTTP 402 payment standard
- [x402-stacks](https://github.com/stacksx402/x402-stacks) - Stacks implementation
- [Stacks Foundation](https://stacks.org) - Blockchain infrastructure
- [Groq](https://groq.com) - AI inference
- [CoinGecko](https://coingecko.com) - Cryptocurrency data
- [NewsAPI](https://newsapi.org) - News aggregation

---

<div align="center">

**[Website](https://paygent.dev)** • **[Documentation](https://docs.paygent.dev)** • **[Discord](https://discord.gg/paygent)** • **[Twitter](https://twitter.com/paygent_ai)**

Built with ❤️ for the Agentic Economy

*Submitted to the [x402 Stacks Hackathon](https://dorahacks.io/hackathon/x402-stacks/detail)*

</div>
