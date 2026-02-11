import { useState, useEffect, useRef } from "react";
import { Newspaper, FileText, MessageSquare, TrendingUp, Send, Sparkles, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeroSectionProps {
  onSubmitQuery: (query: string) => void;
  isThinking?: boolean;
  planningMessage?: string;
  servicesCount: number;
  balance: number;
  tasksToday: number;
  isFirstVisit?: boolean;
}

const quickActions = [
  { label: "News", icon: Newspaper, query: "Summarize today's top tech news", estimatedCost: "~0.003 STX", steps: 2 },
  { label: "Report", icon: FileText, query: "Generate a market analysis report for BTC", estimatedCost: "~0.006 STX", steps: 3 },
  { label: "Tweet", icon: MessageSquare, query: "Create a viral tweet about AI agents", estimatedCost: "~0.002 STX", steps: 1 },
  { label: "Price", icon: TrendingUp, query: "Get current BTC and STX prices", estimatedCost: "~0.001 STX", steps: 1 },
];

const thinkingMessages = ["Parsing query...", "Analyzing intent...", "Planning pipeline...", "Discovering services..."];

const ThinkingIndicator = ({ message }: { message?: string }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // Only cycle through default messages if no message is provided
    if (!message) {
      const interval = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % thinkingMessages.length);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [message]);
  
  // Reset index when message changes
  useEffect(() => {
    if (message) setMessageIndex(0);
  }, [message]);

  const displayMessage = message || thinkingMessages[messageIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 px-5 py-4"
    >
      <div className="flex items-center gap-1">
        <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
        <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
        <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
      </div>
      <motion.span 
        key={displayMessage}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-muted-foreground text-sm font-mono"
      >
        {displayMessage}
      </motion.span>
    </motion.div>
  );
};

const HeroSection = ({ onSubmitQuery, isThinking = false, planningMessage, servicesCount, balance, tasksToday, isFirstVisit = false }: HeroSectionProps) => {
  const [query, setQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(isFirstVisit);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isThinking) {
      onSubmitQuery(query.trim());
      setQuery("");
      setShowOnboarding(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus input on "/" key (like many apps)
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to blur and clear
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        setQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section className="flex flex-col items-center justify-center py-16 md:py-24 px-6">
      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="font-display text-6xl md:text-8xl font-bold tracking-tighter text-foreground ember-glow mb-3"
      >
        PAYGENT
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-muted-foreground text-lg mb-12 tracking-wide"
      >
        The AI Agent That Pays Its Own Way
      </motion.p>

      {/* Query Input */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        onSubmit={handleSubmit}
        className="w-full max-w-2xl mb-8"
      >
        <div
          className={`relative flex items-center border-l-4 border-l-primary bg-card rounded-r-lg border border-border transition-shadow ${
            isThinking ? "animate-[breathing_1.5s_ease-in-out_infinite]" : "focus-within:ember-border-glow"
          }`}
        >
          <AnimatePresence mode="wait">
            {isThinking ? (
              <ThinkingIndicator key="thinking" message={planningMessage} />
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex items-center"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What should the agent do? (Press / to focus)"
                  className="flex-1 bg-transparent px-5 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none font-sans text-base"
                />
              </motion.div>
            )}
          </AnimatePresence>
          {!isThinking && (
            <button
              type="submit"
              disabled={!query.trim()}
              className="p-4 text-primary hover:text-ember-light disabled:text-muted-foreground transition-colors"
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </motion.form>

      {/* Onboarding hint for first-time users */}
      <AnimatePresence>
        {showOnboarding && tasksToday === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 max-w-xl"
          >
            <Sparkles className="text-primary flex-shrink-0" size={18} />
            <div className="text-sm">
              <span className="text-foreground font-medium">Welcome to Paygent!</span>
              <span className="text-muted-foreground"> Try a quick action below or type your own query. The AI agent will discover services, pay for them with STX, and return results.</span>
            </div>
            <button 
              onClick={() => setShowOnboarding(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="flex flex-wrap gap-3 mb-12 justify-center"
      >
        {quickActions.map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger asChild>
              <button
                onClick={() => { onSubmitQuery(action.query); setShowOnboarding(false); }}
                disabled={isThinking}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:text-foreground transition-all text-sm font-medium disabled:opacity-50 disabled:pointer-events-none group"
              >
                <action.icon size={14} />
                {action.label}
                <span className="text-[10px] text-muted-foreground group-hover:text-primary font-mono ml-1">
                  {action.estimatedCost}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{action.query}</p>
              <p className="text-muted-foreground mt-1">{action.steps} step{action.steps > 1 ? 's' : ''} • {action.estimatedCost}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </motion.div>

      {/* Stats Bar with tooltips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="flex gap-8 text-xs font-mono text-muted-foreground tracking-wider uppercase"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help flex items-center gap-1">
              {servicesCount} services
              <Info size={10} className="opacity-50" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>x402-enabled APIs discovered on the network</p>
          </TooltipContent>
        </Tooltip>
        <span className="text-border">|</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help flex items-center gap-1">
              {balance.toFixed(2)} STX
              <Info size={10} className="opacity-50" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Your testnet wallet balance for paying services</p>
          </TooltipContent>
        </Tooltip>
        <span className="text-border">|</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help flex items-center gap-1">
              {tasksToday} tasks today
              <Info size={10} className="opacity-50" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Pipelines executed in this session</p>
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </section>
  );
};

export default HeroSection;
