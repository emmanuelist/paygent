import { PipelineExecution } from "@/data/mock";
import PipelineStepCard from "./PipelineStepCard";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Newspaper, DollarSign, Clock, MessageSquare, Twitter, FileText, Brain, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useState } from "react";

interface PipelineViewProps {
  execution: PipelineExecution;
  onBack: () => void;
}

// Copy button component
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button 
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

// Collapsible section component
const CollapsibleSection = ({ 
  title, 
  children, 
  defaultOpen = false,
  badge,
}: { 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-medium text-sm">{title}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
              {badge}
            </span>
          )}
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-card">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Format output data based on type
const formatOutput = (output: string | undefined, label: string | undefined) => {
  if (!output) return null;
  
  try {
    const data = typeof output === 'string' ? JSON.parse(output) : output;
    
    // Price data
    if (data.type === 'price' && data.data) {
      const priceData = data.data;
      const isPositive = priceData.change24h && !priceData.change24h.startsWith('-');
      const copyText = `${data.asset}: $${parseFloat(priceData.price).toLocaleString()} (${priceData.change24h} 24h)`;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  ${parseFloat(priceData.price).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{data.asset}/USD</div>
              </div>
              <div className={`ml-4 flex items-center gap-1 ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span className="font-mono">{priceData.change24h}</span>
              </div>
            </div>
            <CopyButton text={copyText} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-muted-foreground">24h High</div>
              <div className="font-mono text-foreground">${parseFloat(priceData.high24h).toLocaleString()}</div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-muted-foreground">24h Low</div>
              <div className="font-mono text-foreground">${parseFloat(priceData.low24h).toLocaleString()}</div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-muted-foreground">Volume</div>
              <div className="font-mono text-foreground">{priceData.volume24h}</div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <div className="text-muted-foreground">Market Cap</div>
              <div className="font-mono text-foreground">{priceData.marketCap}</div>
            </div>
          </div>
          {priceData.isRealData && (
            <div className="flex items-center gap-2 text-xs text-success">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Live data from CoinGecko
            </div>
          )}
        </div>
      );
    }
    
    // News data
    if (data.type === 'news' && data.data?.headlines) {
      const headlinesCopy = data.data.headlines.map((h: any) => `• ${h.title} (${h.source})`).join('\n');
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Newspaper size={14} />
              <span>{data.data.headlines.length} headlines</span>
            </div>
            <CopyButton text={headlinesCopy} />
          </div>
          {data.data.headlines.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="bg-secondary/50 rounded-lg p-3">
              <div className="font-medium text-foreground text-sm">{item.title}</div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{item.source}</span>
                {item.sentiment && (
                  <span className={`px-1.5 py-0.5 rounded ${
                    item.sentiment === 'positive' ? 'bg-success/20 text-success' :
                    item.sentiment === 'negative' ? 'bg-destructive/20 text-destructive' :
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {item.sentiment}
                  </span>
                )}
              </div>
            </div>
          ))}
          {data.data.isRealData && (
            <div className="flex items-center gap-2 text-xs text-success">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Live data from NewsAPI
            </div>
          )}
        </div>
      );
    }
    
    // Tweet/generated content
    if (data.type === 'generated_content' && data.contentType === 'tweet') {
      const tweetData = data.data;
      return (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-full">
                <Twitter className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-foreground text-lg leading-relaxed">{tweetData.tweet}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {tweetData.hashtags?.map((tag: string, i: number) => (
                    <span key={i} className="text-blue-400 text-sm font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{tweetData.characterCount || tweetData.tweet?.length} characters</span>
                <span className="capitalize">{tweetData.style} style</span>
              </div>
              <CopyButton text={tweetData.tweet} />
            </div>
          </div>
          {tweetData.isRealData && (
            <div className="flex items-center gap-2 text-xs text-success">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              AI-generated with Groq
            </div>
          )}
        </div>
      );
    }
    
    // Report/document content
    if (data.type === 'generated_content' && data.contentType === 'report') {
      const report = data.data;
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/20 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-bold text-foreground">{report.title}</h4>
              <p className="text-xs text-muted-foreground">{report.word_count} words</p>
            </div>
          </div>
          {report.executive_summary && (
            <div className="bg-secondary/50 rounded-lg p-4">
              <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</h5>
              <p className="text-sm text-foreground">{report.executive_summary}</p>
            </div>
          )}
          {report.sections?.map((section: any, i: number) => (
            <div key={i} className="bg-secondary/30 rounded-lg p-4">
              <h5 className="font-medium text-foreground mb-2">{section.heading}</h5>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{section.content}</p>
            </div>
          ))}
        </div>
      );
    }
    
    // Sentiment analysis data
    if (data.type === 'sentiment' && data.data) {
      const sentiment = data.data;
      const sentimentColor = sentiment.sentiment === 'positive' ? 'text-success' :
                            sentiment.sentiment === 'negative' ? 'text-destructive' :
                            'text-yellow-500';
      const sentimentBg = sentiment.sentiment === 'positive' ? 'bg-success/20' :
                          sentiment.sentiment === 'negative' ? 'bg-destructive/20' :
                          'bg-yellow-500/20';
      const scorePercent = sentiment.score || 50;
      
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${sentimentBg}`}>
              <span className={`text-2xl ${sentimentColor} font-bold capitalize`}>
                {sentiment.sentiment === 'positive' ? '📈' : 
                 sentiment.sentiment === 'negative' ? '📉' : '➡️'}
              </span>
            </div>
            <div>
              <div className={`text-xl font-bold capitalize ${sentimentColor}`}>
                {sentiment.sentiment}
              </div>
              <div className="text-sm text-muted-foreground">Market Sentiment</div>
            </div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Confidence Score</span>
              <span className="font-mono font-medium">{scorePercent}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className={`h-full ${sentimentBg.replace('/20', '')} transition-all duration-500`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>
          {sentiment.confidence && (
            <div className="text-xs text-muted-foreground">
              Analysis confidence: {(sentiment.confidence * 100).toFixed(0)}%
            </div>
          )}
          {sentiment.isRealData && (
            <div className="flex items-center gap-2 text-xs text-success">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              AI-analyzed with Groq
            </div>
          )}
        </div>
      );
    }
    
    // Summary/AI generated content
    if (data.type === 'summary' || data.type === 'ai') {
      const summaryText = data.data?.summary || '';
      const keyPointsText = data.data?.keyPoints?.join('\n• ') || '';
      const fullText = summaryText + (keyPointsText ? '\n\nKey Points:\n• ' + keyPointsText : '');
      return (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <CopyButton text={fullText} />
          </div>
          {data.data?.summary && (
            <p className="text-foreground leading-relaxed">{data.data.summary}</p>
          )}
          {data.data?.keyPoints && (
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {data.data.keyPoints.map((point: string, i: number) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    
    // Generic content with text
    if (data.data?.content || data.data?.text || data.content || data.text) {
      const text = data.data?.content || data.data?.text || data.content || data.text;
      return (
        <div className="space-y-2">
          <div className="flex justify-end mb-2">
            <CopyButton text={text} />
          </div>
          <p className="text-foreground leading-relaxed">{text}</p>
        </div>
      );
    }
    
    // Fallback: formatted JSON with copy button and better styling
    const jsonText = JSON.stringify(data, null, 2);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-mono">Raw data</span>
          <CopyButton text={jsonText} />
        </div>
        <pre className="text-xs font-mono text-secondary-foreground overflow-x-auto p-3 bg-secondary/50 rounded-lg border border-border">
          {jsonText}
        </pre>
      </div>
    );
  } catch {
    // Not JSON, show as text with copy button
    return (
      <div className="space-y-2">
        <div className="flex justify-end mb-2">
          <CopyButton text={output || ''} />
        </div>
        <p className="text-foreground">{output}</p>
      </div>
    );
  }
};

const PipelineView = ({ execution, onBack }: PipelineViewProps) => {
  const animatedSpent = useAnimatedCounter(execution.spentSTX);
  
  // Format spent value to always show 2 decimal places
  const formattedSpent = typeof animatedSpent === 'number' 
    ? animatedSpent.toFixed(2) 
    : parseFloat(String(animatedSpent) || '0').toFixed(2);
  
  return (
    <section className="px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="font-display text-xl font-bold text-foreground">Pipeline Execution</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-9 font-mono">"{execution.query}"</p>

      {/* Budget bar */}
      <div className="flex gap-8 mb-8 ml-9 text-xs font-mono uppercase tracking-wider">
        <div>
          <span className="text-muted-foreground">Budget: </span>
          <span className="text-foreground font-semibold">{execution.budgetSTX} STX</span>
        </div>
        <div>
          <span className="text-muted-foreground">Spent: </span>
          <span className="text-primary font-semibold">{formattedSpent} STX</span>
        </div>
        <div>
          <span className="text-muted-foreground">ETA: </span>
          <span className="text-foreground font-semibold">{execution.etaSeconds}s</span>
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="flex items-start gap-0 overflow-x-auto pb-4 ml-9">
        {(execution.steps || []).map((step, i) => (
          <div key={step?.id || `step-${i}`} className="flex items-center">
            <PipelineStepCard step={step} index={i} />
            {i < (execution.steps || []).length - 1 && (
              <div className="flex flex-col items-center mx-3 min-w-[60px]">
                {/* Connection line */}
                <svg width="60" height="4" className="overflow-visible">
                  <line
                    x1="0" y1="2" x2="60" y2="2"
                    stroke="hsl(var(--border))"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    className={step.status === "done" ? "animate-[flow-dash_1s_linear_infinite]" : ""}
                    style={step.status === "done" ? { stroke: "hsl(var(--success))" } : {}}
                  />
                </svg>
                {/* Data label */}
                {step.outputLabel && (
                  <span className="text-[10px] font-mono text-muted-foreground mt-1">
                    {step.outputLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Output area */}
      {(execution.steps || []).some((s) => s?.output) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 ml-9"
        >
          <h4 className="font-display text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Results
          </h4>
          <div className="space-y-3">
            {(execution.steps || [])
              .filter((s) => s?.output)
              .map((s, i, arr) => {
                // Determine badge based on output type
                let badge = '';
                try {
                  const data = typeof s.output === 'string' ? JSON.parse(s.output) : s.output;
                  if (data.type === 'price') badge = 'Price Data';
                  else if (data.type === 'news') badge = 'News';
                  else if (data.type === 'sentiment') badge = 'Sentiment';
                  else if (data.type === 'summary') badge = 'Summary';
                  else if (data.type === 'generated_content') {
                    badge = data.contentType === 'tweet' ? 'Tweet' : 'Report';
                  }
                } catch {}
                
                // Last item is always the final result, show expanded
                const isLast = i === arr.length - 1;
                
                return (
                  <CollapsibleSection 
                    key={i} 
                    title={s.label || `Step ${i + 1} Output`}
                    badge={badge}
                    defaultOpen={isLast}
                  >
                    {formatOutput(s.output, s.label)}
                  </CollapsibleSection>
                );
              })}
          </div>
        </motion.div>
      )}
    </section>
  );
};

export default PipelineView;
