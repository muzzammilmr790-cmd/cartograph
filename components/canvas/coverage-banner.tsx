"use client";

import React, { useState } from "react";
import { CoverageReport } from "../../lib/parser/types";

interface CoverageBannerProps {
  coverage: CoverageReport;
}

export function CoverageBanner({ coverage }: CoverageBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalFiles = coverage.totalFilesFound || 1;
  const parsedFiles = coverage.totalFilesParsed || 0;
  const fileCoveragePct = Math.round((parsedFiles / totalFiles) * 100);

  const totalImports = coverage.totalImports || 0;
  const resolvedImports = coverage.resolvedImports || 0;
  const unresolvedImports = coverage.unresolvedImports || 0;
  const importCoveragePct =
    totalImports > 0 ? Math.round((resolvedImports / totalImports) * 100) : 100;

  const isPartial = fileCoveragePct < 95 || unresolvedImports > 0;

  // If complete (>= 95% and 0 unresolved), show subtle unobtrusive badge
  if (!isPartial) {
    return (
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface/90 border border-border text-[11px] font-mono text-zinc-400 backdrop-blur-xs select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>Coverage: {fileCoveragePct}%</span>
        <span className="text-zinc-600">·</span>
        <span>{parsedFiles} files</span>
      </div>
    );
  }

  // Partial Graph Banner (Collapsible to a single persistent line naming the figure)
  return (
    <div className="absolute top-3 left-3 z-20 max-w-lg bg-surface/95 border border-amber-500/40 rounded-md shadow-md backdrop-blur-sm font-mono text-xs overflow-hidden transition-all">
      {/* Collapsed Persistent Single Line Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-semibold tracking-wide">
            Partial Graph: {fileCoveragePct}% coverage
          </span>
          {unresolvedImports > 0 && (
            <span className="text-[11px] opacity-80">
              ({unresolvedImports} unresolved {unresolvedImports === 1 ? "import" : "imports"})
            </span>
          )}
        </div>
        <button
          type="button"
          className="text-[11px] underline ml-3 text-amber-600 dark:text-amber-300 hover:opacity-80"
        >
          {isExpanded ? "Collapse ▲" : "Details ▼"}
        </button>
      </div>

      {/* Expanded Breakdown */}
      {isExpanded && (
        <div className="p-3 border-t border-amber-500/20 text-foreground bg-surface/90 flex flex-col gap-2 max-h-64 overflow-y-auto">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            The dependency graph is partial. Files or imports could not be fully resolved:
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px] border border-border/50 rounded p-2 bg-surface/50">
            <div>
              <span className="text-zinc-500 block">Files Parsed:</span>
              <span className="font-semibold text-foreground">
                {parsedFiles} / {coverage.totalFilesFound} ({fileCoveragePct}%)
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Imports Resolved:</span>
              <span className="font-semibold text-foreground">
                {resolvedImports} / {totalImports} ({importCoveragePct}%)
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Skipped Files:</span>
              <span className="font-semibold text-amber-500">
                {coverage.totalFilesSkipped}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Unresolved Imports:</span>
              <span className="font-semibold text-rose-500">
                {unresolvedImports}
              </span>
            </div>
          </div>

          {coverage.skippedFiles && coverage.skippedFiles.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[11px] font-semibold text-zinc-400">
                Skipped Files ({coverage.skippedFiles.length}):
              </span>
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto text-[11px]">
                {coverage.skippedFiles.slice(0, 5).map((sf, idx) => (
                  <div key={idx} className="flex flex-col text-zinc-400">
                    <span className="text-foreground truncate">{sf.path}</span>
                    <span className="text-zinc-500 text-[10px] truncate">{sf.reason}</span>
                  </div>
                ))}
                {coverage.skippedFiles.length > 5 && (
                  <span className="text-zinc-500 text-[10px]">
                    + {coverage.skippedFiles.length - 5} more skipped files
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
