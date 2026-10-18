import { createDbClient } from "./client";
import { CoverageReport } from "../parser/types";
import { PipelineStage, AnalysisStatus } from "../pipeline/types";

export interface AnalysisRecord {
  id: string;
  organization_id: string;
  project_id: string | null;
  repo_url: string;
  status: AnalysisStatus;
  stage: PipelineStage | null;
  stage_message: string | null;
  commit_hash: string | null;
  file_count: number;
  edge_count: number;
  coverage: CoverageReport | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Syncs the current active organization into the database.
 * Uses upsert to ensure the organization parent row exists for foreign key constraints.
 */
export async function syncCurrentOrgToDb(orgId: string, orgName: string) {
  const db = await createDbClient();
  await db
    .from("organizations")
    .upsert({ id: orgId, name: orgName }, { onConflict: "id" });
}

/**
 * Retrieves the analyses for the current authenticated organization.
 *
 * CRITICAL RULE: This function performs NO organization filtering in application code.
 * Who may read a row is strictly determined by Row-Level Security (RLS) policies in Postgres.
 * The RLS policy reads the `org_id` claim off the current Clerk JWT token.
 */
export async function getAnalyses(): Promise<AnalysisRecord[]> {
  const db = await createDbClient();

  const { data, error } = await db
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Cartograph DB] Error fetching analyses:", error.message);
    return [];
  }

  return (data as AnalysisRecord[]) || [];
}

/**
 * Retrieves a single analysis by ID.
 * Filtered by RLS at database level.
 */
export async function getAnalysisById(
  id: string,
  token?: string
): Promise<AnalysisRecord | null> {
  const db = await createDbClient(token);

  const { data, error } = await db
    .from("analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      console.error(`[Cartograph DB] Error fetching analysis ${id}:`, error.message);
    }
    return null;
  }

  return data as AnalysisRecord;
}

/**
 * Finds an existing analysis by repository URL in the current organization.
 * Enforces: One analysis per repository.
 */
export async function getAnalysisByRepoUrl(
  repoUrl: string,
  token?: string
): Promise<AnalysisRecord | null> {
  const db = await createDbClient(token);

  const { data, error } = await db
    .from("analyses")
    .select("*")
    .eq("repo_url", repoUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `[Cartograph DB] Error looking up analysis for ${repoUrl}:`,
      error.message
    );
    return null;
  }

  return data as AnalysisRecord | null;
}

/**
 * Creates or resets an analysis row for a repository run.
 */
export async function createOrResetAnalysis(
  data: {
    orgId: string;
    repoUrl: string;
    stage?: PipelineStage;
    stageMessage?: string;
  },
  token?: string
): Promise<AnalysisRecord> {
  const db = await createDbClient(token);

  // Check if an analysis already exists for this repo in this org
  const existing = await getAnalysisByRepoUrl(data.repoUrl, token);

  if (existing) {
    // Reset existing analysis for a new run
    const { data: updated, error } = await db
      .from("analyses")
      .update({
        status: "parsing",
        stage: data.stage ?? "fetch",
        stage_message: data.stageMessage ?? "Fetching repository...",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reset existing analysis: ${error.message}`);
    }

    return updated as AnalysisRecord;
  }

  // Create new analysis row
  const { data: created, error } = await db
    .from("analyses")
    .insert({
      organization_id: data.orgId,
      repo_url: data.repoUrl,
      status: "parsing",
      stage: data.stage ?? "fetch",
      stage_message: data.stageMessage ?? "Fetching repository...",
      file_count: 0,
      edge_count: 0,
      error_message: null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create analysis: ${error.message}`);
  }

  return created as AnalysisRecord;
}

/**
 * Updates the current stage and progress message of an analysis.
 * The database trigger will automatically broadcast this change to the realtime channel.
 */
export async function updateAnalysisStage(
  analysisId: string,
  stage: PipelineStage,
  stageMessage: string,
  token?: string
): Promise<void> {
  const db = await createDbClient(token);

  const { error } = await db
    .from("analyses")
    .update({
      status: "parsing",
      stage,
      stage_message: stageMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  if (error) {
    console.error(
      `[Cartograph DB] Failed to update stage for analysis ${analysisId}:`,
      error.message
    );
  }
}

/**
 * Marks an analysis as failed with the stage where it stopped and the error reason.
 */
export async function markAnalysisFailed(
  analysisId: string,
  stage: PipelineStage | null,
  errorMessage: string,
  token?: string
): Promise<void> {
  const db = await createDbClient(token);

  const { error } = await db
    .from("analyses")
    .update({
      status: "failed",
      stage,
      stage_message: `Failed at stage: ${stage ?? "unknown"}`,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  if (error) {
    console.error(
      `[Cartograph DB] Failed to record error for analysis ${analysisId}:`,
      error.message
    );
  }
}

/**
 * Marks an analysis as completed with final metrics and coverage report.
 */
export async function completeAnalysisRecord(
  analysisId: string,
  data: {
    commitHash: string;
    fileCount: number;
    edgeCount: number;
    coverage: CoverageReport;
  },
  token?: string
): Promise<void> {
  const db = await createDbClient(token);

  const { error } = await db
    .from("analyses")
    .update({
      status: "completed",
      stage: null,
      stage_message: "Analysis completed successfully.",
      commit_hash: data.commitHash,
      file_count: data.fileCount,
      edge_count: data.edgeCount,
      coverage: data.coverage,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  if (error) {
    throw new Error(
      `Failed to mark analysis as completed: ${error.message}`
    );
  }
}

/**
 * Retrieves the full stored dependency graph (files and edges) for an analysis,
 * reconstructing the ParseResult contract for the workspace canvas.
 */
export async function getAnalysisGraph(
  analysisId: string,
  token?: string
): Promise<{ analysis: AnalysisRecord; graph: import("../parser/types").ParseResult } | null> {
  const db = await createDbClient(token);

  // 1. Fetch analysis record
  const { data: analysis, error: aErr } = await db
    .from("analyses")
    .select("*")
    .eq("id", analysisId)
    .single();

  if (aErr || !analysis) {
    return null;
  }

  // 2. Fetch files
  const { data: filesData, error: fErr } = await db
    .from("files")
    .select("*")
    .eq("analysis_id", analysisId);

  if (fErr || !filesData) {
    return null;
  }

  // 3. Fetch edges
  const { data: edgesData, error: eErr } = await db
    .from("edges")
    .select("*")
    .eq("analysis_id", analysisId);

  if (eErr || !edgesData) {
    return null;
  }

  // Reconstruct ParsedFile[]
  const files: import("../parser/types").ParsedFile[] = filesData.map((f: any) => {
    const rawDir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ".";
    const folder = rawDir === "" ? "." : rawDir;
    const base = f.path.includes("/") ? f.path.slice(f.path.lastIndexOf("/") + 1) : f.path;
    const dotIdx = base.lastIndexOf(".");
    const moduleName = dotIdx > 0 ? base.slice(0, dotIdx) : base;

    return {
      id: f.path,
      path: f.path,
      folder,
      lineCount: f.size_bytes || 0,
      hash: "",
      moduleName,
    };
  });

  // Reconstruct fanIn and fanOut
  const fanIn: Record<string, number> = {};
  const fanOut: Record<string, number> = {};
  for (const f of filesData) {
    fanIn[f.path] = f.fan_in || 0;
    fanOut[f.path] = f.fan_out || 0;
  }

  // Reconstruct ParsedEdge[]
  const edges: import("../parser/types").ParsedEdge[] = edgesData.map((e: any) => {
    let kind: import("../parser/types").EdgeKind = "import";
    if (e.import_type === "dynamic") {
      kind = "dynamic-import";
    } else if (e.import_type === "re-export") {
      kind = "re-export";
    }

    return {
      source: e.source_path,
      target: e.target_path,
      kind,
      specifier: e.target_path,
    };
  });

  const foldersSet = new Set<string>();
  for (const f of files) {
    foldersSet.add(f.folder);
  }

  const coverage: CoverageReport = analysis.coverage || {
    totalFilesFound: files.length,
    totalFilesParsed: files.length,
    totalFilesSkipped: 0,
    skippedFiles: [],
    totalImports: edges.length,
    resolvedImports: edges.length,
    externalImports: 0,
    excludedImports: 0,
    unresolvedImports: 0,
    reExportsFound: 0,
    reExportsResolved: 0,
    resolutions: [],
  };

  return {
    analysis: analysis as AnalysisRecord,
    graph: {
      files,
      edges,
      fanIn,
      fanOut,
      coverage,
      folders: Array.from(foldersSet).sort(),
    },
  };
}
