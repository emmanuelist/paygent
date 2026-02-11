/**
 * Paygent Demo Server - Enhanced
 * A comprehensive x402-enabled API server for testing and demo purposes
 * 
 * Features:
 * - Multiple AI-like services that can be chained together
 * - Services accept input from previous steps
 * - Real API integrations when keys are available
 * - Compelling demo scenarios for hackathon
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { 
  x402PaymentRequired, 
  getPayment, 
  STXtoMicroSTX,
} from 'x402-stacks';
import {
  getBitcoinPrice,
  getStxPrice,
  getBitcoinNews,
  getStacksNews,
  summarizeText,
  analyzeSentiment,
  generateTweet,
  translateText,
} from './real-apis';

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.DEMO_PORT || 3403;
const NETWORK = (process.env.NETWORK as 'mainnet' | 'testnet') || 'testnet';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.stacksx402.com';
const SERVER_ADDRESS = process.env.DEMO_SERVER_ADDRESS || 'STN4H5970V9BBN5MKBCNVRB9HE9QZH00X0F558NC';

// Helper to safely extract transaction ID
function getPaymentTxId(payment: unknown): string | undefined {
  if (!payment || typeof payment !== 'object') return undefined;
  const p = payment as Record<string, unknown>;
  return (p.txId || p.transaction || p.tx_id) as string | undefined;
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🤖 Paygent Demo x402 Server - Enhanced Edition          ║
╠═══════════════════════════════════════════════════════════╣
║  Network:     ${NETWORK.padEnd(42)}║
║  Facilitator: ${FACILITATOR_URL.slice(0, 42).padEnd(42)}║
║  Payment to:  ${SERVER_ADDRESS.slice(0, 42).padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
`);

// ============================================
// FREE ENDPOINTS
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'paygent-demo-server',
    network: NETWORK,
    version: '2.0.0',
  });
});

app.get('/x402.json', (req: Request, res: Response) => {
  res.json({
    name: 'Paygent Demo Server',
    description: 'AI-like x402 API endpoints for testing multi-step pipelines',
    version: '2.0.0',
    endpoints: [
      { path: '/api/news/bitcoin', method: 'GET', price: { amount: '1000', asset: 'STX' }, description: 'Get Bitcoin news' },
      { path: '/api/news/stacks', method: 'GET', price: { amount: '1000', asset: 'STX' }, description: 'Get Stacks news' },
      { path: '/api/summarize', method: 'POST', price: { amount: '2000', asset: 'STX' }, description: 'Summarize text content' },
      { path: '/api/sentiment', method: 'POST', price: { amount: '1500', asset: 'STX' }, description: 'Analyze sentiment' },
      { path: '/api/generate/tweet', method: 'POST', price: { amount: '1000', asset: 'STX' }, description: 'Generate a tweet' },
      { path: '/api/generate/report', method: 'POST', price: { amount: '3000', asset: 'STX' }, description: 'Generate a report' },
      { path: '/api/translate', method: 'POST', price: { amount: '1500', asset: 'STX' }, description: 'Translate text' },
      { path: '/api/price/bitcoin', method: 'GET', price: { amount: '500', asset: 'STX' }, description: 'Get BTC price' },
      { path: '/api/price/stx', method: 'GET', price: { amount: '500', asset: 'STX' }, description: 'Get STX price' },
      { path: '/api/blockchain/info', method: 'GET', price: { amount: '500', asset: 'STX' }, description: 'Get chain info' },
    ],
  });
});

// ============================================
// NEWS SERVICES
// ============================================

/**
 * Bitcoin News API - 0.001 STX
 */
app.get(
  '/api/news/bitcoin',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.001),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    
    // Fetch real news if API keys are available
    const newsData = await getBitcoinNews();

    res.json({
      success: true,
      type: 'news',
      topic: 'bitcoin',
      data: {
        headlines: newsData.headlines,
        summary: newsData.summary,
        overallSentiment: newsData.overallSentiment,
        isRealData: newsData.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '1000 microSTX' },
    });
  }
);

/**
 * Stacks News API - 0.001 STX
 */
app.get(
  '/api/news/stacks',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.001),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    
    // Fetch real news if API keys are available
    const newsData = await getStacksNews();

    res.json({
      success: true,
      type: 'news',
      topic: 'stacks',
      data: {
        headlines: newsData.headlines,
        summary: newsData.summary,
        overallSentiment: newsData.overallSentiment,
        isRealData: newsData.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '1000 microSTX' },
    });
  }
);

// ============================================
// AI-LIKE PROCESSING SERVICES
// ============================================

/**
 * Summarize API - 0.002 STX
 * Accepts text and returns a summary
 */
app.post(
  '/api/summarize',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.002),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    const { text, input, data } = req.body;
    
    // Parse input if it's a JSON string (from pipeline chaining)
    let parsedInput = input;
    if (typeof input === 'string' && input.startsWith('{')) {
      try {
        parsedInput = JSON.parse(input);
      } catch { /* keep as string */ }
    }
    
    // Extract content from various input formats
    let content = '';
    if (text) {
      content = text;
    } else if (parsedInput?.data?.headlines) {
      content = parsedInput.data.headlines.map((h: any) => h.title).join('. ');
    } else if (data?.headlines) {
      content = data.headlines.map((h: any) => h.title).join('. ');
    } else if (parsedInput?.data?.summary) {
      content = parsedInput.data.summary;
    } else if (typeof parsedInput === 'string') {
      content = parsedInput;
    } else {
      content = 'No content provided';
    }
    
    // Use real AI summarization
    const summaryResult = await summarizeText(content);

    res.json({
      success: true,
      type: 'summary',
      data: {
        originalLength: content.length,
        summary: summaryResult.summary,
        keyPoints: summaryResult.keyPoints,
        isRealData: summaryResult.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '2000 microSTX' },
    });
  }
);

/**
 * Sentiment Analysis API - 0.0015 STX
 */
app.post(
  '/api/sentiment',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.0015),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    const { text, input, data } = req.body;
    
    const content = text || input || data?.summary || '';
    
    // Use real AI sentiment analysis
    const sentimentResult = await analyzeSentiment(content);

    res.json({
      success: true,
      type: 'sentiment',
      data: {
        sentiment: sentimentResult.sentiment,
        score: sentimentResult.score,
        confidence: sentimentResult.confidence,
        isRealData: sentimentResult.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '1500 microSTX' },
    });
  }
);

/**
 * Tweet Generator API - 0.001 STX
 */
app.post(
  '/api/generate/tweet',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.001),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    const { text, input, data, topic, style } = req.body;
    
    // Parse input if it's a JSON string (from pipeline chaining)
    let parsedInput = input;
    if (typeof input === 'string' && input.startsWith('{')) {
      try {
        parsedInput = JSON.parse(input);
      } catch { /* keep as string */ }
    }
    
    // Extract meaningful content from various input formats
    let content = '';
    if (text) {
      content = text;
    } else if (parsedInput?.data?.headlines?.[0]?.title) {
      content = parsedInput.data.headlines[0].title;
    } else if (parsedInput?.data?.summary) {
      content = parsedInput.data.summary;
    } else if (parsedInput?.summary) {
      content = parsedInput.summary;
    } else if (data?.headlines?.[0]?.title) {
      content = data.headlines[0].title;
    } else if (data?.summary) {
      content = data.summary;
    } else if (topic) {
      content = topic;
    } else {
      content = 'Amazing things happening in crypto';
    }
    
    const tweetStyle = style || 'enthusiastic';
    
    // Use real AI to generate tweet
    const tweetResult = await generateTweet(content, tweetStyle);

    res.json({
      success: true,
      type: 'generated_content',
      contentType: 'tweet',
      data: {
        tweet: tweetResult.tweet,
        characterCount: tweetResult.tweet.length,
        hashtags: tweetResult.hashtags,
        style: tweetStyle,
        isRealData: tweetResult.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '1000 microSTX' },
    });
  }
);

/**
 * Report Generator API - 0.003 STX
 */
app.post(
  '/api/generate/report',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.003),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req: Request, res: Response) => {
    const payment = getPayment(req);
    const { data, input, text, topic, format } = req.body;
    
    // Extract meaningful content from pipeline data
    const inputData = data || {};
    const reportTopic = topic || inputData.topic || 'Market Analysis';
    
    // Look for enriched data from pipeline context
    let priceInfo = '';
    let summaryContent = inputData.summary || inputData.summaryData?.summary || '';
    let headlines: any[] = inputData.headlines || inputData.newsData?.headlines || [];
    let sentiment = inputData.sentiment || inputData.sentimentData?.sentiment || '';
    let sentimentScore = inputData.score || inputData.sentimentData?.score || 85;
    
    // Extract price info from enriched data
    if (inputData.priceData) {
      const p = inputData.priceData;
      priceInfo = `Bitcoin is currently trading at $${p.price} with a ${p.change24h || '0%'} change in the last 24 hours. `;
      priceInfo += `The 24-hour trading range is $${p.low24h} - $${p.high24h}. `;
    }
    
    // If we have a text field (from extractContextData), parse meaningful parts
    if (text && typeof text === 'string') {
      // Try to extract price info if not already set
      if (!priceInfo) {
        const priceMatch = text.match(/Price:\s*\$?([\d,]+)/i);
        const changeMatch = text.match(/\(([-+]?\d+\.?\d*%?)\s*24h/i);
        if (priceMatch) {
          priceInfo = `Bitcoin Price: $${priceMatch[1]}${changeMatch ? ` (${changeMatch[1]})` : ''}. `;
        }
      }
      
      // Try to extract headlines if not already set
      if (headlines.length === 0) {
        const headlineMatches = text.match(/^\d+\.\s+(.+)$/gm);
        if (headlineMatches && headlineMatches.length > 0) {
          headlines = headlineMatches.map(h => ({ title: h.replace(/^\d+\.\s+/, '').split(' - ')[0] }));
        }
      }
      
      // Try to extract sentiment if not already set
      if (!sentiment) {
        const sentimentMatch = text.match(/Sentiment.*?:\s*(POSITIVE|NEGATIVE|NEUTRAL)/i);
        if (sentimentMatch) {
          sentiment = sentimentMatch[1].toLowerCase();
        }
        const scoreMatch = text.match(/score\s*(\d+)/i);
        if (scoreMatch) {
          sentimentScore = parseInt(scoreMatch[1]);
        }
      }
    }

    // Build market overview from all available data
    let marketOverview = priceInfo;
    if (summaryContent) {
      marketOverview += summaryContent;
    } else {
      marketOverview += 'The cryptocurrency market continues to show strong momentum with increasing institutional participation.';
    }

    const report = {
      title: `${reportTopic} Report - ${new Date().toLocaleDateString()}`,
      executive_summary: 'This automated report provides a comprehensive analysis of the current market conditions and emerging trends in the cryptocurrency ecosystem.',
      sections: [
        {
          heading: 'Market Overview',
          content: marketOverview,
        },
        {
          heading: 'Key Developments',
          content: headlines.length > 0
            ? headlines.slice(0, 3).map((h: any) => `• ${h.title || h}`).join('\n')
            : '• Significant technological upgrades\n• Growing institutional adoption\n• Expanding DeFi ecosystem',
        },
        {
          heading: 'Sentiment Analysis',
          content: sentiment 
            ? `Overall market sentiment is ${sentiment} with a confidence score of ${sentimentScore}%.`
            : 'Overall market sentiment remains positive with strong investor confidence.',
        },
        {
          heading: 'Recommendations',
          content: '1. Monitor institutional flows\n2. Track DeFi growth metrics\n3. Stay updated on protocol upgrades',
        },
      ],
      generated_at: new Date().toISOString(),
      word_count: 250,
    };

    res.json({
      success: true,
      type: 'generated_content',
      contentType: 'report',
      data: report,
      payment: { txId: getPaymentTxId(payment), amount: '3000 microSTX' },
    });
  }
);

/**
 * Translation API - 0.0015 STX
 */
app.post(
  '/api/translate',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.0015),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    const { text, input, targetLanguage } = req.body;
    
    const content = text || input || 'No text provided';
    const lang = targetLanguage || 'es';
    
    // Use real AI translation
    const translationResult = await translateText(content, lang);

    res.json({
      success: true,
      type: 'translation',
      data: {
        original: content,
        translated: translationResult.translated,
        sourceLanguage: 'en',
        targetLanguage: lang,
        isRealData: translationResult.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '1500 microSTX' },
    });
  }
);

// ============================================
// MARKET DATA SERVICES
// ============================================

/**
 * Bitcoin Price API - 0.0005 STX
 */
app.get(
  '/api/price/bitcoin',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.0005),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    
    // Fetch real price from CoinGecko
    const priceData = await getBitcoinPrice();

    res.json({
      success: true,
      type: 'price',
      asset: 'BTC',
      data: {
        price: priceData.price,
        currency: 'USD',
        change24h: priceData.change24h,
        high24h: priceData.high24h,
        low24h: priceData.low24h,
        volume24h: priceData.volume24h,
        marketCap: priceData.marketCap,
        isRealData: priceData.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '500 microSTX' },
    });
  }
);

/**
 * STX Price API - 0.0005 STX
 */
app.get(
  '/api/price/stx',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.0005),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    
    // Fetch real price from CoinGecko
    const priceData = await getStxPrice();

    res.json({
      success: true,
      type: 'price',
      asset: 'STX',
      data: {
        price: priceData.price,
        currency: 'USD',
        change24h: priceData.change24h,
        high24h: priceData.high24h,
        low24h: priceData.low24h,
        volume24h: priceData.volume24h,
        marketCap: priceData.marketCap,
        isRealData: priceData.isReal,
        timestamp: new Date().toISOString(),
      },
      payment: { txId: getPaymentTxId(payment), amount: '500 microSTX' },
    });
  }
);

/**
 * Blockchain Info API - 0.0005 STX
 */
app.get(
  '/api/blockchain/info',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.0005),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  async (req: Request, res: Response) => {
    const payment = getPayment(req);
    
    try {
      const apiBase = NETWORK === 'mainnet' 
        ? 'https://api.mainnet.hiro.so' 
        : 'https://api.testnet.hiro.so';
      
      const response = await fetch(`${apiBase}/extended/v1/info`);
      const info = await response.json() as Record<string, unknown>;

      res.json({
        success: true,
        type: 'blockchain_info',
        network: NETWORK,
        data: {
          stacksHeight: info.stacks_tip_height,
          burnBlockHeight: info.burn_block_height,
          serverVersion: info.server_version,
          networkId: info.network_id,
          timestamp: new Date().toISOString(),
        },
        payment: { txId: getPaymentTxId(payment), amount: '500 microSTX' },
      });
    } catch (error) {
      res.json({
        success: true,
        type: 'blockchain_info',
        network: NETWORK,
        data: {
          stacksHeight: 150000 + Math.floor(Math.random() * 1000),
          burnBlockHeight: 850000 + Math.floor(Math.random() * 1000),
          status: 'mock_data',
          timestamp: new Date().toISOString(),
        },
        payment: { txId: getPaymentTxId(payment), amount: '500 microSTX' },
      });
    }
  }
);

// ============================================
// LEGACY ENDPOINTS (backward compatibility)
// ============================================

app.get(
  '/api/echo',
  x402PaymentRequired({
    amount: STXtoMicroSTX(0.0001),
    address: SERVER_ADDRESS,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
  }),
  (req: Request, res: Response) => {
    const payment = getPayment(req);
    const message = req.query.message || 'Hello from Paygent!';
    
    res.json({
      success: true,
      type: 'echo',
      data: { echo: message, timestamp: new Date().toISOString() },
      payment: { txId: getPaymentTxId(payment), amount: '100 microSTX' },
    });
  }
);

app.get('/api/bitcoin-news', (req, res) => res.redirect('/api/news/bitcoin'));
app.get('/api/stacks-info', (req, res) => res.redirect('/api/blockchain/info'));
app.get('/api/random-quote', (req, res) => res.redirect('/api/echo?message=Stack%20sats%2C%20stay%20humble.'));

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  📡 ENDPOINTS AVAILABLE                                   ║
╠═══════════════════════════════════════════════════════════╣
║  NEWS SERVICES:                                           ║
║    GET  /api/news/bitcoin        (0.001 STX)             ║
║    GET  /api/news/stacks         (0.001 STX)             ║
╠═══════════════════════════════════════════════════════════╣
║  AI PROCESSING:                                           ║
║    POST /api/summarize           (0.002 STX)             ║
║    POST /api/sentiment           (0.0015 STX)            ║
║    POST /api/translate           (0.0015 STX)            ║
╠═══════════════════════════════════════════════════════════╣
║  CONTENT GENERATION:                                      ║
║    POST /api/generate/tweet      (0.001 STX)             ║
║    POST /api/generate/report     (0.003 STX)             ║
╠═══════════════════════════════════════════════════════════╣
║  MARKET DATA:                                             ║
║    GET  /api/price/bitcoin       (0.0005 STX)            ║
║    GET  /api/price/stx           (0.0005 STX)            ║
║    GET  /api/blockchain/info     (0.0005 STX)            ║
╠═══════════════════════════════════════════════════════════╣
║  FREE:                                                    ║
║    GET  /health                                           ║
║    GET  /x402.json                                        ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server running on http://localhost:${PORT}
`);
});

export default app;
