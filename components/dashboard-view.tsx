"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnalysisRecord } from "@/lib/db/analyses";
import { startAnalysisAction } from "@/app/actions/analysis";
import { getBrowserSupabase } from "@/lib/db/realtime-client";
import { useAuth } from "@clerk/nextjs";

interface DashboardViewProps {
  analyses: AnalysisRecord[];
  orgName?: string;
  orgId?: string;
}

export function DashboardView({
  analyses: initialAnalyses,
  orgName,
  orgId,
}: DashboardViewProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [analysesList, setAnalysesList] = useState<AnalysisRecord[]>(initialAnalyses);
  const [repoUrlInput, setRepoUrlInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep analysesList in sync with incoming server props
  useEffect(() => {
    setAnalysesList(initialAnalyses);
  }, [initialAnalyses]);

  // Realtime updates for multi-tab synchronization:
  // "4. Open the dashboard in a second tab during a run. The stage updates there too, without a refresh."
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof getBrowserSupabase>["channel"]> | null = null;
    let isMounted = true;

    async function subscribeToDashboardChanges() {
      try {
        const token = await getToken();
        if (!isMounted) return;

        const supabase = getBrowserSupabase(token);
        if (token) {
          await supabase.realtime.setAuth(token);
        }

        channel = supabase
          .channel("dashboard-realtime-feed")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "analyses" },
            (payload) => {
              if (!isMounted) return;
              if (payload.eventType === "INSERT") {
                const newRow = payload.new as AnalysisRecord;
                setAnalysesList((prev) => [newRow, ...prev.filter((a) => a.id !== newRow.id)]);
              } else if (payload.eventType === "UPDATE") {
                const updatedRow = payload.new as AnalysisRecord;
                setAnalysesList((prev) =>
                  prev.map((a) => (a.id === updatedRow.id ? updatedRow : a))
                );
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("[Dashboard Realtime] Subscription warning:", err);
      }
    }

    subscribeToDashboardChanges();

    return () => {
      isMounted = false;
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [getToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoUrlInput.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await startAnalysisAction(trimmed);
        if (!res.success) {
          setErrorMessage(res.error || "Failed to start analysis.");
          return;
        }

        if (res.redirectUrl) {
          router.push(res.redirectUrl);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "An unexpected error occurred.");
      }
    });
  };

  const getStatusBadge = (analysis: AnalysisRecord) => {
    const isStale =
      analysis.status === "parsing" &&
      Date.now() - new Date(analysis.updated_at).getTime() > 5 * 60 * 1000;

    if (isStale) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-amber-500/40 text-amber-500 bg-amber-500/10">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          stale
        </span>
      );
    }

    switch (analysis.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            completed
          </span>
        );
      case "parsing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {analysis.stage ? `parsing (${analysis.stage})` : "parsing"}
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            failed
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-zinc-500/30 text-zinc-600 dark:text-zinc-400 bg-zinc-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            pending
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden bg-background text-foreground font-mono">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/80 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
            Organization Dashboard
          </span>
          <span className="text-zinc-400">/</span>
          <span className="text-foreground font-medium">{orgName || "Current Team"}</span>
        </div>
        <div className="text-zinc-400 text-[11px]">
          {analysesList.length} {analysesList.length === 1 ? "Analysis" : "Analyses"}
        </div>
      </div>

      {/* Repository Submission Form */}
      <div className="p-4 border-b border-border bg-surface/30 shrink-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-2xl">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
            Analyse a Public Repository
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={repoUrlInput}
              onChange={(e) => setRepoUrlInput(e.target.value)}
              placeholder="e.g. https://github.com/facebook/react or expressjs/express"
              disabled={isPending}
              className="flex-1 px-3 py-1.5 rounded bg-surface border border-border text-xs text-foreground placeholder:text-zinc-500 focus:outline-hidden focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isPending || !repoUrlInput.trim()}
              className="px-4 py-1.5 rounded bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer shrink-0 transition-opacity"
            >
              {isPending ? "Starting..." : "Map Repository"}
            </button>
          </div>
          {errorMessage && (
            <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded">
              {errorMessage}
            </div>
          )}
        </form>
      </div>

      {/* Main Analysis Container */}
      <div className="flex-1 overflow-auto p-4">
        {analysesList.length === 0 ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-border rounded-md p-8 bg-surface/20 text-center">
            <div className="w-10 h-10 rounded-full border border-border bg-surface flex items-center justify-center mb-3 text-zinc-400 text-xs">
              0
            </div>
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
              No Repository Analyses Found
            </div>
            <p className="text-xs text-zinc-400 max-w-sm">
              Paste a public GitHub repository URL above to generate your first dependency map.
            </p>
          </div>
        ) : (
          /* Analysis Dense Table List */
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-border">
              <div className="col-span-5">Repository</div>
              <div className="col-span-2">State</div>
              <div className="col-span-2">Commit</div>
              <div className="col-span-2">Metrics</div>
              <div className="col-span-1 text-right">Created</div>
            </div>

            {analysesList.map((analysis) => (
              <div
                key={analysis.id}
                onClick={() => router.push(`/analysis/${analysis.id}`)}
                className="grid grid-cols-12 items-center px-3 py-2.5 rounded border border-border bg-surface/50 hover:bg-surface hover:border-zinc-500/50 transition-all text-xs text-foreground cursor-pointer"
              >
                {/* Repository URL */}
                <div className="col-span-5 truncate pr-2">
                  <span className="font-medium text-foreground truncate block hover:underline">
                    {analysis.repo_url.replace("https://github.com/", "")}
                  </span>
                  {analysis.error_message ? (
                    <span className="text-[11px] text-rose-500 truncate block mt-0.5">
                      Error: {analysis.error_message}
                    </span>
                  ) : analysis.stage_message && analysis.status === "parsing" ? (
                    <span className="text-[11px] text-blue-400 truncate block mt-0.5">
                      {analysis.stage_message}
                    </span>
                  ) : null}
                </div>

                {/* State Badge */}
                <div className="col-span-2">
                  {getStatusBadge(analysis)}
                </div>

                {/* Commit Hash */}
                <div className="col-span-2 text-zinc-400 text-[11px]">
                  {analysis.commit_hash ? (
                    <code className="bg-surface-hover px-1.5 py-0.5 rounded border border-border">
                      {analysis.commit_hash.slice(0, 7)}
                    </code>
                  ) : (
                    " — "
                  )}
                </div>

                {/* Metrics */}
                <div className="col-span-2 text-zinc-400 text-[11px]">
                  <span>{analysis.file_count} files</span>
                  <span className="mx-1 text-zinc-600">·</span>
                  <span>{analysis.edge_count} edges</span>
                </div>

                {/* Date */}
                <div
                  className="col-span-1 text-right text-zinc-500 text-[11px]"
                  suppressHydrationWarning
                >
                  {new Date(analysis.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
