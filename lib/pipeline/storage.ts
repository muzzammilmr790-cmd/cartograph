import crypto from "node:crypto";
import path from "node:path";
import { createDbClient } from "../db/client";
import { ParseResult } from "../parser/types";

const BATCH_SIZE = 100;

/**
 * Stores the parsed files and dependency edges for an analysis into Supabase.
 * Uses batch inserts to efficiently handle large graphs.
 */
export async function storeAnalysisGraph(
  analysisId: string,
  orgId: string,
  parseResult: ParseResult,
  token?: string
): Promise<{ storedFiles: number; storedEdges: number }> {
  const db = await createDbClient(token);

  // 1. Clear any prior files or edges for this analysis (clean state on re-run)
  await db.from("edges").delete().eq("analysis_id", analysisId);
  await db.from("files").delete().eq("analysis_id", analysisId);

  // 2. Prepare file records and map relative paths to generated UUIDs
  const pathToFileId = new Map<string, string>();
  const fileRows = parseResult.files.map((file) => {
    const fileId = crypto.randomUUID();
    pathToFileId.set(file.path, fileId);

    const ext = path.extname(file.path).toLowerCase();
    const fanIn = parseResult.fanIn[file.id] ?? parseResult.fanIn[file.path] ?? 0;
    const fanOut = parseResult.fanOut[file.id] ?? parseResult.fanOut[file.path] ?? 0;

    return {
      id: fileId,
      organization_id: orgId,
      analysis_id: analysisId,
      path: file.path,
      extension: ext || null,
      size_bytes: file.lineCount,
      fan_in: fanIn,
      fan_out: fanOut,
    };
  });

  // Batch insert files
  for (let i = 0; i < fileRows.length; i += BATCH_SIZE) {
    const batch = fileRows.slice(i, i + BATCH_SIZE);
    const { error } = await db.from("files").insert(batch);
    if (error) {
      throw new Error(`Failed to insert files batch (${i}-${i + batch.length}): ${error.message}`);
    }
  }

  // 3. Prepare edge records, linking to source_file_id and target_file_id
  const edgeRows = parseResult.edges.map((edge) => {
    const edgeId = crypto.randomUUID();
    const sourceFileId = pathToFileId.get(edge.source) || null;
    const targetFileId = pathToFileId.get(edge.target) || null;

    let importType = "static";
    if (edge.kind === "dynamic-import") {
      importType = "dynamic";
    } else if (edge.kind === "re-export") {
      importType = "re-export";
    }

    return {
      id: edgeId,
      organization_id: orgId,
      analysis_id: analysisId,
      source_file_id: sourceFileId,
      target_file_id: targetFileId,
      source_path: edge.source,
      target_path: edge.target,
      import_type: importType,
    };
  });

  // Batch insert edges
  for (let i = 0; i < edgeRows.length; i += BATCH_SIZE) {
    const batch = edgeRows.slice(i, i + BATCH_SIZE);
    const { error } = await db.from("edges").insert(batch);
    if (error) {
      throw new Error(`Failed to insert edges batch (${i}-${i + batch.length}): ${error.message}`);
    }
  }

  return {
    storedFiles: fileRows.length,
    storedEdges: edgeRows.length,
  };
}
