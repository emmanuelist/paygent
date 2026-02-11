import { PipelineStep, StepStatus } from "@/data/mock";
import { Check, X, Loader2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useScrambleText } from "@/hooks/useScrambleText";

interface PipelineStepCardProps {
  step: PipelineStep;
  index: number;
}

// Truncate txHash to "0x8a3f....c4d2" format
function truncateTxHash(hash: string): string {
  if (!hash) return "";
  const clean = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (clean.length <= 14) return clean;
  return `${clean.slice(0, 6)}....${clean.slice(-4)}`;
}

const statusConfig: Record<StepStatus, { border: string; icon: React.ReactNode; bg: string }> = {
  pending: {
    border: "border-smoke",
    bg: "bg-card",
    icon: <Clock size={16} className="text-muted-foreground" />,
  },
  running: {
    border: "border-primary",
    bg: "bg-card",
    icon: <Loader2 size={16} className="text-primary animate-spin" />,
  },
  done: {
    border: "border-success",
    bg: "bg-card",
    icon: (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
        <Check size={16} className="text-success" />
      </motion.div>
    ),
  },
  failed: {
    border: "border-signal-red",
    bg: "bg-card",
    icon: <X size={16} className="text-signal-red" />,
  },
};

const PipelineStepCard = ({ step, index }: PipelineStepCardProps) => {
  const config = statusConfig[step?.status] || statusConfig.pending;
  const truncatedHash = step?.txHash ? truncateTxHash(step.txHash) : "";
  const { displayText: scrambledHash } = useScrambleText(truncatedHash);
  
  // Build explorer URL with chain parameter
  const getExplorerUrl = (txHash: string) => {
    const cleanHash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
    return `https://explorer.stacks.co/txid/${cleanHash}?chain=testnet`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
      className={`relative flex flex-col min-w-[220px] max-w-[260px] rounded-lg border-2 ${config.border} ${config.bg} p-4 ${
        step.status === "running" ? "animate-breathing" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Step {index + 1}
        </span>
        {config.icon}
      </div>

      {/* Service name */}
      <h4 className="font-display font-semibold text-sm text-foreground mb-1">{step.label}</h4>
      <p className="text-xs text-muted-foreground mb-3">{step.service}</p>

      {/* Cost & TX */}
      {step.costSTX !== undefined && (
        <div className="flex items-center justify-between text-xs mt-auto">
          <span className="font-mono text-primary">{step.costSTX} STX</span>
          {step.txHash && (
            <a
              href={getExplorerUrl(step.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-muted-foreground hover:text-foreground transition-colors underline decoration-dotted"
            >
              {scrambledHash}
            </a>
          )}
        </div>
      )}

      {/* Error */}
      {step.error && (
        <p className="text-xs text-signal-red mt-2 font-mono">{step.error}</p>
      )}
    </motion.div>
  );
};

export default PipelineStepCard;
