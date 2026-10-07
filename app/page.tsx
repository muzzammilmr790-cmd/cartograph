import { getOrProvisionCurrentOrg } from "@/lib/org";
import { OrgSync } from "@/components/org-sync";

export default async function Home() {
  const currentOrg = await getOrProvisionCurrentOrg();

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)] overflow-hidden bg-background text-foreground">
      {currentOrg && (
        <OrgSync
          orgId={currentOrg.orgId}
          needsActiveSet={currentOrg.needsActiveSet}
        />
      )}

      {/* Application Shell Top Status Bar */}
      <div className="flex h-9 items-center justify-between px-4 border-b border-border bg-surface text-xs font-mono select-none">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">Organization:</span>
          <span className="font-semibold text-foreground bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            {currentOrg?.name || "No Organization"}
          </span>
          {currentOrg?.slug && (
            <span className="text-zinc-400 text-[11px]">({currentOrg.slug})</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400 text-[11px]">
          <span>App Shell</span>
          <span className="text-emerald-500 font-medium">● Server Rendered</span>
        </div>
      </div>

      {/* Application Shell 3-Panel Workspace Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Repository & File Explorer */}
        <aside className="w-64 border-r border-border bg-surface/50 p-3 flex flex-col gap-3 shrink-0">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            Repository
          </div>
          <div className="border border-dashed border-border rounded p-3 text-xs font-mono text-zinc-400 flex flex-col gap-1">
            <span>No repository loaded.</span>
            <span className="text-[11px] text-zinc-500">
              Paste a public repo URL to generate dependency map.
            </span>
          </div>
        </aside>

        {/* Center Panel: Map Canvas Viewport */}
        <main className="flex-1 bg-background p-4 flex flex-col items-center justify-center relative">
          <div className="border border-dashed border-border rounded-lg p-8 max-w-md text-center flex flex-col items-center gap-2 bg-surface/30">
            <div className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
              Canvas Viewport
            </div>
            <p className="text-xs font-mono text-zinc-400">
              Active workspace for <strong className="text-foreground">{currentOrg?.name}</strong>.
            </p>
          </div>
        </main>

        {/* Right Panel: Detail & AI Explanation */}
        <aside className="w-80 border-l border-border bg-surface/50 p-3 flex flex-col gap-3 shrink-0">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            Details & Analysis
          </div>
          <div className="border border-dashed border-border rounded p-3 text-xs font-mono text-zinc-400">
            Select a node or file on the map to inspect dependencies and AI explanations.
          </div>
        </aside>
      </div>
    </div>
  );
}
