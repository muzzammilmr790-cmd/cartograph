import { AnalysisRecord } from "@/lib/db/analyses";

interface DashboardViewProps {
  analyses: AnalysisRecord[];
  orgName?: string;
  orgId?: string;
}

export function DashboardView({ analyses, orgName, orgId }: DashboardViewProps) {
  const getStatusBadge = (status: AnalysisRecord["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            completed
          </span>
        );
      case "parsing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            parsing
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
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/80 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
            Organization Dashboard
          </span>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-200 dark:text-zinc-200 font-medium">{orgName || "Current Team"}</span>
        </div>
        <div className="text-zinc-400 text-[11px]">
          {analyses.length} {analyses.length === 1 ? "Analysis" : "Analyses"}
        </div>
      </div>

      {/* Main Analysis Container */}
      <div className="flex-1 overflow-auto p-4">
        {analyses.length === 0 ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-border rounded-md p-8 bg-surface/20 text-center">
            <div className="w-10 h-10 rounded-full border border-border bg-surface flex items-center justify-center mb-3 text-zinc-400 font-mono text-xs">
              0
            </div>
            <div className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
              No Repository Analyses Found
            </div>
            <p className="text-xs font-mono text-zinc-400 max-w-sm">
              Team <strong className="text-zinc-200 dark:text-zinc-200 font-semibold">{orgName}</strong> ({orgId}) has never run an analysis yet.
            </p>
          </div>
        ) : (
          /* Analysis Dense Table List */
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400 border-b border-border">
              <div className="col-span-5">Repository</div>
              <div className="col-span-2">State</div>
              <div className="col-span-2">Commit</div>
              <div className="col-span-2">Metrics</div>
              <div className="col-span-1 text-right">Created</div>
            </div>

            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="grid grid-cols-12 items-center px-3 py-2.5 rounded border border-border bg-surface/50 hover:bg-surface transition-colors font-mono text-xs text-foreground"
              >
                {/* Repository URL */}
                <div className="col-span-5 truncate pr-2">
                  <span className="font-medium text-foreground truncate block">
                    {analysis.repo_url}
                  </span>
                  {analysis.error_message && (
                    <span className="text-[11px] text-rose-500 truncate block mt-0.5">
                      Error: {analysis.error_message}
                    </span>
                  )}
                </div>

                {/* State Badge */}
                <div className="col-span-2">
                  {getStatusBadge(analysis.status)}
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
                <div className="col-span-1 text-right text-zinc-500 text-[11px]">
                  {new Date(analysis.created_at).toLocaleDateString(undefined, {
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
