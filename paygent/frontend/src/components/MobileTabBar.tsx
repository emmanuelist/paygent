import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

export interface MobileTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MobileTabBarProps {
  tabs: MobileTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

const MobileTabBar = ({ tabs, activeTab, onTabChange }: MobileTabBarProps) => {
  return (
    <div className="sticky top-0 z-20 flex bg-card border-b border-border">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {isActive && (
              <motion.div
                layoutId="mobile-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default MobileTabBar;
