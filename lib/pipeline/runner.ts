import { normalizeRepoUrl, fetchCommitHash, fetchAndExtractRepo } from "./fetcher";
import { selectRepositoryFiles } from "./selector";
import { parseRepository } from "../parser";
import { storeAnalysisGraph } from "./storage";
import {
  getAnalysisByRepoUrl,
  createOrResetAnalysis,
  updateAnalysisStage,
  markAnalysisFailed,
  completeAnalysisRecord,
  AnalysisRecord,
} from "../db/analyses";
import { PipelineOptions, PipelineResult, PipelineStage } from "./types";

/**
 * Runs the complete repository analysis pipeline:
 * 1. Fetch: Normalize URL, verify commit hash, download and extract archive.
 * 2. Select: Structural inspection, verify code files, select adapter.
 * 3. Parse: Pure AST parsing with ts-morph, resolve imports/edges/fan-in/fan-out.
 * 4. Store: Batch persist files, edges, and coverage into the database.
 *
 * Guaranteed catch-at-the-top:
 * If any stage fails, the failure state and exact stage are written to the database
 * rather than leaving a row stuck in "parsing" forever.
 */
export async function runAnalysisPipeline(
  options: PipelineOptions,
  token?: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  let currentStage: PipelineStage = "fetch";
  let activeAnalysisId: string | null = options.analysisId ?? null;
  let cleanupArchive: (() => Promise<void>) | null = null;

  try {
    // 0. Normalize Repository URL
    const { owner, repo, normalizedUrl } = normalizeRepoUrl(options.repoUrl);

    // Check "One analysis per repository" constraint
    if (!options.forceRerun) {
      const existing = await getAnalysisByRepoUrl(normalizedUrl, token);
      if (existing && existing.status === "completed") {
        return {
          analysisId: existing.id,
          repoUrl: normalizedUrl,
          commitHash: existing.commit_hash ?? "",
          fileCount: existing.file_count,
          edgeCount: existing.edge_count,
          coverage: existing.coverage!,
          durationMs: 0,
          isExisting: true,
        };
      }
    }

    // Initialize or reset database analysis row
    const analysisRow = await createOrResetAnalysis(
      {
        orgId: options.orgId,
        repoUrl: normalizedUrl,
        stage: "fetch",
        stageMessage: `Fetching repository ${owner}/${repo}...`,
      },
      token
    );
    activeAnalysisId = analysisRow.id;

    // Helper to notify stage changes
    const reportStage = async (stage: PipelineStage, message: string) => {
      currentStage = stage;
      if (activeAnalysisId) {
        await updateAnalysisStage(activeAnalysisId, stage, message, token);
      }
      if (options.onStageChange) {
        await options.onStageChange(stage, message);
      }
    };

    // ==========================================
    // STAGE 1: FETCH
    // ==========================================
    await reportStage("fetch", `Querying remote commit for ${owner}/${repo}...`);
    const commitHash = await fetchCommitHash(normalizedUrl);

    await reportStage("fetch", `Downloading archive for commit ${commitHash.slice(0, 7)}...`);
    const { extractDir, cleanup } = await fetchAndExtractRepo(owner, repo, commitHash);
    cleanupArchive = cleanup;

    // ==========================================
    // STAGE 2: SELECT
    // ==========================================
    await reportStage("select", "Inspecting repository structure and candidate files...");
    const selection = await selectRepositoryFiles(extractDir);

    // ==========================================
    // STAGE 3: PARSE
    // ==========================================
    await reportStage(
      "parse",
      `Parsing ${selection.candidateFileCount} files and resolving dependency graph...`
    );
    const parseResult = parseRepository(extractDir, selection.adapter);

    // ==========================================
    // STAGE 4: STORE
    // ==========================================
    await reportStage(
      "store",
      `Persisting ${parseResult.files.length} files and ${parseResult.edges.length} edges...`
    );

    await storeAnalysisGraph(activeAnalysisId, options.orgId, parseResult, token);

    await completeAnalysisRecord(
      activeAnalysisId,
      {
        commitHash,
        fileCount: parseResult.files.length,
        edgeCount: parseResult.edges.length,
        coverage: parseResult.coverage,
      },
      token
    );

    const durationMs = Date.now() - startTime;

    return {
      analysisId: activeAnalysisId,
      repoUrl: normalizedUrl,
      commitHash,
      fileCount: parseResult.files.length,
      edgeCount: parseResult.edges.length,
      coverage: parseResult.coverage,
      durationMs,
      isExisting: false,
    };
  } catch (error: any) {
    const errorMessage = error?.message || "An unexpected error occurred during analysis.";
    console.error(`[Pipeline Error] Failed during stage '${currentStage}':`, errorMessage);

    if (activeAnalysisId) {
      try {
        await markAnalysisFailed(
          activeAnalysisId,
          currentStage,
          `[${currentStage}] ${errorMessage}`,
          token
        );
      } catch (dbErr: any) {
        console.error("[Pipeline Error] Could not record failure state to DB:", dbErr.message);
      }
    }

    throw new Error(`[Pipeline ${currentStage}] ${errorMessage}`);
  } finally {
    // Always clean up extracted temporary files
    if (cleanupArchive) {
      await cleanupArchive();
    }
  }
}
