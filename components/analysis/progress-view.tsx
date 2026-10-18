"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnalysisRecord } from "@/lib/db/analyses";
import { PipelineStage, AnalysisStatus } from "@/lib/pipeline/types";
import { useAnalysisRealtime, AnalysisStageBroadcast } from "@/lib/db/realtime-client";
import { retryAnalysisAction } from "@/app/actions/analysis";

interface ProgressViewProps {
  initialAnalysis: AnalysisRecord;
}

const STAGES: { key: PipelineStage; label: string; desc: string }[] = [
  { key: "fetch", label: "Fetch", desc: "Download public repository archive and verify commit" },
  { key: "select", label: "Select", desc: "Inspect candidate TypeScript and JavaScript files" },
  { key: "parse", label: "Parse", desc: "AST parsing, module imports, re-exports, dynamic imports" },
  { key: "store", label: "Store", desc: "Persist dependency graph, coverage report, and metrics" },
];

export function ProgressView({ initialAnalysis }: ProgressViewProps) {
  const router = useRouter();

  const [status, setStatus] = useState<AnalysisStatus>(initialAnalysis.status);
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(
    initialAnalysis.stage ?? "fetch"
  );
  const [stageMessage, setStageMessage] = useState<string>(
    initialAnalysis.stage_message ?? "Initializing analysis..."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialAnalysis.error_message ?? null
  );
  const [isRetrying, setIsRetrying] = useState(false);

  // Check if stale (unfinished and older than 5 minutes)
  const isStale =
    status === "parsing" &&
    Date.now() - new Date(initialAnalysis.updated_at).getTime() > 5 * 60 * 1000;

  // Handle live Realtime updates from database trigger
  const handleRealtimeUpdate = useCallback(
    (payload: AnalysisStageBroadcast) => {
      if (payload.status) {
        setStatus(payload.status);
      }
      if (payload.stage) {
        setCurrentStage(payload.stage);
      }
      if (payload.message) {
        setStageMessage(payload.message);
      }
      if (payload.status === "completed") {
        router.refresh();
      } else if (payload.status === "failed") {
        setErrorMessage(payload.message);
      }
    },
    [router]
  );

  useAnalysisRealtime({
    analysisId: initialAnalysis.id,
    onUpdate: handleRealtimeUpdate,
    enabled: status === "parsing" || status === "pending",
  });

  // Secondary fallback poll (every 3s) in case WebSocket connection is blocked
  useEffect(() => {
    if (status !== "parsing" && status !== "pending") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/analyses/${initialAnalysis.id}`);
        if (res.ok) {
          const data: AnalysisRecord = await res.json();
          if (data.status !== status) {
            setStatus(data.status);
          }
          if (data.stage && data.stage !== currentStage) {
            setCurrentStage(data.stage);
          }
          if (data.stage_message) {
            setStageMessage(data.stage_message);
          }
          if (data.status === "completed") {
            router.refresh();
          } else if (data.status === "failed") {
            setErrorMessage(data.error_message || "Analysis failed.");
          }
        }
      } catch {
        // Silently continue
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [initialAnalysis.id, status, currentStage, router]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await retryAnalysisAction(initialAnalysis.id);
      if (res.success) {
        setStatus("parsing");
        setCurrentStage("fetch");
        setStageMessage("Retrying analysis...");
        setErrorMessage(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStageIndex = (stage: PipelineStage | null) => {
    if (!stage) return 0;
    return STAGES.findIndex((s) => s.key === stage);
  };

  const activeIdx = getStageIndex(currentStage);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 bg-background text-foreground font-mono">
      <div className="w-full max-w-xl border border-border rounded-lg bg-surface/60 p-6 shadow-sm flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-1 border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Repository Pipeline
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                status === "failed"
                  ? "border-rose-500/30 text-rose-500 bg-rose-500/10"
                  : isStale
                  ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                  : "border-blue-500/30 text-blue-500 bg-blue-500/10 animate-pulse"
              }`}
            >
              {status === "failed" ? "Failed" : isStale ? "Stale" : "Running"}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-foreground truncate">
            {initialAnalysis.repo_url}
          </h2>
        </div>

        {/* Failure Box */}
        {status === "failed" && (
          <div className="border border-rose-500/40 rounded p-4 bg-rose-500/10 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-500">
              <span>● Analysis Failed at Stage [{currentStage || "pipeline"}]</span>
            </div>
            <p className="text-xs text-rose-400 break-words leading-relaxed">
              {errorMessage || initialAnalysis.error_message || "An unexpected error occurred."}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-3 py-1.5 rounded bg-foreground text-background text-xs font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                {isRetrying ? "Starting..." : "Retry Analysis"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="px-3 py-1.5 rounded border border-border text-foreground text-xs font-medium hover:bg-surface-hover cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Stale Warning Box */}
        {isStale && (
          <div className="border border-amber-500/40 rounded p-3 bg-amber-500/10 flex flex-col gap-2">
            <span className="text-xs font-semibold text-amber-500">
              Run appears abandoned or timed out (&gt; 5m)
            </span>
            <p className="text-[11px] text-amber-400">
              The analysis process has not reported progress recently. You can trigger a fresh retry.
            </p>
            <div>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-3 py-1 text-xs rounded bg-amber-500 text-black font-semibold hover:opacity-90"
              >
                {isRetrying ? "Starting..." : "Restart Run"}
              </button>
            </div>
          </div>
        )}

        {/* Live Named Stages Progress List */}
        <div className="flex flex-col gap-3">
          {STAGES.map((s, idx) => {
            const isCompleted = status === "completed" || (status !== "failed" && idx < activeIdx);
            const isCurrent = status === "parsing" && idx === activeIdx;
            const isPending = idx > activeIdx && status !== "completed";
            const isFailedStage = status === "failed" && s.key === currentStage;

            return (
              <div
                key={s.key}
                className={`flex items-start gap-3 p-3 rounded border transition-colors ${
                  isCurrent
                    ? "border-blue-500/40 bg-blue-500/5 text-foreground"
                    : isCompleted
                    ? "border-emerald-500/30 bg-surface text-zinc-300"
                    : isFailedStage
                    ? "border-rose-500/40 bg-rose-500/5 text-rose-400"
                    : "border-border/40 bg-surface/30 text-zinc-500"
                }`}
              >
                {/* Stage Indicator Icon */}
                <div className="mt-0.5">
                  {isCompleted ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px]">
                      ✓
                    </div>
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  ) : isFailedStage ? (
                    <div className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-[10px]">
                      ✕
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-zinc-600 flex items-center justify-center text-[9px] text-zinc-500">
                      {idx + 1}
                    </div>
                  )}
                </div>

                {/* Stage Info */}
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs tracking-wide">
                      {s.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 capitalize">
                      {isCompleted ? "Completed" : isCurrent ? "Active" : isFailedStage ? "Failed" : "Pending"}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">{s.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Message Bar */}
        {status === "parsing" && (
          <div className="border border-border/80 rounded p-2.5 bg-surface text-[11px] text-zinc-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="truncate">{stageMessage}</span>
          </div>
        )}

        {/* Back Link */}
        <div className="flex justify-between items-center pt-2 text-[11px] text-zinc-500 border-t border-border">
          <span>Live updates via Supabase Realtime</span>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-foreground hover:underline cursor-pointer"
          >
            ← Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
