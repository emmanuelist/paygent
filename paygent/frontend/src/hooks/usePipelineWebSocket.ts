/**
 * Real-time pipeline updates via WebSocket
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from './usePaygentAPI';
import { PipelineStep as MockPipelineStep, StepStatus } from '@/data/mock';

export interface PipelineStepState {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  costSTX: number;
  txId?: string;
  output?: any;
  error?: string;
  outputLabel?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface PipelineEvent {
  event: string;
  data: any;
}

/**
 * Hook for real-time pipeline updates via WebSocket
 */
export function usePipelineWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [steps, setSteps] = useState<PipelineStepState[]>([]);
  const [status, setStatus] = useState<'idle' | 'planning' | 'running' | 'complete' | 'failed'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [planningMessage, setPlanningMessage] = useState<string>('');
  const queryClient = useQueryClient();

  useEffect(() => {
    // Connect to WebSocket
    api.connectWebSocket();

    // Check connection status
    const checkConnection = () => {
      setIsConnected(api.isWebSocketConnected());
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 1000);

    // Subscribe to all events
    const unsubscribe = api.on((event: PipelineEvent) => {
      console.log('WebSocket event:', event);
      
      switch (event.event) {
        case 'pipeline:started':
          setCurrentPipelineId(event.data.pipelineId);
          setStatus('planning');
          setPlanningMessage('Starting pipeline...');
          setSteps([]);
          setTotalSteps(0);
          setCurrentStepIndex(0);
          setResult(null);
          setError(null);
          setTotalCost(0);
          break;
        
        case 'pipeline:planning':
          setPlanningMessage(event.data.message || 'Planning...');
          break;

        case 'pipeline:planned':
          setTotalSteps(event.data.totalSteps);
          setSteps(event.data.steps.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            status: 'pending' as StepStatus,
            costSTX: s.costSTX || 0,
            outputLabel: s.outputLabel,
          })));
          setStatus('running');
          break;

        case 'pipeline:step:started':
          setCurrentStepIndex(event.data.stepIndex);
          setSteps(prev => {
            const newSteps = [...prev];
            if (newSteps[event.data.stepIndex]) {
              newSteps[event.data.stepIndex] = {
                ...newSteps[event.data.stepIndex],
                status: 'running',
                startedAt: Date.now(),
              };
            }
            return newSteps;
          });
          break;

        case 'pipeline:step:completed':
          setSteps(prev => {
            const newSteps = [...prev];
            if (newSteps[event.data.stepIndex]) {
              const startedAt = newSteps[event.data.stepIndex].startedAt || Date.now();
              const completedAt = Date.now();
              newSteps[event.data.stepIndex] = {
                ...newSteps[event.data.stepIndex],
                status: 'done',
                costSTX: event.data.step.costSTX || newSteps[event.data.stepIndex].costSTX,
                txId: event.data.step.txId,
                output: event.data.result,
                completedAt,
                durationMs: completedAt - startedAt,
              };
            }
            return newSteps;
          });
          setTotalCost(prev => prev + (event.data.step.costSTX || 0));
          break;

        case 'pipeline:step:failed':
          setSteps(prev => {
            const newSteps = [...prev];
            if (newSteps[event.data.stepIndex]) {
              newSteps[event.data.stepIndex] = {
                ...newSteps[event.data.stepIndex],
                status: 'failed',
                error: event.data.error,
              };
            }
            return newSteps;
          });
          break;

        case 'pipeline:completed':
          setStatus('complete');
          setResult(event.data.result);
          setTotalCost(event.data.totalCost || 0);
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
          queryClient.invalidateQueries({ queryKey: queryKeys.history });
          break;

        case 'pipeline:failed':
          setStatus('failed');
          setError(event.data.error);
          break;
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [queryClient]);

  const reset = useCallback(() => {
    setCurrentPipelineId(null);
    setCurrentStepIndex(0);
    setTotalSteps(0);
    setSteps([]);
    setStatus('idle');
    setResult(null);
    setError(null);
    setTotalCost(0);
  }, []);

  return {
    isConnected,
    currentPipelineId,
    currentStepIndex,
    totalSteps,
    steps,
    status,
    result,
    error,
    totalCost,
    planningMessage,
    reset,
  };
}

/**
 * Hook for managing pipeline execution state
 */
export function usePipelineExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [query, setQuery] = useState('');
  const [localStatus, setLocalStatus] = useState<'idle' | 'planning' | 'running' | 'complete' | 'failed'>('idle');
  const wsState = usePipelineWebSocket();

  // Sync local status with WebSocket status when WebSocket takes over
  useEffect(() => {
    if (wsState.status !== 'idle') {
      setLocalStatus(wsState.status);
    }
  }, [wsState.status]);

  // Track execution state based on WebSocket status
  useEffect(() => {
    if (wsState.status === 'complete' || wsState.status === 'failed') {
      setIsExecuting(false);
    }
  }, [wsState.status]);

  const execute = useCallback(async (queryText: string, options?: { budget?: number; maxSteps?: number }) => {
    setIsExecuting(true);
    setQuery(queryText);
    setLocalStatus('planning'); // Immediately show planning state
    wsState.reset();

    try {
      const response = await api.executePipeline(queryText, options);
      // The WebSocket will handle the updates
      return response;
    } catch (err: any) {
      setIsExecuting(false);
      setLocalStatus('failed');
      throw err;
    }
  }, [wsState]);

  const reset = useCallback(() => {
    setIsExecuting(false);
    setQuery('');
    setLocalStatus('idle');
    wsState.reset();
  }, [wsState]);

  // Use localStatus which is set immediately, then WebSocket takes over
  const effectiveStatus = wsState.status !== 'idle' ? wsState.status : localStatus;

  return {
    ...wsState,
    status: effectiveStatus,
    isExecuting: isExecuting || effectiveStatus === 'planning' || effectiveStatus === 'running',
    query,
    execute,
    reset,
  };
}
