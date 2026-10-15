import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ParsedFile } from "../../lib/parser/types";
import { SelectionState } from "./graph-canvas";
import { MAX_ROWS } from "../../lib/graph/layout";

interface FolderNodeData {
  id: string;
  label: string;
  files: ParsedFile[];
  isOpen: boolean;
  totalFanIn: number;
  totalFanOut: number;
  onToggle: (id: string) => void;
  onSelectFile: (id: string) => void;
  selection: SelectionState;
  hoverState: SelectionState;
  activeFileIds: Set<string>;
  onHoverFile: (id: string) => void;
  onHoverLeave: () => void;
}

export function FolderNode({ data }: { data: FolderNodeData }) {
  const { id, label, files, isOpen, totalFanIn, totalFanOut, onToggle, onSelectFile, selection, hoverState, activeFileIds, onHoverFile, onHoverLeave } = data;

  // Node selection status
  const isNodeSelected = selection?.type === "node" && selection.id === id;

  if (!isOpen) {
    return (
      <div 
        className={`w-full h-full border bg-surface hover:bg-surface-hover rounded-md flex flex-col justify-center items-center cursor-pointer transition-colors relative ${
          isNodeSelected ? "border-accent ring-1 ring-accent" : "border-border"
        }`}
        onClick={() => {
          onToggle(id);
        }}
      >
        <Handle type="target" position={Position.Left} className="opacity-0" />
        <div className="text-xs font-mono font-semibold truncate px-2 text-center w-full">
          {label}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-1">
          {files.length} files
        </div>
        <Handle type="source" position={Position.Right} className="opacity-0" />
      </div>
    );
  }

  const visibleFiles = files.slice(0, MAX_ROWS);
  const remainingCount = files.length - MAX_ROWS;
  const isRemainingActive = remainingCount > 0 && files.slice(MAX_ROWS).some(
    (f) => (selection?.type === "file" && selection.id === f.id) || (hoverState?.type === "file" && hoverState.id === f.id)
  );
  const isRemainingDimmed = (selection?.type === "file" || hoverState?.type === "file") && !isRemainingActive;

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
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">{files.length} files</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-incoming" title="Incoming dependencies">↓{totalFanIn}</span>
          <span className="text-[10px] font-mono text-outgoing" title="Outgoing dependencies">↑{totalFanOut}</span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 flex flex-col">
        {visibleFiles.map((file) => {
          let isRowDimmed = false;
          let isRowSelected = false;
          let isRowHovered = false;

          if (selection?.type === "file") {
            isRowDimmed = !activeFileIds.has(file.id);
            isRowSelected = selection.id === file.id;
          } else if (hoverState?.type === "file") {
            isRowDimmed = !activeFileIds.has(file.id);
            isRowHovered = hoverState.id === file.id;
          }

          return (
            <div 
              key={file.id} 
              className={`h-7 border-b border-border last:border-0 flex items-center px-3 cursor-pointer relative transition-colors ${
                isRowSelected ? "bg-accent/15" : isRowHovered ? "bg-surface" : "hover:bg-surface/50"
              }`}
              style={{ opacity: isRowDimmed ? 0.3 : 1 }}
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
                className="w-2 h-2 bg-incoming border-none -ml-1 rounded-sm opacity-60" 
              />
              <span className={`text-[11px] font-mono truncate w-full ${isRowSelected ? "font-semibold text-accent" : ""} ${isRowHovered && !isRowSelected ? "font-medium" : ""}`} title={file.moduleName}>
                {file.moduleName}
              </span>
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`source-${file.id}`} 
                className="w-2 h-2 bg-outgoing border-none -mr-1 rounded-sm opacity-60" 
              />
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div 
            className={`h-7 border-t border-border/80 flex items-center justify-between px-3 relative select-none transition-colors ${
              isRemainingActive ? "bg-accent/15 text-accent font-semibold" : "bg-surface/40 text-zinc-500"
            }`}
            style={{ opacity: isRemainingDimmed ? 0.3 : 1 }}
          >
            <Handle 
              type="target" 
              position={Position.Left} 
              id={`target-${id}-more`} 
              className="w-2 h-2 bg-incoming border-none -ml-1 rounded-sm opacity-60" 
            />
            <span className="text-[10px] font-mono italic">
              +{remainingCount} more files
            </span>
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`source-${id}-more`} 
              className="w-2 h-2 bg-outgoing border-none -mr-1 rounded-sm opacity-60" 
            />
          </div>
        )}
      </div>
    </div>
  );
}
