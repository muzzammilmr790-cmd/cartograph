import { ParsedFile } from "../parser/types";

export interface FoldedNode {
  id: string; // The folder path
  label: string; // The folder name to display
  files: ParsedFile[];
  depth: number;
}

function getDepth(folderPath: string): number {
  if (folderPath === ".") return 0;
  return folderPath.split("/").length;
}

function getParentFolder(folderPath: string): string {
  if (folderPath === ".") return ".";
  const parts = folderPath.split("/");
  parts.pop();
  return parts.length === 0 ? "." : parts.join("/");
}

/**
 * Computes folding in a single pass for a given threshold.
 * Working deepest-first, if a folder has fewer files than the threshold,
 * it merges into its parent.
 *
 * @param files The raw parsed files
 * @param threshold The minimum number of files a folder must have to avoid being merged
 * @returns Array of FoldedNode
 */
function foldPass(files: ParsedFile[], threshold: number): FoldedNode[] {
  // 1. Initial grouping: Every directory starts as its own node.
  const folderMap = new Map<string, ParsedFile[]>();
  for (const f of files) {
    if (!folderMap.has(f.folder)) folderMap.set(f.folder, []);
    folderMap.get(f.folder)!.push(f);
  }

  // Ensure all parents exist in the map, even if empty initially
  const allFolders = Array.from(folderMap.keys());
  for (const f of allFolders) {
    let current = f;
    while (current !== ".") {
      current = getParentFolder(current);
      if (!folderMap.has(current)) {
        folderMap.set(current, []);
      }
    }
  }

  // 2. Sort folders deepest first
  const sortedFolders = Array.from(folderMap.keys()).sort(
    (a, b) => getDepth(b) - getDepth(a)
  );

  // 3. Merge phase
  // Note: "each pass is computed fresh, so no merge at one depth changes what another merge at the same depth sees."
  // Wait, if it's computed fresh, we determine which folders will merge based on the initial state of the pass?
  // Let's interpret "no merge at one depth changes what another merge at the same depth sees":
  // We should compute the files to move up, but only apply them after assessing that depth, OR
  // since it's deepest-first, merging a child up affects the parent's count for the next depth evaluation.
  // "any directory holding fewer than a couple of files merges into its parent"

  const finalMap = new Map<string, ParsedFile[]>();
  for (const [k, v] of folderMap.entries()) {
    finalMap.set(k, [...v]);
  }

  // Group folders by depth to process depth-by-depth
  const maxDepth = getDepth(sortedFolders[0] || ".");
  for (let d = maxDepth; d > 0; d--) {
    const foldersAtDepth = sortedFolders.filter((f) => getDepth(f) === d);
    const toMerge = [];

    // Evaluate all folders at this depth
    for (const folder of foldersAtDepth) {
      const currentFiles = finalMap.get(folder)!;
      if (currentFiles.length < threshold) {
        toMerge.push({ folder, files: currentFiles });
      }
    }

    // Apply merges to parent
    for (const { folder, files } of toMerge) {
      const parent = getParentFolder(folder);
      const parentFiles = finalMap.get(parent)!;
      parentFiles.push(...files);
      finalMap.delete(folder);
      finalMap.set(parent, parentFiles);
    }
  }

  // Construct nodes
  const nodes: FoldedNode[] = [];
  for (const [folder, folderFiles] of finalMap.entries()) {
    if (folderFiles.length === 0) continue; // Empty directories fold away completely
    
    // "Labels are the shortest thing that is still unique among what's on screen."
    // We'll compute basic labels here and refine them later.
    const label = folder === "." ? "root" : folder.split("/").pop() || folder;
    
    nodes.push({
      id: folder,
      label,
      files: folderFiles,
      depth: getDepth(folder),
    });
  }

  return nodes;
}

/**
 * Folds files into directory nodes.
 * "stopping at the lowest threshold that lands under roughly two dozen."
 */
export function foldFiles(files: ParsedFile[]): FoldedNode[] {
  let threshold = 2; // start with "a couple"
  let nodes = foldPass(files, threshold);

  // If we still have > 24 nodes, raise threshold until we don't
  // But guard against infinite loops if everything merges to root (1 node)
  while (nodes.length > 24 && threshold < 1000) {
    threshold++;
    nodes = foldPass(files, threshold);
  }

  // Compute unique shortest labels
  const finalNodes = computeUniqueLabels(nodes);
  return finalNodes;
}

function computeUniqueLabels(nodes: FoldedNode[]): FoldedNode[] {
  // Label uniqueness logic: keep adding parent dirs until unique
  const idPartsMap = nodes.map(n => ({ node: n, parts: n.id === "." ? ["root"] : n.id.split("/") }));
  
  for (let i = 0; i < idPartsMap.length; i++) {
    let partsToUse = 1;
    let isUnique = false;
    
    while (!isUnique && partsToUse <= idPartsMap[i].parts.length) {
      const currentLabel = idPartsMap[i].parts.slice(-partsToUse).join("/");
      
      let conflict = false;
      for (let j = 0; j < idPartsMap.length; j++) {
        if (i === j) continue;
        const otherLabel = idPartsMap[j].parts.slice(-partsToUse).join("/");
        if (currentLabel === otherLabel) {
          conflict = true;
          break;
        }
      }
      
      if (!conflict) {
        idPartsMap[i].node.label = currentLabel;
        isUnique = true;
      } else {
        partsToUse++;
      }
    }
    
    // If still not unique after using all parts (shouldn't happen since IDs are unique), fallback to full ID
    if (!isUnique) {
      idPartsMap[i].node.label = idPartsMap[i].node.id;
    }
  }
  
  return nodes;
}
