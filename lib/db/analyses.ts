import { createDbClient } from "./client";

export interface AnalysisRecord {
  id: string;
  organization_id: string;
  project_id: string | null;
  repo_url: string;
  status: "pending" | "parsing" | "completed" | "failed";
  commit_hash: string | null;
  file_count: number;
  edge_count: number;
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
