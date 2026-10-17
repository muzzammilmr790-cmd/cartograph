"use client";

import React, { useMemo, useState } from "react";
import { ParsedFile, ParsedEdge } from "../../lib/parser/types";
import { FileKind, KIND_METADATA, groupFilesByKind } from "../../lib/graph/classify";
import { computeInsights, InsightGroup } from "../../lib/graph/traversal";
import { SelectionState } from "../canvas/graph-canvas";

interface LeftRailProps {
  files: ParsedFile[];
  edges: ParsedEdge[];
  fanInMap: Record<string, number>;
  selectedCategory: FileKind | null;
  onSelectCategory: (category: FileKind | null) => void;
  selection: SelectionState;
  onSelectFile: (fileId: string) => void;
  hoverState: SelectionState;
  onHoverFile: (fileId: string | null) => void;
}

export function LeftRail({
  files,
  edges,
  fanInMap,
  selectedCategory,
  onSelectCategory,
  selection,
  onSelectFile,
  hoverState,
  onHoverFile,
}: LeftRailProps) {
  // Collapsed by default as strictly required by specification
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>("unimported");

  // Category counts
  const categoryCounts = useMemo(() => {
    return groupFilesByKind(files);
  }, [files]);

  // Non-zero categories
  const activeCategories = useMemo(() => {
    const list = Object.entries(categoryCounts) as [FileKind, number][];
    return list.filter(([, count]) => count > 0);
  }, [categoryCounts]);

  // Insights computation - instant arithmetic, no network request
  const insights: InsightGroup[] = useMemo(() => {
    return computeInsights(files, edges, fanInMap);
  }, [files, edges, fanInMap]);

  const handleCategoryClick = (cat: FileKind) => {
    if (selectedCategory === cat) {
      onSelectCategory(null);
    } else {
      onSelectCategory(cat);
    }
  };

  const handleFileClick = (fileId: string) => {
    onSelectFile(fileId);
  };

  const isSelected = (fileId: string) => selection?.type === "file" && selection.id === fileId;
  const isHovered = (fileId: string) => hoverState?.type === "file" && hoverState.id === fileId;

  return (
    <aside className="w-64 border-r border-border bg-surface/50 flex flex-col shrink-0 overflow-hidden select-none">
      {/* Top Section: Categories */}
      <div className="p-3 border-b border-border flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
            Categories
          </span>
          {selectedCategory && (
            <button
              onClick={() => onSelectCategory(null)}
              className="text-[10px] font-mono text-zinc-500 hover:text-foreground transition-colors cursor-pointer"
              title="Clear category filter"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1 max-h-[36vh] overflow-y-auto pr-0.5">
          {activeCategories.map(([kind, count]) => {
            const meta = KIND_METADATA[kind];
            const isCategoryActive = selectedCategory === kind;

            return (
              <div
                key={kind}
                onClick={() => handleCategoryClick(kind)}
                className={`flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded cursor-pointer transition-colors border ${
                  isCategoryActive
                    ? "bg-accent/15 border-accent text-accent font-semibold"
                    : "bg-surface/80 border-border hover:bg-surface text-foreground"
                }`}
                title={`Filter by ${meta.label} (${count} files)`}
              >
                <div className="flex items-center gap-2 truncate pr-1">
                  <div className={`w-2.5 h-2.5 rounded-sm shrink-0 border ${meta.borderClass} ${meta.bgClass}`} />
                  <span className="truncate">{meta.label}</span>
                </div>
                <span className="text-[11px] text-zinc-500 shrink-0 font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Insights (Starts Collapsed) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Collapsible Header */}
        <div
          onClick={() => setIsInsightsOpen(!isInsightsOpen)}
          className="p-3 border-b border-border bg-surface/70 hover:bg-surface flex items-center justify-between cursor-pointer transition-colors shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-mono">
              {isInsightsOpen ? "▼" : "▶"}
            </span>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
              Insights
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-zinc-400">
            {insights.reduce((acc, g) => acc + g.items.length, 0)} findings
          </span>
        </div>

        {/* Expanded Insights Body */}
        {isInsightsOpen && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {insights.map((group) => {
              const isGroupExpanded = expandedInsightId === group.id;

              return (
                <div key={group.id} className="flex flex-col gap-1 border border-border rounded bg-surface/40 p-2">
                  {/* Group Header */}
                  <div
                    onClick={() => setExpandedInsightId(isGroupExpanded ? null : group.id)}
                    className="flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground">
                      <span className="text-[9px] text-zinc-500">
                        {isGroupExpanded ? "▼" : "▶"}
                      </span>
                      <span>{group.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {group.items.length}
                    </span>
                  </div>

                  {/* Fixed One-Sentence Constraint */}
                  <p className="text-[11px] font-mono text-zinc-500 leading-snug mt-0.5">
                    {group.sentence}
                  </p>

                  {/* Group Item List */}
                  {isGroupExpanded && (
                    <div className="flex flex-col gap-1 mt-2 max-h-56 overflow-y-auto pr-1">
                      {group.items.length === 0 ? (
                        <span className="text-[11px] font-mono text-zinc-600 italic">None detected</span>
                      ) : (
                        group.items.map((item) => {
                          const selected = isSelected(item.fileId);
                          const hovered = isHovered(item.fileId);

                          return (
                            <div
                              key={item.fileId}
                              onClick={() => handleFileClick(item.fileId)}
                              onMouseEnter={() => onHoverFile(item.fileId)}
                              onMouseLeave={() => onHoverFile(null)}
                              className={`p-1.5 rounded cursor-pointer font-mono text-xs transition-colors border ${
                                selected
                                  ? "bg-accent/15 border-accent text-accent font-semibold"
                                  : hovered
                                  ? "bg-surface border-border text-foreground"
                                  : "border-transparent hover:bg-surface/60 text-zinc-300"
                              }`}
                              title={item.detail ? `${item.fileId} (${item.detail})` : item.fileId}
                            >
                              <div className="truncate text-blue-400 text-[11px]">
                                {item.fileId}
                              </div>
                              {item.detail && (
                                <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                  {item.detail}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
