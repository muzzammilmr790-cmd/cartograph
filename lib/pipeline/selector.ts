import fs from "node:fs";
import path from "node:path";
import { FrameworkAdapter, fallbackAdapter } from "../parser/adapter";

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  "coverage",
  ".vercel",
  ".idea",
  ".vscode",
]);

export interface SelectionSummary {
  adapter: FrameworkAdapter;
  candidateFileCount: number;
  entryPoints: string[];
  hasTsConfig: boolean;
  hasPackageJson: boolean;
}

/**
 * Stage 2: Select
 * Inspects the extracted directory, checks configuration files,
 * determines the framework adapter, and verifies candidate files exist.
 */
export async function selectRepositoryFiles(
  rootDir: string
): Promise<SelectionSummary> {
  const hasTsConfig = fs.existsSync(path.join(rootDir, "tsconfig.json"));
  const hasPackageJson = fs.existsSync(path.join(rootDir, "package.json"));

  // Check if Next.js or other framework is present (fallback for now, adapter expandable)
  const adapter = fallbackAdapter;

  let candidateFileCount = 0;
  const entryPoints: string[] = [];

  function scan(currentDir: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          scan(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext) && !entry.name.endsWith(".d.ts")) {
          candidateFileCount++;
          if (
            entry.name.startsWith("index.") ||
            entry.name.startsWith("main.") ||
            entry.name.startsWith("app.")
          ) {
            entryPoints.push(path.relative(rootDir, path.join(currentDir, entry.name)).replace(/\\/g, "/"));
          }
        }
      }
    }
  }

  scan(rootDir);

  if (candidateFileCount === 0) {
    throw new Error(
      "Repository contains no supported TypeScript or JavaScript files (.ts, .tsx, .js, .jsx)."
    );
  }

  return {
    adapter,
    candidateFileCount,
    entryPoints,
    hasTsConfig,
    hasPackageJson,
  };
}
