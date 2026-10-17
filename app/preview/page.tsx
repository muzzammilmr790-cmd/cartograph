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
