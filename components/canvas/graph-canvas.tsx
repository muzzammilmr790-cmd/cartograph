"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
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
}

export type SelectionState = { id: string; type: "node" | "file" } | null;

function GraphCanvasInner({ data, foldedNodes, selection, onSelectionChange, hoverState, onHoverChange }: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
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

  // Compute layout whenever openFolders or data changes
  useEffect(() => {
    if (!data.files || data.files.length === 0) return;

    // 1. Generate layout from foldedNodes
    const { nodes: layoutedNodes, edges: layoutedEdges } = generateGraph(
      foldedNodes,
      data.edges,
      {
        openFolders,
        fanInMap: data.fanIn,
        fanOutMap: data.fanOut,
      }
    );

    // 2. Compute active elements for dimming
    const activeNodeIds = new Set<string>();
    const activeEdgeIds = new Set<string>();
    const activeFileIds = new Set<string>();

    if (selection) {
      if (selection.type === "node") {
        activeNodeIds.add(selection.id);
        // Find all edges connected to this node
        layoutedEdges.forEach((e) => {
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
        layoutedEdges.forEach((e) => {
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
    }

    // 3. Attach callbacks and apply styles
    const nodesWithCallbacks = layoutedNodes.map((n) => {
      const isDimmed = (selection !== null || hoverState !== null) && !activeNodeIds.has(n.id);
      return {
        ...n,
        style: { ...n.style, opacity: isDimmed ? 0.2 : 1, transition: "opacity 0.2s" },
        data: {
          ...n.data,
          onToggle: handleToggle,
          onSelectFile: handleSelectFile,
          onHoverFile: (id: string) => onHoverChange({ id, type: "file" }),
          onHoverLeave: () => onHoverChange(null),
          selection,
          hoverState,
          activeFileIds,
        },
      };
    });

    const edgesWithStyles = layoutedEdges.map((e) => {
      const isDimmed = (selection !== null || hoverState !== null) && !activeEdgeIds.has(e.id);
      return {
        ...e,
        style: {
          ...e.style,
          opacity: isDimmed ? 0.1 : 0.8,
          strokeWidth: isDimmed ? 1 : 2,
          transition: "opacity 0.2s, stroke-width 0.2s",
        },
      };
    });

    setNodes(nodesWithCallbacks);
    setEdges(edgesWithStyles);

    // If an open folder triggered a layout change, refit the view safely
    if (pendingFitViewRef.current) {
      const { maxZoom } = pendingFitViewRef.current;
      pendingFitViewRef.current = null;
      setTimeout(() => {
        fitView({ duration: 400, padding: 0.15, maxZoom });
      }, 50);
    }
  }, [data, foldedNodes, openFolders, selection, hoverState, handleToggle, handleSelectFile, onHoverChange, setNodes, setEdges, fitView]);

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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={0.1}
      maxZoom={2}
    >
      <Background color="var(--border)" gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function GraphCanvas({ data, foldedNodes, selection, onSelectionChange, hoverState, onHoverChange }: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner 
        data={data} 
        foldedNodes={foldedNodes}
        selection={selection} 
        onSelectionChange={onSelectionChange} 
        hoverState={hoverState}
        onHoverChange={onHoverChange}
      />
    </ReactFlowProvider>
  );
}
