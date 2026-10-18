import { CoverageReport, ParseResult } from "../parser/types";

export type PipelineStage = "fetch" | "select" | "parse" | "store";

export type AnalysisStatus = "pending" | "parsing" | "completed" | "failed";

export interface StageUpdate {
  stage: PipelineStage;
  message: string;
  timestamp: string;
}

export interface PipelineOptions {
  repoUrl: string;
  orgId: string;
  analysisId?: string;
  forceRerun?: boolean;
  onStageChange?: (stage: PipelineStage, message: string) => Promise<void> | void;
}

export interface PipelineResult {
  analysisId: string;
  repoUrl: string;
  commitHash: string;
  fileCount: number;
  edgeCount: number;
  coverage: CoverageReport;
  durationMs: number;
  isExisting?: boolean;
}
