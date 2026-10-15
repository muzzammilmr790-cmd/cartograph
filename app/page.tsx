import { getOrProvisionCurrentOrg } from "@/lib/org";
import { syncCurrentOrgToDb, getAnalyses, type AnalysisRecord } from "@/lib/db/analyses";
import { OrgSync } from "@/components/org-sync";
import { DashboardView } from "@/components/dashboard-view";

export default async function Home() {
  const currentOrg = await getOrProvisionCurrentOrg();

  // If user is signed in to an org, sync org parent row and fetch analyses via Supabase RLS
  let analyses: AnalysisRecord[] = [];
  if (currentOrg) {
    try {
      await syncCurrentOrgToDb(currentOrg.orgId, currentOrg.name);
      analyses = await getAnalyses();
    } catch (error) {
      console.error("[Cartograph Page] Org sync / analyses fetch error:", error);
    }
  }

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
          <span>Analyses: {analyses.length}</span>
          <span className="text-emerald-500 font-medium">● Server Rendered</span>
        </div>
      </div>

      {/* Application Shell 3-Panel Workspace Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Repository & File Explorer */}
        <aside className="w-64 border-r border-border bg-surface/50 p-3 flex flex-col gap-3 shrink-0">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            Analyses Overview
          </div>
          {analyses.length === 0 ? (
            <div className="border border-dashed border-border rounded p-3 text-xs font-mono text-zinc-400 flex flex-col gap-1">
              <span>No repositories mapped.</span>
              <span className="text-[11px] text-zinc-500">
                Workspace is empty for this team.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto">
              {analyses.map((a) => (
                <div
                  key={a.id}
                  className="border border-border rounded p-2 text-xs font-mono bg-surface/80 flex flex-col gap-1"
                >
                  <span className="font-medium text-foreground truncate">
                    {a.repo_url.replace("https://github.com/", "")}
                  </span>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="capitalize">{a.status}</span>
                    <span>{a.file_count} files</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Center Panel: Dashboard Viewport */}
        <main className="flex-1 bg-background flex flex-col overflow-hidden">
          <DashboardView
            analyses={analyses}
            orgName={currentOrg?.name}
            orgId={currentOrg?.orgId}
          />
        </main>

        {/* Right Panel: Detail & AI Explanation */}
        <aside className="w-80 border-l border-border bg-surface/50 p-3 flex flex-col gap-3 shrink-0">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
            Details & Analysis
          </div>
          <div className="border border-dashed border-border rounded p-3 text-xs font-mono text-zinc-400">
            Select an analysis or node on the map to inspect dependencies and details.
          </div>
        </aside>
      </div>
    </div>
  );
}
