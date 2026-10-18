"use client";

import React, { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { ParseResult } from "../../lib/parser/types";
import { foldFiles } from "../../lib/graph/fold";
import { FileKind } from "../../lib/graph/classify";
import { SelectionState } from "../canvas/graph-canvas";
import { DetailPane } from "./detail-pane";
import { LeftRail } from "./left-rail";
import { CoverageBanner } from "../canvas/coverage-banner";

const GraphCanvas = dynamic(
  () => import("../canvas/graph-canvas").then((mod) => mod.GraphCanvas),
  {
    ssr: false,
    loading: () => <div className="flex-1 w-full h-full bg-background" />,
  }
);

interface WorkspaceProps {
  data: ParseResult;
}

export function Workspace({ data }: WorkspaceProps) {
  const [selection, setSelection] = useState<SelectionState>(null);
  const [hoverState, setHoverState] = useState<SelectionState>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileKind | null>(null);

  const foldedNodes = useMemo(() => {
    if (!data.files || data.files.length === 0) return [];
    return foldFiles(data.files);
  }, [data.files]);

  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleSelectionChange = useCallback((newSelection: SelectionState) => {
    setSelection(newSelection);
  }, []);

  const handleHoverChange = useCallback((newHover: SelectionState) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (newHover) {
      // Immediate update when entering an item - 0ms lag
      setHoverState((prev) => {
        if (prev?.id === newHover.id && prev?.type === newHover.type) return prev;
        return newHover;
      });
    } else {
      // Small 60ms debounce on leave: prevents the 1-frame un-dim flash when crossing between adjacent files/rows
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverState(null);
      }, 60);
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-background text-foreground relative">
      {/* Left Rail: Categories & Insights */}
      <LeftRail
        files={data.files}
        edges={data.edges}
        fanInMap={data.fanIn}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selection={selection}
        onSelectFile={(fileId) => handleSelectionChange({ id: fileId, type: "file" })}
        hoverState={hoverState}
        onHoverFile={(fileId) => handleHoverChange(fileId ? { id: fileId, type: "file" } : null)}
      />

      {/* Middle Column: The Map (Canvas) */}
      <main className="flex-1 bg-background flex flex-col overflow-hidden relative">
        {data.coverage && <CoverageBanner coverage={data.coverage} />}
        <GraphCanvas 
          data={data} 
          foldedNodes={foldedNodes}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          hoverState={hoverState}
          onHoverChange={handleHoverChange}
          selectedCategory={selectedCategory}
        />
      </main>

      {/* Right Pane: Detail & AI Explanation */}
      <DetailPane 
        data={data}
        foldedNodes={foldedNodes}
        selection={selection}
        onSelectionChange={handleSelectionChange}
        hoverState={hoverState}
        onHoverChange={handleHoverChange}
      />
    </div>
  );
}
