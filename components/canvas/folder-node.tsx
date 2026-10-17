import React, { useCallback, useRef, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { ParsedFile } from "../../lib/parser/types";
import { SelectionState } from "./graph-canvas";
import { FileKind, classifyFile } from "../../lib/graph/classify";

interface FolderNodeData {
  id: string;
  label: string;
  files: ParsedFile[];
  isOpen: boolean;
  totalFanIn: number;
  totalFanOut: number;
  selectedCategory?: FileKind | null;
  categoryMatchCount?: number;
  onToggle: (id: string) => void;
  onSelectFile: (id: string) => void;
  selection: SelectionState;
  hoverState: SelectionState;
  activeFileIds: Set<string>;
  onHoverFile: (id: string) => void;
  onHoverLeave: () => void;
}

export const FolderNode = React.memo(function FolderNode({ data }: { data: FolderNodeData }) {
  const {
    id,
    label,
    files,
    isOpen,
    totalFanIn,
    totalFanOut,
    selectedCategory,
    categoryMatchCount,
    onToggle,
    onSelectFile,
    selection,
    hoverState,
    activeFileIds,
    onHoverFile,
    onHoverLeave,
  } = data;

  const updateNodeInternals = useUpdateNodeInternals();
  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      updateNodeInternals(id);
      rafRef.current = null;
    });
  }, [id, updateNodeInternals]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Node selection status
  const isNodeSelected = selection?.type === "node" && selection.id === id;

  const matchCount = selectedCategory
    ? (categoryMatchCount ?? files.filter((f) => classifyFile(f.path) === selectedCategory).length)
    : undefined;

  if (!isOpen) {
    return (
      <div 
        className={`w-full h-full border bg-surface hover:bg-surface-hover rounded-md flex flex-col justify-center items-center cursor-pointer relative ${
          isNodeSelected ? "border-accent ring-1 ring-accent" : "border-border"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id);
        }}
      >
        <Handle type="target" position={Position.Left} className="opacity-0 pointer-events-none" />
        <div className="text-xs font-mono font-semibold truncate px-2 text-center w-full">
          {label}
        </div>
        <div className="text-[10px] font-mono mt-1">
          {matchCount !== undefined ? (
            <span className={matchCount > 0 ? "text-accent font-semibold" : "text-zinc-500"}>
              {matchCount} matched · {files.length} files
            </span>
          ) : (
            <span className="text-zinc-500">{files.length} files</span>
          )}
        </div>
        <Handle type="source" position={Position.Right} className="opacity-0 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className={`w-full h-full border bg-background rounded-md flex flex-col overflow-hidden shadow-sm ${
      isNodeSelected ? "border-accent ring-1 ring-accent" : "border-border"
    }`}>
      {/* Header */}
      <div 
        className="h-10 border-b border-border bg-surface hover:bg-surface-hover flex items-center justify-between px-3 cursor-pointer shrink-0 select-none"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id);
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <span className="text-xs font-mono font-semibold truncate" title={label}>{label}</span>
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
            {matchCount !== undefined ? (
              <span className={matchCount > 0 ? "text-accent font-semibold" : ""}>
                {matchCount} matched ·{" "}
              </span>
            ) : null}
            {files.length} files
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-incoming" title="Incoming dependencies">↓{totalFanIn}</span>
          <span className="text-[10px] font-mono text-outgoing" title="Outgoing dependencies">↑{totalFanOut}</span>
        </div>
      </div>

      {/* Scrollable Rows */}
      <div 
        className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden nowheel nodrag node-scrollbar"
        onScroll={handleScroll}
      >
        {files.map((file) => {
          let isRowDimmed = false;
          let isRowSelected = false;
          let isRowHovered = false;

          const matchesCategory = selectedCategory ? classifyFile(file.path) === selectedCategory : true;

          if (selection?.type === "file") {
            isRowDimmed = !activeFileIds.has(file.id);
            isRowSelected = selection.id === file.id;
          } else if (hoverState?.type === "file") {
            isRowDimmed = !activeFileIds.has(file.id);
            isRowHovered = hoverState.id === file.id;
          } else if (selectedCategory) {
            isRowDimmed = !matchesCategory;
          }

          return (
            <div 
              key={file.id} 
              className={`h-7 min-h-[28px] shrink-0 border-b border-border/40 last:border-0 flex items-center px-3 cursor-pointer relative select-none ${
                isRowSelected
                  ? "bg-accent/15"
                  : isRowHovered
                  ? "bg-surface"
                  : selectedCategory && matchesCategory
                  ? "bg-accent/5 hover:bg-surface/50"
                  : "hover:bg-surface/50"
              }`}
              style={{ opacity: isRowDimmed ? 0.25 : 1 }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectFile(file.id);
              }}
              onMouseEnter={() => onHoverFile(file.id)}
              onMouseLeave={() => onHoverLeave()}
            >
              <Handle 
                type="target" 
                position={Position.Left} 
                id={`target-${file.id}`} 
                className="w-2 h-2 bg-incoming border-none -ml-1 rounded-sm opacity-60 pointer-events-none" 
              />
              <span 
                className={`text-[11px] font-mono truncate w-full pointer-events-none ${
                  isRowSelected ? "font-semibold text-accent" : ""
                } ${isRowHovered && !isRowSelected ? "font-medium" : ""} ${
                  selectedCategory && matchesCategory && !isRowSelected ? "text-accent font-medium" : ""
                }`} 
                title={file.moduleName}
              >
                {file.moduleName}
              </span>
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`source-${file.id}`} 
                className="w-2 h-2 bg-outgoing border-none -mr-1 rounded-sm opacity-60 pointer-events-none" 
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

