import { useState } from "react";
import { Copy, Check, Wifi, WifiOff, Loader2 } from "lucide-react";
import { WalletInfo } from "@/data/mock";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

interface HeaderBarProps {
  wallet: WalletInfo;
  isLoading?: boolean;
  isConnected?: boolean;
}

const HeaderBar = ({ wallet, isLoading = false, isConnected = true }: HeaderBarProps) => {
  const [copied, setCopied] = useState(false);
  const animatedBalance = useAnimatedCounter(wallet?.balance || 0);

  const truncatedAddress = wallet?.address 
    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
    : 'Loading...';

  const handleCopy = () => {
    if (!wallet?.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          <span className="text-primary ember-glow">PAY</span>
          <span>GENT</span>
        </h1>
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Connected to API" />
          ) : (
            <WifiOff size={14} className="text-destructive" title="Disconnected from API" />
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5">
        {/* Network indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div
            className={`w-2 h-2 rounded-full ${
              wallet?.network === "testnet"
                ? "bg-ember-light"
                : "bg-success"
            }`}
          />
          <span className="font-mono text-xs uppercase tracking-wider">
            {wallet?.network || 'testnet'}
          </span>
        </div>

        {/* Wallet address */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors group"
        >
          <Wifi size={14} className="text-muted-foreground" />
          <span className="font-mono text-xs text-secondary-foreground">
            {isLoading ? "Loading..." : truncatedAddress}
          </span>
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check size={12} className="text-success" />
              </motion.div>
            ) : (
              <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Copy size={12} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Balance */}
        <div className="flex items-center gap-1.5 font-mono text-sm">
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className="text-primary font-semibold">{animatedBalance}</span>
              <span className="text-muted-foreground text-xs">STX</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
