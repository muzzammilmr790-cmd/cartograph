"use server";

import { getOrProvisionCurrentOrg } from "@/lib/org";
import { normalizeRepoUrl } from "@/lib/pipeline/fetcher";
import {
  getAnalysisByRepoUrl,
  createOrResetAnalysis,
  getAnalysisById,
} from "@/lib/db/analyses";
import { runAnalysisPipeline } from "@/lib/pipeline/runner";

export interface StartAnalysisResponse {
  success: boolean;
  redirectUrl?: string;
  analysisId?: string;
  isExisting?: boolean;
  error?: string;
}

/**
 * Server Action: Start or navigate to repository analysis.
 * Enforces: One analysis per repository.
 * Submitting a URL that has already been analysed takes you to the existing analysis.
 */
export async function startAnalysisAction(
  rawUrl: string
): Promise<StartAnalysisResponse> {
  try {
    // 1. Resolve current user's organization
    const currentOrg = await getOrProvisionCurrentOrg();
    if (!currentOrg) {
      return {
        success: false,
        error: "You must be signed in to an organization to run an analysis.",
      };
    }

    // 2. Validate and normalize repository URL
    let normalizedUrl: string;
    try {
      const normalized = normalizeRepoUrl(rawUrl);
      normalizedUrl = normalized.normalizedUrl;
    } catch (normErr: any) {
      return {
        success: false,
        error: normErr.message,
      };
    }

    // 3. Check for existing analysis in this organization
    const existing = await getAnalysisByRepoUrl(normalizedUrl);
    if (existing && existing.status === "completed") {
      // Land on existing analysis immediately
      return {
        success: true,
        redirectUrl: `/analysis/${existing.id}`,
        analysisId: existing.id,
        isExisting: true,
      };
    }

    // 4. Create or reset analysis record in database
    const analysisRow = await createOrResetAnalysis({
      orgId: currentOrg.orgId,
      repoUrl: normalizedUrl,
      stage: "fetch",
      stageMessage: "Starting repository analysis...",
    });

    // 5. Kick off background pipeline execution
    // The top-level catch inside runAnalysisPipeline guarantees failed status is written to DB
    runAnalysisPipeline({
      repoUrl: normalizedUrl,
      orgId: currentOrg.orgId,
      analysisId: analysisRow.id,
      forceRerun: true,
    }).catch((err) => {
      console.error("[Background Pipeline Run Error]:", err);
    });

    return {
      success: true,
      redirectUrl: `/analysis/${analysisRow.id}`,
      analysisId: analysisRow.id,
      isExisting: false,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to start analysis.",
    };
  }
}

/**
 * Server Action: Re-run an analysis deliberately.
 */
export async function retryAnalysisAction(
  analysisId: string
): Promise<StartAnalysisResponse> {
  try {
    const currentOrg = await getOrProvisionCurrentOrg();
    if (!currentOrg) {
      return {
        success: false,
        error: "You must be signed in to an organization.",
      };
    }

    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return {
        success: false,
        error: "Analysis not found.",
      };
    }

    await createOrResetAnalysis({
      orgId: currentOrg.orgId,
      repoUrl: analysis.repo_url,
      stage: "fetch",
      stageMessage: "Retrying analysis...",
    });

    runAnalysisPipeline({
      repoUrl: analysis.repo_url,
      orgId: currentOrg.orgId,
      analysisId: analysis.id,
      forceRerun: true,
    }).catch((err) => {
      console.error("[Retry Pipeline Run Error]:", err);
    });

    return {
      success: true,
      redirectUrl: `/analysis/${analysis.id}`,
      analysisId: analysis.id,
      isExisting: false,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to retry analysis.",
    };
  }
}
