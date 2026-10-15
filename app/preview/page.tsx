import React from "react";
import fs from "node:fs/promises";
import path from "node:path";
import { ParseResult } from "../../lib/parser/types";
import { Workspace } from "../../components/workspace/workspace";

export default async function PreviewPage() {
  let mockData: ParseResult | null = null;
  try {
    const dataPath = path.join(process.cwd(), "data", "mock-repo.json");
    const raw = await fs.readFile(dataPath, "utf8");
    mockData = JSON.parse(raw);
  } catch (error) {
    console.error("Failed to load mock data:", error);
  }

  return (
    <div className="flex flex-1 h-[calc(100vh-3rem)] overflow-hidden bg-background text-foreground">
      {/* Left Rail: Categories */}
      <aside className="w-64 border-r border-border bg-surface/50 p-3 flex flex-col gap-3 shrink-0">
        <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
          Categories
        </div>
        <div className="flex flex-col gap-2">
          {/* Static scaffolding for categories */}
          <div className="flex items-center justify-between text-xs font-mono p-2 border border-border rounded bg-surface/80">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Components</span>
            </div>
            <span className="text-zinc-500">24</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono p-2 border border-border rounded bg-surface/80">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Utilities</span>
            </div>
            <span className="text-zinc-500">12</span>
          </div>
        </div>
      </aside>

      {/* Workspace (Canvas + Detail Pane) */}
      {mockData ? (
        <Workspace data={mockData} />
      ) : (
        <main className="flex-1 bg-background flex flex-col overflow-hidden relative">
          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-zinc-400">
            Mock data not found. Run parser first.
          </div>
        </main>
      )}
    </div>
  );
}
