import dagre from "dagre";
import { Edge, Node } from "@xyflow/react";
import { ParsedEdge, ParsedFile } from "../parser/types";
import { FoldedNode } from "./fold";

export interface LayoutOptions {
  openFolders: Set<string>;
  fanInMap: Record<string, number>;
  fanOutMap: Record<string, number>;
}

// Fixed dimensions for layout estimation
const MIN_NODE_HEIGHT = 40;
const MAX_NODE_HEIGHT = 200;
export const MAX_ROWS = 10;
export const ROW_HEIGHT = 28;
export const HEADER_HEIGHT = 40;

function getClosedNodeHeight(files: ParsedFile[], fanInMap: Record<string, number>): number {
  const totalFanIn = files.reduce((sum, f) => sum + (fanInMap[f.id] || 0), 0);
  const height = MIN_NODE_HEIGHT + totalFanIn * 2;
  return Math.min(height, MAX_NODE_HEIGHT);
}

function getOpenNodeHeight(files: ParsedFile[]): number {
  const hasMore = files.length > MAX_ROWS;
  const displayCount = Math.min(files.length, MAX_ROWS) + (hasMore ? 1 : 0);
  return HEADER_HEIGHT + displayCount * ROW_HEIGHT;
}

function getNodeWidth(label: string, isOpen: boolean): number {
  if (isOpen) {
    return Math.max(280, Math.min(420, label.length * 8 + 80));
  }
  return Math.max(160, Math.min(400, label.length * 8 + 60));
}

export function getNodeRowHandle(
  fileId: string,
  nodeId: string,
  isOpen: boolean,
  filesInNode: ParsedFile[],
  type: "source" | "target"
): string | null {
  if (!isOpen) return null;
  const visibleFiles = filesInNode.slice(0, MAX_ROWS);
  const isVisible = visibleFiles.some((f) => f.id === fileId);
  if (isVisible) {
    return `${type}-${fileId}`;
  }
  return `${type}-${nodeId}-more`;
}

export function generateGraph(
  foldedNodes: FoldedNode[],
  rawEdges: ParsedEdge[],
  options: LayoutOptions
): { nodes: Node[]; edges: Edge[] } {
  const { openFolders, fanInMap, fanOutMap } = options;

  // 1. Create React Flow Nodes
  const rfNodes: Node[] = foldedNodes.map((fn) => {
    const isOpen = openFolders.has(fn.id);
    const height = isOpen
      ? getOpenNodeHeight(fn.files)
      : getClosedNodeHeight(fn.files, fanInMap);
    
    const width = getNodeWidth(fn.label, isOpen);
    
    const totalFanIn = fn.files.reduce((sum, f) => sum + (fanInMap[f.id] || 0), 0);
    const totalFanOut = fn.files.reduce((sum, f) => sum + (fanOutMap[f.id] || 0), 0);

    return {
      id: fn.id,
      type: "folderNode",
      position: { x: 0, y: 0 },
      data: {
        id: fn.id,
        label: fn.label,
        files: fn.files,
        isOpen,
        totalFanIn,
        totalFanOut,
      },
      style: { width, height },
    };
  });

  // 2. Map files to their container nodes for edge routing
  const fileToNode = new Map<string, string>();
  const nodeFilesMap = new Map<string, ParsedFile[]>();
  for (const fn of foldedNodes) {
    nodeFilesMap.set(fn.id, fn.files);
    for (const file of fn.files) {
      fileToNode.set(file.id, fn.id);
    }
  }

  // 3. Create Edges
  // We need to deduplicate edges if they map to the same folder nodes
  const edgeMap = new Map<string, Edge>();

  for (const rawEdge of rawEdges) {
    const sourceNodeId = fileToNode.get(rawEdge.source);
    const targetNodeId = fileToNode.get(rawEdge.target);

    // Ignore self-edges within the same node
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      continue;
    }

    const sourceIsOpen = openFolders.has(sourceNodeId);
    const targetIsOpen = openFolders.has(targetNodeId);

    const rfSource = sourceNodeId;
    const rfTarget = targetNodeId;
    
    const sourceFiles = nodeFilesMap.get(sourceNodeId) || [];
    const targetFiles = nodeFilesMap.get(targetNodeId) || [];

    const sourceHandle = getNodeRowHandle(rawEdge.source, sourceNodeId, sourceIsOpen, sourceFiles, "source");
    const targetHandle = getNodeRowHandle(rawEdge.target, targetNodeId, targetIsOpen, targetFiles, "target");

    const edgeId = `${rfSource}${sourceHandle ? ':' + sourceHandle : ''}->${rfTarget}${targetHandle ? ':' + targetHandle : ''}`;

    if (!edgeMap.has(edgeId)) {
      edgeMap.set(edgeId, {
        id: edgeId,
        source: rfSource,
        target: rfTarget,
        sourceHandle,
        targetHandle,
        type: "default",
        style: { stroke: "var(--outgoing)", strokeWidth: 1, opacity: 0.6 },
        animated: false,
      });
    }
  }

  const rfEdges = Array.from(edgeMap.values());

  // 4. Run Dagre Layout
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 200 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of rfNodes) {
    g.setNode(node.id, {
      width: node.style?.width as number,
      height: node.style?.height as number,
    });
  }

  for (const edge of rfEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // 5. Apply layout to nodes
  const layoutedNodes = rfNodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        // Dagre computes the center of the node, React Flow expects top-left
        x: nodeWithPosition.x - (node.style?.width as number) / 2,
        y: nodeWithPosition.y - (node.style?.height as number) / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges: rfEdges };
}
