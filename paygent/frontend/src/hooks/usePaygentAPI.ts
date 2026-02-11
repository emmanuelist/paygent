/**
 * React Query hooks for Paygent API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, WalletInfo, ServiceInfo, PipelineStatus, ActivityEntry, PipelinePreview } from '@/lib/api';

// Query keys
export const queryKeys = {
  wallet: ['wallet'] as const,
  services: ['services'] as const,
  history: ['history'] as const,
  pipeline: (id: string) => ['pipeline', id] as const,
  health: ['health'] as const,
};

/**
 * Fetch wallet information
 */
export function useWallet() {
  return useQuery<WalletInfo>({
    queryKey: queryKeys.wallet,
    queryFn: () => api.getWallet(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Fetch available services
 */
export function useServices() {
  return useQuery<ServiceInfo[]>({
    queryKey: queryKeys.services,
    queryFn: () => api.getServices(),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch execution history
 */
export function useHistory() {
  return useQuery<ActivityEntry[]>({
    queryKey: queryKeys.history,
    queryFn: () => api.getHistory(),
    staleTime: 5000, // 5 seconds
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

/**
 * Fetch pipeline status
 */
export function usePipelineStatus(id: string | null) {
  return useQuery<PipelineStatus>({
    queryKey: queryKeys.pipeline(id || ''),
    queryFn: () => api.getPipelineStatus(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll every 1 second while running
      const data = query.state.data;
      if (data?.status === 'running' || data?.status === 'planning') {
        return 1000;
      }
      return false; // Stop polling when complete
    },
  });
}

/**
 * Execute a pipeline
 */
export function useExecutePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ query, budget, maxSteps }: { query: string; budget?: number; maxSteps?: number }) =>
      api.executePipeline(query, { budget, maxSteps }),
    onSuccess: () => {
      // Invalidate history when a new pipeline is started
      queryClient.invalidateQueries({ queryKey: queryKeys.history });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

/**
 * Preview a pipeline plan
 */
export function usePreviewPipeline() {
  return useMutation({
    mutationFn: ({ query, maxSteps }: { query: string; maxSteps?: number }) =>
      api.previewPipeline(query, maxSteps),
  });
}

/**
 * Execute a simple task
 */
export function useExecuteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: string) => api.executeTask(query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.history });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

/**
 * Health check
 */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.getHealth(),
    staleTime: 30000,
    retry: false,
  });
}
