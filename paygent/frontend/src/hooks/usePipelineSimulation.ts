import { useState, useEffect, useRef } from "react";
import { PipelineExecution } from "@/data/mock";
import { mockStepResults } from "@/data/mock";

export function usePipelineSimulation(
  initialExecution: PipelineExecution | null
): PipelineExecution | null {
  const [execution, setExecution] = useState<PipelineExecution | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clear previous timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    if (!initialExecution) {
      setExecution(null);
      return;
    }

    // Initialize with all steps pending
    setExecution({ ...initialExecution });

    const stepCount = initialExecution.steps.length;
    const timings = [
      { startDelay: 500, runDuration: 2000 },
      { startDelay: 0, runDuration: 3000 },
      { startDelay: 0, runDuration: 2000 },
    ];

    let cumulativeDelay = 0;

    for (let i = 0; i < stepCount; i++) {
      const { startDelay, runDuration } = timings[i] || { startDelay: 0, runDuration: 2000 };
      cumulativeDelay += startDelay;

      // Transition to "running"
      const runningDelay = cumulativeDelay;
      const t1 = setTimeout(() => {
        setExecution((prev) => {
          if (!prev) return prev;
          const steps = prev.steps.map((s, idx) =>
            idx === i ? { ...s, status: "running" as const } : s
          );
          return { ...prev, steps };
        });
      }, runningDelay);
      timeoutsRef.current.push(t1);

      // Transition to "done"
      cumulativeDelay += runDuration;
      const doneDelay = cumulativeDelay;
      const result = mockStepResults[i];

      const t2 = setTimeout(() => {
        setExecution((prev) => {
          if (!prev) return prev;
          const steps = prev.steps.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: "done" as const,
                  txHash: result?.txHash,
                  costSTX: result?.costSTX,
                  output: result?.output,
                  durationMs: runDuration,
                }
              : s
          );
          const newSpent = steps
            .filter((s) => s.status === "done" && s.costSTX)
            .reduce((sum, s) => sum + (s.costSTX || 0), 0);
          const remainingSteps = steps.filter((s) => s.status !== "done").length;
          const etaPerStep = 2.5;
          const isDone = remainingSteps === 0;

          return {
            ...prev,
            steps,
            spentSTX: Math.round(newSpent * 100) / 100,
            etaSeconds: isDone ? 0 : Math.round(remainingSteps * etaPerStep),
            status: isDone ? "done" : "running",
            finalOutput: isDone
              ? steps[steps.length - 1]?.output
              : prev.finalOutput,
          };
        });
      }, doneDelay);
      timeoutsRef.current.push(t2);
    }

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [initialExecution]);

  return execution;
}
