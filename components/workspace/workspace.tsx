"use client";

import React, { useState, useCallback, useMemo } from "react";
import { ParseResult } from "../../lib/parser/types";
import { foldFiles } from "../../lib/graph/fold";
import { GraphCanvas, SelectionState } from "../canvas/graph-canvas";
import { DetailPane } from "./detail-pane";

interface WorkspaceProps {
  data: ParseResult;
}

export function Workspace({ data }: WorkspaceProps) {
  const [selection, setSelection] = useState<SelectionState>(null);
  const [hoverState, setHoverState] = useState<SelectionState>(null);

  const foldedNodes = useMemo(() => {
    if (!data.files || data.files.length === 0) return [];
    return foldFiles(data.files);
  }, [data.files]);

  const handleSelectionChange = useCallback((newSelection: SelectionState) => {
    setSelection(newSelection);
  }, []);

  const handleHoverChange = useCallback((newHover: SelectionState) => {
    setHoverState(newHover);
  }, []);

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden bg-background text-foreground relative">
      {/* Middle Column: The Map (Canvas) */}
      <main className="flex-1 bg-background flex flex-col overflow-hidden relative">
        <GraphCanvas 
          data={data} 
          foldedNodes={foldedNodes}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          hoverState={hoverState}
          onHoverChange={handleHoverChange}
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
