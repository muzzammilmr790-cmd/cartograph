"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  Node,
  Edge,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ParseResult } from "../../lib/parser/types";
import { FoldedNode } from "../../lib/graph/fold";
import { generateGraph, getNodeRowHandle } from "../../lib/graph/layout";
import { FolderNode } from "./folder-node";
import { ClampedEdge } from "./clamped-edge";
import { FileKind, classifyFile } from "../../lib/graph/classify";

const nodeTypes: NodeTypes = {
  folderNode: FolderNode,
};

const edgeTypes = {
  default: ClampedEdge,
};

interface GraphCanvasProps {
  data: ParseResult;
  foldedNodes: FoldedNode[];
  selection: SelectionState;
  onSelectionChange: (s: SelectionState) => void;
  hoverState: SelectionState;
  onHoverChange: (s: SelectionState) => void;
  selectedCategory?: FileKind | null;
}

export type SelectionState = { id: string; type: "node" | "file" } | null;

function GraphCanvasInner({
  data,
  foldedNodes,
  selection,
  onSelectionChange,
  hoverState,
  onHoverChange,
  selectedCategory,
}: GraphCanvasProps) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const pendingFitViewRef = React.useRef<{ maxZoom: number } | null>(null);
  
  const { fitView, getZoom } = useReactFlow();

  const handleToggle = useCallback((id: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      let isOpening = false;
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        isOpening = true;
      }

      if (isOpening) {
        pendingFitViewRef.current = { maxZoom: getZoom() };
      }

      return next;
    });
  }, [getZoom]);

  const handleSelectFile = useCallback((id: string) => {
    onSelectionChange(selection?.id === id && selection.type === "file" ? null : { id, type: "file" });
  }, [selection, onSelectionChange]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    onSelectionChange(selection?.id === node.id && selection.type === "node" ? null : { id: node.id, type: "node" });
  }, [selection, onSelectionChange]);

  const onPaneClick = useCallback(() => {
    onSelectionChange(null);
  }, [onSelectionChange]);

  const handleHoverFile = useCallback(
    (id: string) => {
      onHoverChange({ id, type: "file" });
    },
    [onHoverChange]
  );

  const handleHoverLeave = useCallback(() => {
    onHoverChange(null);
  }, [onHoverChange]);

  // 1. Memoize Dagre layout so it ONLY re-computes when foldedNodes or openFolders change
  const baseLayout = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!data.files || data.files.length === 0) return { nodes: [], edges: [] };
    return generateGraph(foldedNodes, data.edges, {
      openFolders,
      fanInMap: data.fanIn,
      fanOutMap: data.fanOut,
    });
  }, [foldedNodes, data.edges, openFolders, data.fanIn, data.fanOut, data.files]);

  // 2. Synchronously compute styled nodes and edges during render (zero-delay, zero-flicker)
  const { nodes, edges } = useMemo(() => {
    if (!baseLayout.nodes.length) {
      return { nodes: [], edges: [] };
    }

    const activeNodeIds = new Set<string>();
    const activeEdgeIds = new Set<string>();
    const activeFileIds = new Set<string>();

    const categoryCountsPerNode = new Map<string, number>();
    if (selectedCategory) {
      foldedNodes.forEach((fn) => {
        const count = fn.files.filter((f) => classifyFile(f.path) === selectedCategory).length;
        categoryCountsPerNode.set(fn.id, count);
      });
    }

    if (selection) {
      if (selection.type === "node") {
        activeNodeIds.add(selection.id);
        baseLayout.edges.forEach((e) => {
          if (e.source === selection.id || e.target === selection.id) {
            activeEdgeIds.add(e.id);
            activeNodeIds.add(e.source);
            activeNodeIds.add(e.target);
          }
        });
      } else if (selection.type === "file") {
        activeFileIds.add(selection.id);
        const rawEdgesRelated = data.edges.filter(
          (e) => e.source === selection.id || e.target === selection.id
        );
        
        const fileNode = foldedNodes.find((fn) => fn.files.some((f) => f.id === selection.id));
        if (fileNode) activeNodeIds.add(fileNode.id);

        rawEdgesRelated.forEach((re) => {
          activeFileIds.add(re.source);
          activeFileIds.add(re.target);
          
          const sourceNode = foldedNodes.find((fn) => fn.files.some((f) => f.id === re.source));
          const targetNode = foldedNodes.find((fn) => fn.files.some((f) => f.id === re.target));
          
          if (sourceNode && targetNode) {
            activeNodeIds.add(sourceNode.id);
            activeNodeIds.add(targetNode.id);
            
            const sourceIsOpen = openFolders.has(sourceNode.id);
            const targetIsOpen = openFolders.has(targetNode.id);
            const sourceHandle = getNodeRowHandle(re.source, sourceNode.id, sourceIsOpen, sourceNode.files, "source");
            const targetHandle = getNodeRowHandle(re.target, targetNode.id, targetIsOpen, targetNode.files, "target");
            
            const edgeId = `${sourceNode.id}${sourceHandle ? ':' + sourceHandle : ''}->${targetNode.id}${targetHandle ? ':' + targetHandle : ''}`;
            activeEdgeIds.add(edgeId);
          }
        });
      }
    } else if (hoverState) {
      if (hoverState.type === "node") {
        activeNodeIds.add(hoverState.id);
        baseLayout.edges.forEach((e) => {
          if (e.source === hoverState.id || e.target === hoverState.id) {
            activeEdgeIds.add(e.id);
            activeNodeIds.add(e.source);
            activeNodeIds.add(e.target);
          }
        });
      } else if (hoverState.type === "file") {
        activeFileIds.add(hoverState.id);
        const rawEdgesRelated = data.edges.filter(
          (e) => e.source === hoverState.id || e.target === hoverState.id
        );
        
        const fileNode = foldedNodes.find((fn) => fn.files.some((f) => f.id === hoverState.id));
        if (fileNode) activeNodeIds.add(fileNode.id);

        rawEdgesRelated.forEach((re) => {
          activeFileIds.add(re.source);
          activeFileIds.add(re.target);
          
          const sourceNode = foldedNodes.find((fn) => fn.files.some((f) => f.id === re.source));
          const targetNode = foldedNodes.find((fn) => fn.files.some((f) => f.id === re.target));
          
          if (sourceNode && targetNode) {
            activeNodeIds.add(sourceNode.id);
            activeNodeIds.add(targetNode.id);
            
            const sourceIsOpen = openFolders.has(sourceNode.id);
            const targetIsOpen = openFolders.has(targetNode.id);
            const sourceHandle = getNodeRowHandle(re.source, sourceNode.id, sourceIsOpen, sourceNode.files, "source");
            const targetHandle = getNodeRowHandle(re.target, targetNode.id, targetIsOpen, targetNode.files, "target");
            
            const edgeId = `${sourceNode.id}${sourceHandle ? ':' + sourceHandle : ''}->${targetNode.id}${targetHandle ? ':' + targetHandle : ''}`;
            activeEdgeIds.add(edgeId);
          }
        });
      }
    } else if (selectedCategory) {
      foldedNodes.forEach((fn) => {
        const count = categoryCountsPerNode.get(fn.id) ?? 0;
        if (count > 0) {
          activeNodeIds.add(fn.id);
        }
        fn.files.forEach((f) => {
          if (classifyFile(f.path) === selectedCategory) {
            activeFileIds.add(f.id);
          }
        });
      });

      baseLayout.edges.forEach((e) => {
        if (activeNodeIds.has(e.source) && activeNodeIds.has(e.target)) {
          activeEdgeIds.add(e.id);
        }
      });
    }

    const computedNodes = baseLayout.nodes.map((n) => {
      const isDimmed = (selection !== null || hoverState !== null || selectedCategory !== null) && !activeNodeIds.has(n.id);
      return {
        ...n,
        style: { ...n.style, opacity: isDimmed ? 0.2 : 1 },
        data: {
          ...n.data,
          onToggle: handleToggle,
          onSelectFile: handleSelectFile,
          onHoverFile: handleHoverFile,
          onHoverLeave: handleHoverLeave,
          selection,
          hoverState,
          activeFileIds,
          selectedCategory,
          categoryMatchCount: categoryCountsPerNode.get(n.id) ?? 0,
        },
      };
    });

    const computedEdges = baseLayout.edges.map((e) => {
      const isDimmed = (selection !== null || hoverState !== null || selectedCategory !== null) && !activeEdgeIds.has(e.id);
      return {
        ...e,
        style: {
          ...e.style,
          opacity: isDimmed ? 0.1 : 0.8,
          strokeWidth: isDimmed ? 1 : 2,
        },
      };
    });

    return { nodes: computedNodes, edges: computedEdges };
  }, [
    baseLayout,
    data.edges,
    foldedNodes,
    openFolders,
    selection,
    hoverState,
    selectedCategory,
    handleToggle,
    handleSelectFile,
    handleHoverFile,
    handleHoverLeave,
  ]);

  const hasInitialFitRef = React.useRef(false);

  // Initial fit view
  useEffect(() => {
    if (!hasInitialFitRef.current && nodes.length > 0) {
      hasInitialFitRef.current = true;
      setTimeout(() => {
        fitView({ duration: 0, padding: 0.15 });
      }, 50);
    }
  }, [nodes.length, fitView]);

  // Refit on folder open
  useEffect(() => {
    if (pendingFitViewRef.current) {
      const { maxZoom } = pendingFitViewRef.current;
      pendingFitViewRef.current = null;
      setTimeout(() => {
        fitView({ duration: 400, padding: 0.15, maxZoom });
      }, 50);
    }
  }, [openFolders, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={0.1}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      elementsSelectable={false}
    >
      <Background color="var(--border)" gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function GraphCanvas({
  data,
  foldedNodes,
  selection,
  onSelectionChange,
  hoverState,
  onHoverChange,
  selectedCategory,
}: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner 
        data={data} 
        foldedNodes={foldedNodes}
        selection={selection} 
        onSelectionChange={onSelectionChange} 
        hoverState={hoverState}
        onHoverChange={onHoverChange}
        selectedCategory={selectedCategory}
      />
    </ReactFlowProvider>
  );
}
