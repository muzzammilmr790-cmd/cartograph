import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnalysisById, getAnalysisGraph } from "@/lib/db/analyses";
import { Workspace } from "@/components/workspace/workspace";
import { ProgressView } from "@/components/analysis/progress-view";

interface AnalysisPageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;

  // 1. Try to load completed analysis and full dependency graph
  const graphResult = await getAnalysisGraph(id);

  if (graphResult && graphResult.analysis.status === "completed") {
    const { analysis, graph } = graphResult;

    return (
      <div className="flex flex-col flex-1 h-[calc(100vh-3rem)] overflow-hidden bg-background text-foreground">
        {/* Top Header Bar */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-border bg-surface text-xs font-mono select-none shrink-0">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-zinc-400 hover:text-foreground transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="font-semibold text-foreground truncate max-w-sm">
              {analysis.repo_url.replace("https://github.com/", "")}
            </span>
            {analysis.commit_hash && (
              <code className="text-[11px] text-zinc-400 bg-surface-hover px-1.5 py-0.5 rounded border border-border">
                {analysis.commit_hash.slice(0, 7)}
              </code>
            )}
          </div>
          <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
            <span>{graph.files.length} files</span>
            <span>{graph.edges.length} edges</span>
            <span className="text-emerald-500 font-medium">● Stored Analysis</span>
          </div>
        </div>

        {/* 3-Panel Explorer Reading Real Database Rows */}
        <div className="flex flex-1 overflow-hidden relative">
          <Workspace data={graph} />
        </div>
      </div>
    );
  }

  // 2. If not completed, load analysis row to show live progress or failed state
  const analysis = await getAnalysisById(id);
  if (!analysis) {
    notFound();
  }

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3rem)] overflow-hidden bg-background text-foreground">
      <ProgressView initialAnalysis={analysis} />
    </div>
  );
}
