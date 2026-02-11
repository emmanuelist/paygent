import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import HeaderBar from "@/components/HeaderBar";
import HeroSection from "@/components/HeroSection";
import PipelineView from "@/components/PipelineView";
import ServiceDiscovery from "@/components/ServiceDiscovery";
import ActivityFeed from "@/components/ActivityFeed";
import MobileTabBar, { MobileTab } from "@/components/MobileTabBar";
import { mockWallet, mockServices, PipelineExecution, PipelineStep, ActivityEntry } from "@/data/mock";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useWallet, useServices, useHistory, useExecutePipeline } from "@/hooks/usePaygentAPI";
import { usePipelineExecution } from "@/hooks/usePipelineWebSocket";
import { Activity, Layers, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Helper to map service category to icon name
const getCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    'news': 'Newspaper',
    'ai': 'Brain',
    'ai processing': 'Brain',
    'content': 'FileText',
    'content generation': 'MessageSquare',
    'data': 'Database',
    'social': 'Share2',
    'translation': 'Globe',
    'image': 'Image',
    'general': 'Layers',
  };
  return iconMap[category.toLowerCase()] || 'Box';
};

const Index = () => {
  const [activePipeline, setActivePipeline] = useState<PipelineExecution | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("activity");
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // API Hooks
  const { data: wallet, isLoading: walletLoading, error: walletError } = useWallet();
  const { data: services, isLoading: servicesLoading } = useServices();
  const { data: history, isLoading: historyLoading } = useHistory();
  const executePipelineMutation = useExecutePipeline();

  // WebSocket pipeline execution
  const pipelineExecution = usePipelineExecution();

  // Sync WebSocket state to activePipeline with proper animations
  useEffect(() => {
    if (pipelineExecution.status === 'idle') {
      return;
    }
    
    // During planning phase, keep showing HeroSection with thinking messages
    if (pipelineExecution.status === 'planning') {
      setIsThinking(true);
      return; // Don't set activePipeline yet
    }
    
    // Once we have steps or are running, show the pipeline view
    if (pipelineExecution.steps.length > 0 || pipelineExecution.status === 'running') {
      setIsThinking(false);
      
      // Safely map steps with null checks
      const mappedSteps = (pipelineExecution.steps || []).map((s, i) => ({
        id: s?.id || `step-${i}`,
        service: s?.description || s?.name || 'Service',
        label: s?.name || `Step ${i + 1}`,
        status: s?.status || 'pending' as const,
        costSTX: s?.costSTX || 0,
        output: s?.output ? (typeof s.output === "string" ? s.output : JSON.stringify(s.output)) : undefined,
        error: s?.error,
        txHash: s?.txId,
        outputLabel: s?.outputLabel || (i < pipelineExecution.steps.length - 1 ? 'data' : undefined),
      }));
      
      // Calculate ETA based on actual step durations
      const completedSteps = (pipelineExecution.steps || []).filter((s) => s?.durationMs);
      const avgStepDuration = completedSteps.length > 0 
        ? completedSteps.reduce((sum, s) => sum + (s.durationMs || 0), 0) / completedSteps.length / 1000
        : 8; // Default 8s per step if no data
      const remainingSteps = pipelineExecution.totalSteps - pipelineExecution.currentStepIndex - 1;
      const etaSeconds = Math.max(0, Math.round(remainingSteps * avgStepDuration));
      
      setActivePipeline((prev) => ({
        id: pipelineExecution.currentPipelineId || prev?.id || crypto.randomUUID(),
        query: pipelineExecution.query || prev?.query || "",
        steps: mappedSteps as PipelineStep[],
        budgetSTX: prev?.budgetSTX || 10.0,
        spentSTX: pipelineExecution.totalCost || 0,
        etaSeconds,
        status: pipelineExecution.status === 'complete' ? 'done' : 
                pipelineExecution.status === 'failed' ? 'failed' : 'running',
        startedAt: prev?.startedAt || new Date(),
        finalOutput: pipelineExecution.result ? 
          (typeof pipelineExecution.result === "string" ? pipelineExecution.result : JSON.stringify(pipelineExecution.result, null, 2)) 
          : undefined,
      }));
    }
    
    // Handle completion/failure
    if (pipelineExecution.status === 'complete' || pipelineExecution.status === 'failed') {
      setIsThinking(false);
    }
  }, [pipelineExecution.steps, pipelineExecution.status, pipelineExecution.totalCost, 
      pipelineExecution.result, pipelineExecution.error, pipelineExecution.query,
      pipelineExecution.currentPipelineId, pipelineExecution.totalSteps, pipelineExecution.currentStepIndex]);

  const handleSubmitQuery = useCallback(async (query: string) => {
    // Don't set activePipeline immediately - let the user see "Parsing query..." first
    // The useEffect will set activePipeline when we receive steps from WebSocket
    setIsThinking(true);
    
    if (isMobile) setActiveTab("pipeline");

    try {
      await pipelineExecution.execute(query, { budget: 10, maxSteps: 5 });
    } catch (error: any) {
      setIsThinking(false);
      toast({
        title: "Pipeline Error",
        description: error.message || "Failed to execute pipeline",
        variant: "destructive",
      });
    }
  }, [isMobile, pipelineExecution, toast]);

  const handleBack = useCallback(() => {
    setActivePipeline(null);
    pipelineExecution.reset();
    if (isMobile) setActiveTab("activity");
  }, [isMobile, pipelineExecution]);

  // Use real data or fallback to mock
  const displayWallet = wallet ? {
    address: wallet.address || '',
    balance: parseFloat(wallet.balanceFormatted) || parseFloat(wallet.balance) / 1_000_000 || 0,
    network: wallet.network || 'testnet',
  } : mockWallet;
  
  const displayServices = services?.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category as "News" | "AI Processing" | "Content Generation",
    priceSTX: s.priceSTX,
    icon: getCategoryIcon(s.category),
  })) || mockServices;
  
  const displayHistory: ActivityEntry[] = history?.map((h: any) => ({
    id: h.id,
    query: h.query,
    stepCount: h.stepCount || 1,
    totalCostSTX: h.totalCostSTX || 0,
    durationMs: h.durationMs || 0,
    status: h.status === "success" ? "success" : "failed",
    txHash: h.txHashes?.[0] || "",
    timestamp: new Date(h.timestamp),
    output: h.output,
  })) || [];

  // Build mobile tabs
  const mobileTabs: MobileTab[] = useMemo(() => [
    ...(activePipeline ? [{ id: "pipeline", label: "Pipeline", icon: Zap }] : []),
    { id: "activity", label: "Activity", icon: Activity },
    { id: "services", label: "Services", icon: Layers },
  ], [activePipeline]);

  const swipeRef = useRef<HTMLDivElement>(null);

  const handleSwipeLeft = useCallback(() => {
    const idx = mobileTabs.findIndex((t) => t.id === activeTab);
    if (idx < mobileTabs.length - 1) setActiveTab(mobileTabs[idx + 1].id);
  }, [mobileTabs, activeTab]);

  const handleSwipeRight = useCallback(() => {
    const idx = mobileTabs.findIndex((t) => t.id === activeTab);
    if (idx > 0) setActiveTab(mobileTabs[idx - 1].id);
  }, [mobileTabs, activeTab]);

  useSwipeGesture(swipeRef, { onSwipeLeft: handleSwipeLeft, onSwipeRight: handleSwipeRight });

  // Show connection status
  useEffect(() => {
    if (walletError) {
      toast({
        title: "API Connection Error",
        description: "Cannot connect to Paygent API. Make sure the server is running.",
        variant: "destructive",
      });
    }
  }, [walletError, toast]);

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar 
        wallet={displayWallet} 
        isLoading={walletLoading}
        isConnected={pipelineExecution.isConnected}
      />

      {/* Desktop: pipeline above, or hero */}
      {!isMobile && (
        activePipeline ? (
          <PipelineView execution={activePipeline} onBack={handleBack} />
        ) : (
          <HeroSection
            onSubmitQuery={handleSubmitQuery}
            isThinking={isThinking}
            planningMessage={pipelineExecution.planningMessage}
            servicesCount={displayServices.length}
            balance={displayWallet.balance}
            tasksToday={displayHistory.length}
            isFirstVisit={displayHistory.length === 0}
          />
        )
      )}

      {/* Mobile: always show hero when no pipeline */}
      {isMobile && !activePipeline && (
        <HeroSection
          onSubmitQuery={handleSubmitQuery}
          isThinking={isThinking}
          planningMessage={pipelineExecution.planningMessage}
          servicesCount={displayServices.length}
          balance={displayWallet.balance}
          tasksToday={displayHistory.length}
          isFirstVisit={displayHistory.length === 0}
        />
      )}

      {/* Mobile tab bar */}
      {isMobile && (
        <MobileTabBar tabs={mobileTabs} activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Content */}
      {isMobile ? (
        <div ref={swipeRef}>
          {activeTab === "pipeline" && activePipeline && (
            <PipelineView execution={activePipeline} onBack={handleBack} />
          )}
          {activeTab === "activity" && (
            <ActivityFeed entries={displayHistory} isLoading={historyLoading} onRerunQuery={handleSubmitQuery} />
          )}
          {activeTab === "services" && (
            <ServiceDiscovery services={displayServices} isLoading={servicesLoading} onSelectService={(s) => handleSubmitQuery(`Use ${s.name}`)} />
          )}
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-0">
          <div className="lg:col-span-3">
            <ActivityFeed entries={displayHistory} isLoading={historyLoading} onRerunQuery={handleSubmitQuery} />
          </div>
          <div className="lg:col-span-2">
            <ServiceDiscovery services={displayServices} isLoading={servicesLoading} onSelectService={(s) => handleSubmitQuery(`Use ${s.name}`)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
