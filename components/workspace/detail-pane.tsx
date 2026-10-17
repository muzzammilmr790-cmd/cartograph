"use client";

import React, { useMemo, useState, useCallback } from "react";
import { ParseResult } from "../../lib/parser/types";
import { SelectionState } from "../canvas/graph-canvas";
import { FoldedNode } from "../../lib/graph/fold";
import { classifyFile, groupFilesByKind, KIND_METADATA, FileKind } from "../../lib/graph/classify";
import { walkTransitive } from "../../lib/graph/traversal";

interface DetailPaneProps {
  data: ParseResult;
  foldedNodes: FoldedNode[];
  selection: SelectionState;
  onSelectionChange: (s: SelectionState) => void;
  hoverState: SelectionState;
  onHoverChange: (s: SelectionState) => void;
}

type Tab = "structure" | "explanation";

export function DetailPane({ data, foldedNodes, selection, onSelectionChange, hoverState, onHoverChange }: DetailPaneProps) {
  const [activeTab, setActiveTab] = useState<Tab>("structure");
  const [activeWalk, setActiveWalk] = useState<"incoming" | "outgoing" | null>(null);

  // Summaries when nothing is selected
  const repoSummary = useMemo(() => {
    if (selection) return null;

    const kindCounts = groupFilesByKind(data.files);
    const routesCount = kindCounts.Route;
    const unidentifiedCount = kindCounts.Unidentified;
    
    let framework = "TypeScript";
    if (data.files.some((f) => f.path.includes("app/"))) {
      framework = "Next.js App Router (detected)";
    } else if (data.files.some((f) => f.path.includes("pages/"))) {
      framework = "Next.js Pages Router (detected)";
    } else if (data.files.some((f) => f.path.includes("vite.config"))) {
      framework = "Vite (detected)";
    }
    
    const sortedByFanIn = [...data.files].sort((a, b) => (data.fanIn[b.id] || 0) - (data.fanIn[a.id] || 0)).slice(0, 10);
    const unimported = data.files.filter((f) => (data.fanIn[f.id] || 0) === 0);

    return { routesCount, unidentifiedCount, framework, sortedByFanIn, unimported, kindCounts };
  }, [data, selection]);

  // Specific selections
  const selectedFile = useMemo(() => {
    if (selection?.type === "file") {
      return data.files.find((f) => f.id === selection.id);
    }
    return null;
  }, [data.files, selection]);

  const selectedFolderNode = useMemo(() => {
    if (selection?.type === "node") {
      const found = foldedNodes.find((fn) => fn.id === selection.id);
      if (found) {
        return { id: found.id, label: found.label, files: found.files };
      }
    }
    return null;
  }, [foldedNodes, selection]);

  const selectedFileKind = useMemo(() => {
    if (!selectedFile) return null;
    return classifyFile(selectedFile.path);
  }, [selectedFile]);

  const folderComposition = useMemo(() => {
    if (!selectedFolderNode) return [];
    const counts = groupFilesByKind(selectedFolderNode.files);
    return (Object.entries(counts) as [FileKind, number][]).filter(([, count]) => count > 0);
  }, [selectedFolderNode]);

  const folderStats = useMemo(() => {
    if (!selectedFolderNode) return { imports: 0, dependents: 0 };
    const folderFileIds = new Set(selectedFolderNode.files.map((f) => f.id));
    const imports = data.edges.filter((e) => folderFileIds.has(e.source) && !folderFileIds.has(e.target)).length;
    const dependents = data.edges.filter((e) => folderFileIds.has(e.target) && !folderFileIds.has(e.source)).length;
    return { imports, dependents };
  }, [data.edges, selectedFolderNode]);

  const fileDependencies = useMemo(() => {
    if (!selectedFile) return null;
    const imports = data.edges.filter((e) => e.source === selectedFile.id).map((e) => e.target);
    const importedBy = data.edges.filter((e) => e.target === selectedFile.id).map((e) => e.source);
    return { imports, importedBy };
  }, [data.edges, selectedFile]);

  const blastRadius = useMemo(() => {
    if (!selectedFile) return [];
    return walkTransitive(data.edges, selectedFile.id, "incoming", 2);
  }, [data.edges, selectedFile]);

  const dependencyChain = useMemo(() => {
    if (!selectedFile) return [];
    return walkTransitive(data.edges, selectedFile.id, "outgoing", 2);
  }, [data.edges, selectedFile]);

  // Click handler
  const handleFileClick = useCallback(
    (id: string) => {
      onSelectionChange({ id, type: "file" });
    },
    [onSelectionChange]
  );

  const handleMouseEnter = useCallback(
    (id: string) => {
      onHoverChange({ id, type: "file" });
    },
    [onHoverChange]
  );

  const handleMouseLeave = useCallback(() => {
    onHoverChange(null);
  }, [onHoverChange]);

  const isHovered = (id: string) => hoverState?.id === id;

  if (!selection) {
    // Empty state / Repository Summary
    return (
      <aside className="w-80 border-l border-border bg-surface/50 flex flex-col shrink-0">
        <div className="p-3 border-b border-border bg-surface/80 flex flex-col gap-1">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Repository Summary</div>
          <div className="font-semibold text-foreground text-sm truncate">mock-repo</div>
          <div className="text-xs text-emerald-500 font-mono mt-0.5">{repoSummary?.framework}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-5">
          <div className="flex justify-between items-center text-xs font-mono bg-surface p-2 rounded border border-border">
            <div className="flex flex-col items-center flex-1">
              <span className="text-zinc-500">Files</span>
              <span className="font-semibold">{data.files.length}</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex flex-col items-center flex-1">
              <span className="text-zinc-500">Imports</span>
              <span className="font-semibold">{data.edges.length}</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex flex-col items-center flex-1">
              <span className="text-zinc-500">Routes</span>
              <span className="font-semibold">{repoSummary?.routesCount}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
              Most Depended On
            </div>
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
              {repoSummary?.sortedByFanIn.map((f) => (
                <div 
                  key={f.id} 
                  className={`flex justify-between items-center text-xs font-mono p-1.5 rounded cursor-pointer ${isHovered(f.id) ? "bg-surface border border-border" : "hover:bg-surface/50 border border-transparent"}`}
                  onClick={() => handleFileClick(f.id)}
                  onMouseEnter={() => handleMouseEnter(f.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <span className="truncate pr-2 text-blue-400">{f.id}</span>
                  <span className="text-zinc-500 shrink-0">{data.fanIn[f.id] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
              Entry Points (0 In)
            </div>
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
              {repoSummary?.unimported.slice(0, 15).map((f) => (
                <div 
                  key={f.id} 
                  className={`flex text-xs font-mono p-1.5 rounded cursor-pointer ${isHovered(f.id) ? "bg-surface border border-border" : "hover:bg-surface/50 border border-transparent"}`}
                  onClick={() => handleFileClick(f.id)}
                  onMouseEnter={() => handleMouseEnter(f.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <span className="truncate text-blue-400">{f.id}</span>
                </div>
              ))}
            </div>
          </div>

          {repoSummary?.unidentifiedCount !== undefined && repoSummary.unidentifiedCount > 0 && (
            <div className="text-xs font-mono text-amber-500/90 bg-amber-500/10 p-2 rounded border border-amber-500/20">
              {repoSummary.unidentifiedCount} files could not be identified by convention.
            </div>
          )}
        </div>
      </aside>
    );
  }

  // File or Folder selected
  const fileMeta = selectedFileKind ? KIND_METADATA[selectedFileKind] : null;

  return (
    <aside className="w-80 border-l border-border bg-surface/50 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border bg-surface/80 flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider shrink-0">
              {selection.type === "file" ? "File" : "Folder"}
            </span>
            {fileMeta && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${fileMeta.borderClass} ${fileMeta.bgClass} ${fileMeta.colorClass}`}>
                {fileMeta.label}
              </span>
            )}
          </div>
          <button 
            onClick={() => onSelectionChange(null)}
            className="text-xs text-zinc-500 hover:text-foreground transition-colors"
            title="Deselect (Return to Summary)"
          >
            ✕
          </button>
        </div>

        <div className="font-mono text-sm text-blue-400 break-all leading-tight">
          {selection.id}
        </div>

        {selectedFile && (
          <div className="text-xs font-mono text-zinc-500 flex gap-3">
            <span>{selectedFile.lineCount} lines</span>
            <span>{fileDependencies?.imports.length} imports</span>
            <span>{fileDependencies?.importedBy.length} dependents</span>
          </div>
        )}

        {selectedFolderNode && (
          <div className="text-xs font-mono text-zinc-500 flex gap-3">
            <span>{selectedFolderNode.files.length} files</span>
            <span>{folderStats.imports} imports</span>
            <span>{folderStats.dependents} dependents</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface/30 font-mono text-xs select-none">
        <div 
          className={`flex-1 text-center py-2 cursor-pointer border-b-2 transition-colors ${activeTab === "structure" ? "border-blue-500 text-foreground" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          onClick={() => setActiveTab("structure")}
        >
          Structure
        </div>
        <div 
          className={`flex-1 text-center py-2 cursor-pointer border-b-2 transition-colors ${activeTab === "explanation" ? "border-blue-500 text-foreground" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          onClick={() => setActiveTab("explanation")}
        >
          Explanation
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "explanation" ? (
          <div className="text-xs font-mono text-zinc-400 text-center mt-8 italic">
            Explanation is not available yet.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {selection.type === "node" && selectedFolderNode && (
              <>
                {/* Breakdown by Kind */}
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                    Composition
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                    {folderComposition.map(([kind, count]) => {
                      const meta = KIND_METADATA[kind];
                      return (
                        <div key={kind} className={`flex items-center justify-between p-1.5 rounded border ${meta.borderClass} ${meta.bgClass}`}>
                          <span className={meta.colorClass}>{meta.label}</span>
                          <span className="font-semibold text-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* File Contents */}
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                    Files ({selectedFolderNode.files.length})
                  </div>
                  <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
                    {selectedFolderNode.files.map((f) => {
                      const fKind = classifyFile(f.path);
                      const fMeta = KIND_METADATA[fKind];
                      return (
                        <div 
                          key={f.id} 
                          className={`flex items-center justify-between text-xs font-mono p-1.5 rounded cursor-pointer ${isHovered(f.id) ? "bg-surface border border-border" : "hover:bg-surface/50 border border-transparent"}`}
                          onClick={() => handleFileClick(f.id)}
                          onMouseEnter={() => handleMouseEnter(f.id)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <span className="truncate text-blue-400">{f.path.replace(selectedFolderNode.id + "/", "")}</span>
                          <span className={`text-[10px] shrink-0 ml-1.5 ${fMeta.colorClass}`}>{fMeta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {selection.type === "file" && fileDependencies && (
              <>
                {/* Blast Radius & Dependency Chain Action Buttons */}
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveWalk(activeWalk === "incoming" ? null : "incoming")}
                      className={`py-1.5 px-2 text-xs font-mono rounded border transition-colors cursor-pointer text-center ${
                        activeWalk === "incoming"
                          ? "bg-accent/20 border-accent text-accent font-semibold"
                          : "bg-surface border-border text-foreground hover:bg-surface-hover"
                      }`}
                      title="Transitive walk: everything that breaks if this file changes (2 levels)"
                    >
                      Blast radius
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveWalk(activeWalk === "outgoing" ? null : "outgoing")}
                      className={`py-1.5 px-2 text-xs font-mono rounded border transition-colors cursor-pointer text-center ${
                        activeWalk === "outgoing"
                          ? "bg-accent/20 border-accent text-accent font-semibold"
                          : "bg-surface border-border text-foreground hover:bg-surface-hover"
                      }`}
                      title="Transitive walk: everything this file needs (2 levels)"
                    >
                      Dependency chain
                    </button>
                  </div>
                </div>

                {/* Transitive Walk Result Section */}
                {activeWalk === "incoming" && (
                  <div className="flex flex-col gap-2 border border-accent/30 bg-accent/5 p-2.5 rounded">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-accent">
                        Blast Radius ({blastRadius.length})
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">2 levels</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400">
                      Everything that breaks if this file changes.
                    </p>
                    {blastRadius.length === 0 ? (
                      <span className="text-xs font-mono text-zinc-500">No transitive dependents within 2 levels.</span>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-0.5">
                        {blastRadius.map((item) => (
                          <div
                            key={item.fileId}
                            className={`flex items-center justify-between text-xs font-mono p-1.5 rounded cursor-pointer transition-colors ${
                              isHovered(item.fileId) ? "bg-surface border border-border" : "hover:bg-surface/50 border border-transparent"
                            }`}
                            onClick={() => handleFileClick(item.fileId)}
                            onMouseEnter={() => handleMouseEnter(item.fileId)}
                            onMouseLeave={handleMouseLeave}
                          >
                            <span className="truncate text-blue-400 pr-2">{item.fileId}</span>
                            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface border border-border text-zinc-400 shrink-0">
                              L{item.depth}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeWalk === "outgoing" && (
                  <div className="flex flex-col gap-2 border border-accent/30 bg-accent/5 p-2.5 rounded">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-accent">
                        Dependency Chain ({dependencyChain.length})
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">2 levels</span>
                    </div>
                    <p className="text-[11px] font-mono text-zinc-400">
                      Everything this file needs.
                    </p>
                    {dependencyChain.length === 0 ? (
                      <span className="text-xs font-mono text-zinc-500">No transitive dependencies within 2 levels.</span>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-0.5">
                        {dependencyChain.map((item) => (
                          <div
                            key={item.fileId}
                            className={`flex items-center justify-between text-xs font-mono p-1.5 rounded cursor-pointer transition-colors ${
                              isHovered(item.fileId) ? "bg-surface border border-border" : "hover:bg-surface/50 border border-transparent"
                            }`}
                            onClick={() => handleFileClick(item.fileId)}
                            onMouseEnter={() => handleMouseEnter(item.fileId)}
                            onMouseLeave={handleMouseLeave}
                          >
                            <span className="truncate text-blue-400 pr-2">{item.fileId}</span>
                            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface border border-border text-zinc-400 shrink-0">
                              L{item.depth}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500 flex justify-between">
                    <span>Direct Imports</span>
                    <span>{fileDependencies.imports.length}</span>
                  </div>
                  {fileDependencies.imports.length === 0 ? (
                    <span className="text-xs font-mono text-zinc-500">None</span>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
                      {fileDependencies.imports.map((depId) => (
                        <div 
                          key={depId} 
                          className={`text-xs font-mono p-1.5 rounded cursor-pointer ${isHovered(depId) ? "bg-surface border border-border" : "hover:bg-surface/50 border border-transparent"}`}
                          onClick={() => handleFileClick(depId)}
                          onMouseEnter={() => handleMouseEnter(depId)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <span className="truncate text-blue-400 block">{depId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500 flex justify-between">
                    <span>Directly Imported By</span>
                    <span>{fileDependencies.importedBy.length}</span>
                  </div>
                  {fileDependencies.importedBy.length === 0 ? (
                    <span className="text-xs font-mono text-zinc-500">None</span>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
                      {fileDependencies.importedBy.map((depId) => (
                        <div 
                          key={depId} 
                          className={`text-xs font-mono p-1.5 rounded cursor-pointer ${isHovered(depId) ? "bg-surface border border-border" : "hover:bg-surface/50 border border-transparent"}`}
                          onClick={() => handleFileClick(depId)}
                          onMouseEnter={() => handleMouseEnter(depId)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <span className="truncate text-blue-400 block">{depId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
