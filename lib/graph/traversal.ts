import { ParsedEdge, ParsedFile } from "../parser/types";
import { isFrameworkOrConfig } from "./classify";

export interface TransitiveWalkResult {
  fileId: string;
  depth: number;
}

/**
 * Transitive walk over the edge list with direction and depth limit.
 *
 * - incoming: Blast radius (everything that breaks if this file changes - dependents)
 * - outgoing: Dependency chain (everything this file needs - dependencies)
 *
 * Max depth is 2 by default.
 */
export function walkTransitive(
  edges: ParsedEdge[],
  startFileId: string,
  direction: "incoming" | "outgoing",
  maxDepth = 2
): TransitiveWalkResult[] {
  // Build adjacency list based on direction
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const from = direction === "incoming" ? edge.target : edge.source;
    const to = direction === "incoming" ? edge.source : edge.target;

    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    adjacency.get(from)!.push(to);
  }

  const results: TransitiveWalkResult[] = [];
  const visited = new Set<string>([startFileId]);

  // BFS queue: [fileId, depth]
  const queue: [string, number][] = [[startFileId, 0]];

  while (queue.length > 0) {
    const [currentId, currentDepth] = queue.shift()!;

    if (currentDepth >= maxDepth) continue;

    const neighbors = adjacency.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const nextDepth = currentDepth + 1;
        results.push({ fileId: neighbor, depth: nextDepth });
        queue.push([neighbor, nextDepth]);
      }
    }
  }

  // Sort by depth ascending, then alphabetically by fileId
  results.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.fileId.localeCompare(b.fileId);
  });

  return results;
}

export interface CycleResult {
  path: string[];
  key: string;
}

/**
 * Iterative cycle detection.
 * Finds simple cycles in the directed import graph without recursion to prevent call stack overflow.
 */
export function detectCyclesIterative(
  files: ParsedFile[],
  edges: ParsedEdge[]
): CycleResult[] {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }

  const visitedGlobal = new Set<string>();
  const onPathSet = new Set<string>();
  const pathStack: string[] = [];
  const foundCycles: CycleResult[] = [];
  const seenCycleKeys = new Set<string>();

  for (const f of files) {
    if (visitedGlobal.has(f.id)) continue;

    // Stack entry: [nodeId, neighborIndex]
    const stack: [string, number][] = [[f.id, 0]];

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const curr = top[0];
      const idx = top[1];

      if (idx === 0) {
        visitedGlobal.add(curr);
        onPathSet.add(curr);
        pathStack.push(curr);
      }

      const neighbors = adj.get(curr) || [];
      if (idx < neighbors.length) {
        top[1] = idx + 1;
        const next = neighbors[idx];

        if (onPathSet.has(next)) {
          // Cycle found!
          const startIndex = pathStack.indexOf(next);
          if (startIndex !== -1) {
            const cyclePath = pathStack.slice(startIndex).concat(next);
            // Canonical key to deduplicate rotated or duplicate cycles
            const sortedNodes = [...new Set(cyclePath.slice(0, -1))].sort();
            const key = sortedNodes.join("|");
            if (!seenCycleKeys.has(key)) {
              seenCycleKeys.add(key);
              foundCycles.push({ path: cyclePath, key });
            }
          }
        } else if (!visitedGlobal.has(next)) {
          stack.push([next, 0]);
        }
      } else {
        // Backtrack
        onPathSet.delete(curr);
        pathStack.pop();
        stack.pop();
      }
    }
  }

  return foundCycles;
}

export interface InsightItem {
  fileId: string;
  detail?: string;
}

export interface InsightGroup {
  id: "unimported" | "highFanIn" | "cycles" | "oversized";
  title: string;
  sentence: string;
  items: InsightItem[];
}

export const INSIGHT_STRINGS = {
  unimported: "Not imported by any file in the repository.",
  highFanIn: "Imported by an unusual number of files.",
  cycles: "Part of an import cycle.",
  oversized: "File exceeds line length threshold.",
} as const;

export const HIGH_FAN_IN_THRESHOLD = 15;
export const OVERSIZED_LINE_THRESHOLD = 500;

/**
 * Computes the 4 kinds of insights over the edge and file lists.
 * Ordered according to specification:
 * 1. Files nothing imports (unimported non-framework)
 * 2. Files an unusual number of things import
 * 3. Import cycles
 * 4. Files that are simply too long
 */
export function computeInsights(
  files: ParsedFile[],
  edges: ParsedEdge[],
  fanInMap: Record<string, number>
): InsightGroup[] {
  // 1. Files nothing imports (excluding framework pages, routes, layouts, configs, tests)
  const unimportedFiles: InsightItem[] = files
    .filter((f) => (fanInMap[f.id] || 0) === 0 && !isFrameworkOrConfig(f.path))
    .map((f) => ({ fileId: f.id }))
    .sort((a, b) => a.fileId.localeCompare(b.fileId));

  // 2. High fan-in files
  const highFanInFiles: InsightItem[] = files
    .filter((f) => (fanInMap[f.id] || 0) >= HIGH_FAN_IN_THRESHOLD)
    .map((f) => ({
      fileId: f.id,
      detail: `${fanInMap[f.id]} dependents`,
    }))
    .sort((a, b) => (fanInMap[b.fileId] || 0) - (fanInMap[a.fileId] || 0));

  // 3. Import cycles
  const detectedCycles = detectCyclesIterative(files, edges);
  // Collect all files participating in cycles
  const cycleFilesSet = new Set<string>();
  const cycleItems: InsightItem[] = [];

  for (const c of detectedCycles) {
    const cycleParticipants = c.path.slice(0, -1);
    for (const fileId of cycleParticipants) {
      if (!cycleFilesSet.has(fileId)) {
        cycleFilesSet.add(fileId);
        cycleItems.push({
          fileId,
          detail: `Cycle: ${c.path.join(" → ")}`,
        });
      }
    }
  }

  cycleItems.sort((a, b) => a.fileId.localeCompare(b.fileId));

  // 4. Files that are simply too long
  const oversizedFiles: InsightItem[] = files
    .filter((f) => f.lineCount > OVERSIZED_LINE_THRESHOLD)
    .map((f) => ({
      fileId: f.id,
      detail: `${f.lineCount} lines`,
    }))
    .sort((a, b) => {
      const fileA = files.find((f) => f.id === a.fileId);
      const fileB = files.find((f) => f.id === b.fileId);
      return (fileB?.lineCount || 0) - (fileA?.lineCount || 0);
    });

  return [
    {
      id: "unimported",
      title: "Unimported Files",
      sentence: INSIGHT_STRINGS.unimported,
      items: unimportedFiles,
    },
    {
      id: "highFanIn",
      title: "High Fan-In",
      sentence: INSIGHT_STRINGS.highFanIn,
      items: highFanInFiles,
    },
    {
      id: "cycles",
      title: "Import Cycles",
      sentence: INSIGHT_STRINGS.cycles,
      items: cycleItems,
    },
    {
      id: "oversized",
      title: "Oversized Files",
      sentence: INSIGHT_STRINGS.oversized,
      items: oversizedFiles,
    },
  ];
}
