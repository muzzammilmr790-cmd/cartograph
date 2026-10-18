import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface NormalizedRepo {
  owner: string;
  repo: string;
  normalizedUrl: string;
}

/**
 * Normalizes user-entered repository strings into standard GitHub public URLs.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - http://github.com/owner/repo/
 * - github.com/owner/repo
 * - owner/repo
 */
export function normalizeRepoUrl(rawUrl: string): NormalizedRepo {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Repository URL cannot be empty.");
  }

  // Remove trailing slashes and .git suffix
  let cleaned = trimmed.replace(/\.git\/?$/, "").replace(/\/+$/, "");

  // Remove protocols
  cleaned = cleaned.replace(/^(?:https?:\/\/|git:\/\/)?(?:www\.)?/, "");

  // If starts with github.com/, remove it
  if (cleaned.startsWith("github.com/")) {
    cleaned = cleaned.replace(/^github\.com\//, "");
  }

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Invalid repository URL "${rawUrl}". Expected format: https://github.com/owner/repo or owner/repo`
    );
  }

  const owner = parts[0];
  const repo = parts[1];

  // Validate GitHub owner and repo name conventions
  const nameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!nameRegex.test(owner) || !nameRegex.test(repo)) {
    throw new Error(
      `Invalid characters in repository owner or name: "${owner}/${repo}"`
    );
  }

  const normalizedUrl = `https://github.com/${owner}/${repo}`;
  return { owner, repo, normalizedUrl };
}

/**
 * Fetches the latest HEAD commit hash from the public remote repository.
 * Uses git ls-remote directly to avoid unauthenticated GitHub API rate limits.
 */
export async function fetchCommitHash(repoUrl: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git ls-remote "${repoUrl}" HEAD`, {
      timeout: 15000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });

    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === "HEAD") {
        return parts[0];
      }
    }

    if (lines[0] && lines[0].trim().length >= 40) {
      return lines[0].trim().slice(0, 40);
    }

    throw new Error(`Could not determine HEAD commit hash from remote output.`);
  } catch (error: any) {
    const stderr = error?.stderr?.toString() || error?.message || "";
    if (
      stderr.includes("Repository not found") ||
      stderr.includes("not found") ||
      stderr.includes("could not read Username") ||
      stderr.includes("Authentication failed")
    ) {
      throw new Error(
        `Repository not found or private: ${repoUrl}. Only public repositories are supported.`
      );
    }
    throw new Error(
      `Failed to query remote repository: ${stderr || error.message}`
    );
  }
}

export interface ExtractedRepo {
  extractDir: string;
  commitHash: string;
  cleanup: () => Promise<void>;
}

/**
 * Fetches the repository archive for the specified commit hash and extracts it into
 * an isolated temporary directory.
 */
export async function fetchAndExtractRepo(
  owner: string,
  repo: string,
  commitHash: string
): Promise<ExtractedRepo> {
  const tempBaseDir = path.join(
    os.tmpdir(),
    "cartograph",
    `${owner}-${repo}-${Date.now()}`
  );
  await fs.mkdir(tempBaseDir, { recursive: true });

  const extractDir = path.join(tempBaseDir, "src");
  await fs.mkdir(extractDir, { recursive: true });

  const archivePath = path.join(tempBaseDir, "archive.tar.gz");

  const cleanup = async () => {
    try {
      if (fsSync.existsSync(tempBaseDir)) {
        await fs.rm(tempBaseDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`[Pipeline] Cleanup warning for ${tempBaseDir}:`, err);
    }
  };

  try {
    // 1. Download archive tarball from codeload
    const codeloadUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/${commitHash}`;
    let downloaded = false;

    try {
      const response = await fetch(codeloadUrl, {
        headers: {
          "User-Agent": "cartograph-archive-fetcher",
        },
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(archivePath, Buffer.from(arrayBuffer));
        downloaded = true;
      }
    } catch {
      // Continue to fallback if codeload HTTP fetch fails
    }

    if (downloaded && fsSync.existsSync(archivePath)) {
      // Extract with tar
      try {
        execSync(`tar -xzf "${archivePath}" -C "${extractDir}" --strip-components=1`, {
          stdio: "pipe",
          timeout: 30000,
        });

        // Remove archive file to save space
        await fs.unlink(archivePath).catch(() => {});

        return { extractDir, commitHash, cleanup };
      } catch (extractErr: any) {
        console.warn(
          `[Pipeline] Tar extraction failed, trying shallow clone fallback:`,
          extractErr.message
        );
      }
    }

    // 2. Fallback: Shallow git clone if archive extraction failed
    const cloneUrl = `https://github.com/${owner}/${repo}.git`;
    await execAsync(
      `git clone --depth 1 "${cloneUrl}" "${extractDir}"`,
      {
        timeout: 45000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      }
    );

    return { extractDir, commitHash, cleanup };
  } catch (error: any) {
    await cleanup();
    throw new Error(
      `Failed to fetch and extract repository ${owner}/${repo}: ${error.message}`
    );
  }
}
