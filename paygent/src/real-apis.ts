/**
 * Real API Integrations
 * Uses actual external APIs when keys are available, falls back to mock data
 */

import 'dotenv/config';

// API Keys from environment
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ============================================
// CRYPTO PRICES (CoinGecko)
// ============================================

export async function getBitcoinPrice(): Promise<{
  price: string;
  change24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  marketCap: string;
  isReal: boolean;
}> {
  try {
    const url = COINGECKO_API_KEY 
      ? `https://api.coingecko.com/api/v3/coins/bitcoin?x_cg_demo_api_key=${COINGECKO_API_KEY}`
      : 'https://api.coingecko.com/api/v3/coins/bitcoin';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('CoinGecko API failed');
    
    const data = await response.json() as any;
    const market = data.market_data;
    
    return {
      price: market.current_price.usd.toFixed(2),
      change24h: market.price_change_percentage_24h.toFixed(2) + '%',
      high24h: market.high_24h.usd.toFixed(2),
      low24h: market.low_24h.usd.toFixed(2),
      volume24h: formatLargeNumber(market.total_volume.usd),
      marketCap: formatLargeNumber(market.market_cap.usd),
      isReal: true,
    };
  } catch (error) {
    console.log('⚠️ CoinGecko API failed, using mock data:', error);
    return getMockBitcoinPrice();
  }
}

export async function getStxPrice(): Promise<{
  price: string;
  change24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  marketCap: string;
  isReal: boolean;
}> {
  try {
    const url = COINGECKO_API_KEY 
      ? `https://api.coingecko.com/api/v3/coins/blockstack?x_cg_demo_api_key=${COINGECKO_API_KEY}`
      : 'https://api.coingecko.com/api/v3/coins/blockstack';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('CoinGecko API failed');
    
    const data = await response.json() as any;
    const market = data.market_data;
    
    return {
      price: market.current_price.usd.toFixed(4),
      change24h: market.price_change_percentage_24h.toFixed(2) + '%',
      high24h: market.high_24h.usd.toFixed(4),
      low24h: market.low_24h.usd.toFixed(4),
      volume24h: formatLargeNumber(market.total_volume.usd),
      marketCap: formatLargeNumber(market.market_cap.usd),
      isReal: true,
    };
  } catch (error) {
    console.log('⚠️ CoinGecko STX API failed, using mock data:', error);
    return getMockStxPrice();
  }
}

// ============================================
// CRYPTO NEWS (CryptoCompare / NewsAPI)
// ============================================

export async function getBitcoinNews(): Promise<{
  headlines: Array<{ title: string; sentiment: string; source: string; time: string; url?: string }>;
  summary: string;
  overallSentiment: string;
  isReal: boolean;
}> {
  // Try CryptoCompare first
  if (CRYPTOCOMPARE_API_KEY) {
    try {
      const response = await fetch(
        `https://min-api.cryptocompare.com/data/v2/news/?categories=BTC&api_key=${CRYPTOCOMPARE_API_KEY}`
      );
      if (!response.ok) throw new Error('CryptoCompare API failed');
      
      const data = await response.json() as any;
      const articles = data.Data?.slice(0, 5) || [];
      
      const headlines = articles.map((article: any) => ({
        title: article.title,
        sentiment: article.sentiment === 'POSITIVE' ? 'bullish' : article.sentiment === 'NEGATIVE' ? 'bearish' : 'neutral',
        source: article.source,
        time: getTimeAgo(article.published_on * 1000),
        url: article.url,
      }));
      
      return {
        headlines,
        summary: 'Latest Bitcoin news from top crypto sources.',
        overallSentiment: calculateOverallSentiment(headlines),
        isReal: true,
      };
    } catch (error) {
      console.log('⚠️ CryptoCompare API failed:', error);
    }
  }
  
  // Try NewsAPI as fallback
  if (NEWSAPI_KEY) {
    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=bitcoin+crypto&sortBy=publishedAt&pageSize=5&apiKey=${NEWSAPI_KEY}`
      );
      if (!response.ok) throw new Error('NewsAPI failed');
      
      const data = await response.json() as any;
      const articles = data.articles || [];
      
      const headlines = articles.map((article: any) => ({
        title: article.title,
        sentiment: 'neutral',
        source: article.source?.name || 'Unknown',
        time: getTimeAgo(new Date(article.publishedAt).getTime()),
        url: article.url,
      }));
      
      return {
        headlines,
        summary: 'Latest Bitcoin news from global media sources.',
        overallSentiment: 'neutral',
        isReal: true,
      };
    } catch (error) {
      console.log('⚠️ NewsAPI failed:', error);
    }
  }
  
  return getMockBitcoinNews();
}

export async function getStacksNews(): Promise<{
  headlines: Array<{ title: string; sentiment: string; source: string; time: string; url?: string }>;
  summary: string;
  overallSentiment: string;
  isReal: boolean;
}> {
  // Try NewsAPI for Stacks news
  if (NEWSAPI_KEY) {
    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=stacks+blockchain+OR+STX+crypto&sortBy=publishedAt&pageSize=5&apiKey=${NEWSAPI_KEY}`
      );
      if (!response.ok) throw new Error('NewsAPI failed');
      
      const data = await response.json() as any;
      const articles = data.articles || [];
      
      if (articles.length > 0) {
        const headlines = articles.map((article: any) => ({
          title: article.title,
          sentiment: 'neutral',
          source: article.source?.name || 'Unknown',
          time: getTimeAgo(new Date(article.publishedAt).getTime()),
          url: article.url,
        }));
        
        return {
          headlines,
          summary: 'Latest Stacks ecosystem news from global media.',
          overallSentiment: 'neutral',
          isReal: true,
        };
      }
    } catch (error) {
      console.log('⚠️ NewsAPI Stacks search failed:', error);
    }
  }
  
  return getMockStacksNews();
}

// ============================================
// AI PROCESSING (Groq - fastest free option)
// ============================================

async function callGroq(prompt: string, maxTokens: number = 200): Promise<string | null> {
  if (!GROQ_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) throw new Error('Groq API failed');
    
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.log('⚠️ Groq API failed:', error);
    return null;
  }
}

async function callOpenAI(prompt: string, maxTokens: number = 200): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) throw new Error('OpenAI API failed');
    
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.log('⚠️ OpenAI API failed:', error);
    return null;
  }
}

export async function summarizeText(text: string): Promise<{
  summary: string;
  keyPoints: string[];
  isReal: boolean;
}> {
  const prompt = `Summarize this text in 2-3 sentences and provide 3 key bullet points.

Text: ${text.slice(0, 1000)}

Format your response as:
SUMMARY: [your summary]
KEY POINTS:
- [point 1]
- [point 2]
- [point 3]`;

  // Try Groq first (faster and free)
  let response = await callGroq(prompt, 300);
  
  // Fall back to OpenAI
  if (!response) {
    response = await callOpenAI(prompt, 300);
  }
  
  if (response) {
    const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=KEY POINTS:|$)/si);
    const keyPointsMatch = response.match(/KEY POINTS:(.+)/si);
    
    const summary = summaryMatch?.[1]?.trim() || response.slice(0, 200);
    const keyPoints = keyPointsMatch?.[1]
      ?.split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 3) || ['Key insight from analysis', 'Important trend observed', 'Notable development'];
    
    return { summary, keyPoints, isReal: true };
  }
  
  return getMockSummary(text);
}

export async function analyzeSentiment(text: string): Promise<{
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  isReal: boolean;
}> {
  const prompt = `Analyze the sentiment of this text. Respond with exactly:
SENTIMENT: [positive/negative/neutral]
SCORE: [0-100 where 100 is most positive]
CONFIDENCE: [0.0-1.0]

Text: ${text.slice(0, 500)}`;

  let response = await callGroq(prompt, 100);
  if (!response) {
    response = await callOpenAI(prompt, 100);
  }
  
  if (response) {
    const sentimentMatch = response.match(/SENTIMENT:\s*(positive|negative|neutral)/i);
    const scoreMatch = response.match(/SCORE:\s*(\d+)/);
    const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/);
    
    return {
      sentiment: (sentimentMatch?.[1]?.toLowerCase() || 'neutral') as 'positive' | 'negative' | 'neutral',
      score: parseInt(scoreMatch?.[1] || '50'),
      confidence: parseFloat(confidenceMatch?.[1] || '0.8'),
      isReal: true,
    };
  }
  
  return getMockSentiment(text);
}

export async function generateTweet(content: string, style: string = 'enthusiastic'): Promise<{
  tweet: string;
  hashtags: string[];
  isReal: boolean;
}> {
  const prompt = `Generate a ${style} tweet about this content. Include 2-3 relevant hashtags. Keep it under 280 characters.

Content: ${content.slice(0, 300)}

Respond with just the tweet text including hashtags.`;

  let response = await callGroq(prompt, 100);
  if (!response) {
    response = await callOpenAI(prompt, 100);
  }
  
  if (response) {
    const tweet = response.trim().slice(0, 280);
    const hashtags = tweet.match(/#\w+/g) || ['#Crypto', '#Bitcoin', '#Stacks'];
    
    return { tweet, hashtags, isReal: true };
  }
  
  return getMockTweet(content);
}

export async function translateText(text: string, targetLanguage: string): Promise<{
  translated: string;
  isReal: boolean;
}> {
  const languageNames: Record<string, string> = {
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    zh: 'Chinese',
    pt: 'Portuguese',
    it: 'Italian',
  };
  
  const langName = languageNames[targetLanguage] || 'Spanish';
  const prompt = `Translate this text to ${langName}. Respond with only the translation:

${text.slice(0, 500)}`;

  let response = await callGroq(prompt, 300);
  if (!response) {
    response = await callOpenAI(prompt, 300);
  }
  
  if (response) {
    return { translated: response.trim(), isReal: true };
  }
  
  return { translated: `[${targetLanguage.toUpperCase()}] ${text}`, isReal: false };
}

// ============================================
// MOCK DATA FALLBACKS
// ============================================

function getMockBitcoinPrice() {
  const basePrice = 97000 + Math.random() * 3000;
  return {
    price: basePrice.toFixed(2),
    change24h: ((Math.random() - 0.3) * 5).toFixed(2) + '%',
    high24h: (basePrice * 1.02).toFixed(2),
    low24h: (basePrice * 0.98).toFixed(2),
    volume24h: '45.2B',
    marketCap: '1.9T',
    isReal: false,
  };
}

function getMockStxPrice() {
  const basePrice = 1.5 + Math.random() * 0.5;
  return {
    price: basePrice.toFixed(4),
    change24h: ((Math.random() - 0.3) * 8).toFixed(2) + '%',
    high24h: (basePrice * 1.05).toFixed(4),
    low24h: (basePrice * 0.95).toFixed(4),
    volume24h: '125M',
    marketCap: '2.2B',
    isReal: false,
  };
}

function getMockBitcoinNews() {
  return {
    headlines: [
      { title: 'Bitcoin Shows Strong Support Above $95K Level', sentiment: 'bullish', source: 'CoinDesk', time: '1h ago' },
      { title: 'Institutional Bitcoin Adoption Continues to Grow', sentiment: 'bullish', source: 'Bloomberg', time: '2h ago' },
      { title: 'Lightning Network Sees Record Transaction Volume', sentiment: 'bullish', source: 'Bitcoin Magazine', time: '3h ago' },
      { title: 'Bitcoin ETF Inflows Remain Positive This Week', sentiment: 'bullish', source: 'Reuters', time: '4h ago' },
      { title: 'Analysts Predict Strong Q1 for Crypto Markets', sentiment: 'neutral', source: 'Forbes', time: '5h ago' },
    ],
    summary: 'Bitcoin market shows resilience with strong institutional interest.',
    overallSentiment: 'bullish',
    isReal: false,
  };
}

function getMockStacksNews() {
  return {
    headlines: [
      { title: 'Stacks Ecosystem Shows Strong DeFi Growth', sentiment: 'bullish', source: 'Stacks Blog', time: '1h ago' },
      { title: 'sBTC Development Progresses Ahead of Schedule', sentiment: 'bullish', source: 'Decrypt', time: '3h ago' },
      { title: 'Stacks TVL Continues Upward Trend', sentiment: 'bullish', source: 'DeFi Pulse', time: '4h ago' },
      { title: 'New dApps Launch on Stacks Network', sentiment: 'neutral', source: 'Hiro Systems', time: '6h ago' },
    ],
    summary: 'Stacks ecosystem growing with strong developer activity.',
    overallSentiment: 'bullish',
    isReal: false,
  };
}

function getMockSummary(text: string) {
  const words = text.split(/\s+/);
  const summary = words.slice(0, 30).join(' ') + (words.length > 30 ? '...' : '');
  return {
    summary,
    keyPoints: [
      'Strong market momentum observed',
      'Institutional adoption continues',
      'Technology developments driving growth',
    ],
    isReal: false,
  };
}

function getMockSentiment(text: string): {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  isReal: boolean;
} {
  const positiveWords = ['surge', 'growth', 'bullish', 'record', 'high', 'adoption', 'launch', 'strong'];
  const negativeWords = ['crash', 'bearish', 'decline', 'drop', 'concern', 'risk', 'fall'];
  
  const lower = text.toLowerCase();
  let score = 50;
  positiveWords.forEach(w => { if (lower.includes(w)) score += 10; });
  negativeWords.forEach(w => { if (lower.includes(w)) score -= 10; });
  score = Math.max(0, Math.min(100, score));
  
  const sentiment: 'positive' | 'negative' | 'neutral' = score > 60 ? 'positive' : score < 40 ? 'negative' : 'neutral';
  
  return {
    sentiment,
    score,
    confidence: 0.75,
    isReal: false,
  };
}

function getMockTweet(content: string) {
  const templates = [
    `🚀 ${content.slice(0, 100)}... The future is being built! #Bitcoin #Crypto`,
    `📈 ${content.slice(0, 100)}... Stay informed! #Stacks #DeFi`,
  ];
  const tweet = templates[Math.floor(Math.random() * templates.length)];
  return {
    tweet,
    hashtags: ['#Bitcoin', '#Stacks', '#Crypto'],
    isReal: false,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  return num.toFixed(0);
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function calculateOverallSentiment(headlines: Array<{ sentiment: string }>): string {
  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  headlines.forEach(h => {
    if (h.sentiment === 'bullish') counts.bullish++;
    else if (h.sentiment === 'bearish') counts.bearish++;
    else counts.neutral++;
  });
  
  if (counts.bullish > counts.bearish && counts.bullish >= counts.neutral) return 'bullish';
  if (counts.bearish > counts.bullish && counts.bearish >= counts.neutral) return 'bearish';
  return 'neutral';
}

// Log which APIs are available
console.log(`
📡 Real API Status:
  - CoinGecko:     ${COINGECKO_API_KEY ? '✅ Available' : '❌ Not configured'}
  - CryptoCompare: ${CRYPTOCOMPARE_API_KEY ? '✅ Available' : '❌ Not configured'}
  - NewsAPI:       ${NEWSAPI_KEY ? '✅ Available' : '❌ Not configured'}
  - OpenAI:        ${OPENAI_API_KEY ? '✅ Available' : '❌ Not configured'}
  - Groq:          ${GROQ_API_KEY ? '✅ Available' : '❌ Not configured'}
`);
