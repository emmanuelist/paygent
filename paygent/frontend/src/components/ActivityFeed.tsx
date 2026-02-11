import { ActivityEntry } from "@/data/mock";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, ExternalLink, Loader2, Clock } from "lucide-react";
import { useScrambleText } from "@/hooks/useScrambleText";

// Truncate txHash to "0x8a3f....c4d2" format
function truncateTxHash(hash: string): string {
  if (!hash) return "";
  const clean = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (clean.length <= 14) return clean;
  return `${clean.slice(0, 6)}....${clean.slice(-4)}`;
}

const ActivityEntryHash = ({ hash, delay }: { hash: string; delay: number }) => {
  const truncated = truncateTxHash(hash);
  const { displayText } = useScrambleText(truncated, 600 + delay);
  return <>{displayText}</>;
};

interface ActivityFeedProps {
  entries: ActivityEntry[];
  isLoading?: boolean;
  onRerunQuery?: (query: string) => void;
}

const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const ActivityFeed = ({ entries, isLoading = false, onRerunQuery }: ActivityFeedProps) => {
  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-bold text-foreground">Recent Activity</h3>
        {entries.length > 5 && (
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {entries.length} total
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Clock size={32} className="mb-3 opacity-50" />
          <p className="text-sm">No activity yet</p>
          <p className="text-xs mt-1">Run a pipeline to see history</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => onRerunQuery?.(entry.query)}
              className={`flex items-center gap-4 p-4 rounded-lg bg-card border-l-2 ${
                entry.status === "success" ? "border-l-success" : "border-l-signal-red"
              } border border-border hover:bg-secondary/50 transition-colors group cursor-pointer`}
              title="Click to re-run this query"
            >
              {/* Status icon */}
              {entry.status === "success" ? (
                <CheckCircle size={16} className="text-success flex-shrink-0" />
              ) : (
                <XCircle size={16} className="text-signal-red flex-shrink-0" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{entry.query}</p>
                <div className="flex gap-3 mt-1 text-[11px] font-mono text-muted-foreground">
                  <span>{entry.stepCount} steps</span>
                  <span>{entry.totalCostSTX.toFixed(2)} STX</span>
                  <span>{(entry.durationMs / 1000).toFixed(1)}s</span>
                </div>
              </div>

              {/* TX Hash & Time */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {entry.txHash && (
                  <a
                    href={`https://explorer.stacks.co/txid/${entry.txHash}?chain=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActivityEntryHash hash={entry.txHash} delay={i * 150} />
                    <ExternalLink size={10} />
                  </a>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {formatTimeAgo(entry.timestamp)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ActivityFeed;
