import { useState } from "react";
import { ServiceInfo } from "@/data/mock";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";

interface ServiceDiscoveryProps {
  services: ServiceInfo[];
  isLoading?: boolean;
  onSelectService?: (service: ServiceInfo) => void;
}

const categories = ["All", "News", "AI Processing", "Content Generation"] as const;

const ServiceDiscovery = ({ services, isLoading = false, onSelectService }: ServiceDiscoveryProps) => {
  const [filter, setFilter] = useState<string>("All");

  const filtered = filter === "All" ? services : services.filter((s) => s.category === filter);

  return (
    <section className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-bold text-foreground">Services</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-secondary text-secondary-foreground text-xs font-mono px-3 py-1.5 rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icons.Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Icons.Layers size={32} className="mb-3 opacity-50" />
          <p className="text-sm">No services available</p>
          <p className="text-xs mt-1">Make sure the API server is running</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((service, i) => {
            const IconComp = (Icons as any)[service.icon] || Icons.Box;
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectService?.(service)}
                className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors group cursor-pointer"
                title={`Click to use ${service.name}`}
              >
                <div className="p-2 rounded-md bg-secondary text-muted-foreground group-hover:text-primary transition-colors">
                  <IconComp size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{service.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                </div>
                <span className="font-mono text-xs text-primary whitespace-nowrap">{service.priceSTX} STX</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ServiceDiscovery;
