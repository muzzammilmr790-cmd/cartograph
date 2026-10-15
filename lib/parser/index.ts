import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Project, SyntaxKind, KindToNodeMappings, SourceFile } from 'ts-morph';
import { FrameworkAdapter, fallbackAdapter } from './adapter';
import {
  ParseResult,
  ParsedFile,
  ParsedEdge,
  ImportResolution,
  SkippedFile,
  CoverageReport,
  EdgeKind,
} from './types';

const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.vercel',
  '.idea',
  '.vscode',
]);

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function getRelativePath(rootDir: string, absolutePath: string): string {
  const rel = path.relative(rootDir, absolutePath);
  return normalizePath(rel);
}

function computeFolder(relativePath: string): string {
  const dir = path.dirname(relativePath);
  const normalized = normalizePath(dir);
  return normalized === '.' ? '.' : normalized;
}

function calculateHashAndLines(content: string): { hash: string; lineCount: number } {
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  const lines = content.split('\n').length;
  return { hash, lineCount: lines };
}

function isBuiltinModule(specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  const builtins = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
    'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http',
    'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
    'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
    'string_decoder', 'sys', 'timers', 'tls', 'tty', 'dgram', 'url', 'util',
    'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
  ]);
  return builtins.has(specifier);
}

function walkDir(
  rootDir: string,
  currentDir: string,
  adapter: FrameworkAdapter,
  foundFiles: string[],
  skippedFiles: SkippedFile[]
) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = getRelativePath(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
        skippedFiles.push({
          path: relPath,
          reason: `Ignored directory: ${entry.name}`,
        });
        continue;
      }
      if (adapter.isExcluded && adapter.isExcluded(relPath)) {
        skippedFiles.push({
          path: relPath,
          reason: `Adapter excluded directory: ${relPath}`,
        });
        continue;
      }
      walkDir(rootDir, fullPath, adapter, foundFiles, skippedFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (entry.name.endsWith('.d.ts')) {
        skippedFiles.push({
          path: relPath,
          reason: 'TypeScript declaration file (.d.ts)',
        });
        continue;
      }
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        skippedFiles.push({
          path: relPath,
          reason: `Unsupported file extension: ${ext || 'no extension'}`,
        });
        continue;
      }
      if (adapter.isExcluded && adapter.isExcluded(relPath)) {
        skippedFiles.push({
          path: relPath,
          reason: `Adapter excluded file: ${relPath}`,
        });
        continue;
      }
      foundFiles.push(fullPath);
    }
  }
}

export function parseRepository(
  rootDir: string,
  adapter: FrameworkAdapter = fallbackAdapter
): ParseResult {
  const absoluteRootDir = path.resolve(rootDir);

  if (!fs.existsSync(absoluteRootDir)) {
    throw new Error(`Directory does not exist: ${absoluteRootDir}`);
  }

  const rawFiles: string[] = [];
  const skippedFiles: SkippedFile[] = [];

  walkDir(absoluteRootDir, absoluteRootDir, adapter, rawFiles, skippedFiles);

  const tsconfigPath = path.join(absoluteRootDir, 'tsconfig.json');
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      jsx: 1, // Preserve / react
    },
    ...(fs.existsSync(tsconfigPath)
      ? { tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: true }
      : {}),
  });

  for (const filePath of rawFiles) {
    project.addSourceFileAtPath(filePath);
  }

  const parsedFilesMap = new Map<string, ParsedFile>();
  const parsedFiles: ParsedFile[] = [];
  const sourceFileMap = new Map<string, SourceFile>();
  const foldersSet = new Set<string>();

  for (const filePath of rawFiles) {
    const relPath = getRelativePath(absoluteRootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const { hash, lineCount } = calculateHashAndLines(content);
    const folder = computeFolder(relPath);
    foldersSet.add(folder);

    const parsedFile: ParsedFile = {
      id: relPath,
      path: relPath,
      folder,
      lineCount,
      hash,
      moduleName: path.basename(filePath, path.extname(filePath)),
    };

    parsedFilesMap.set(relPath, parsedFile);
    parsedFiles.push(parsedFile);

    const sf = project.getSourceFile(filePath);
    if (sf) {
      sourceFileMap.set(relPath, sf);
    }
  }

  const rawEdges: { source: string; target: string; kind: EdgeKind; specifier: string }[] = [];
  const resolutions: ImportResolution[] = [];

  let reExportsFound = 0;
  let reExportsResolved = 0;

  for (const [sourceRelPath, sourceFile] of sourceFileMap.entries()) {
    // 1. Plain imports
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      const kind: EdgeKind = 'import';

      const resolvedSf = importDecl.getModuleSpecifierSourceFile();
      processResolution(
        absoluteRootDir,
        sourceRelPath,
        specifier,
        kind,
        resolvedSf,
        parsedFilesMap,
        rawEdges,
        resolutions
      );
    }

    // 2. Re-exports
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      if (!exportDecl.hasModuleSpecifier()) continue;
      reExportsFound++;
      const specifier = exportDecl.getModuleSpecifierValue()!;
      const kind: EdgeKind = 're-export';

      const resolvedSf = exportDecl.getModuleSpecifierSourceFile();
      const wasResolved = processResolution(
        absoluteRootDir,
        sourceRelPath,
        specifier,
        kind,
        resolvedSf,
        parsedFilesMap,
        rawEdges,
        resolutions
      );
      if (wasResolved) {
        reExportsResolved++;
      }
    }

    // 3. Dynamic imports: import('specifier')
    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpr = node as KindToNodeMappings[SyntaxKind.CallExpression];
        const expression = callExpr.getExpression();
        if (expression.getKind() === SyntaxKind.ImportKeyword) {
          const args = callExpr.getArguments();
          if (args.length > 0) {
            const firstArg = args[0];
            if (firstArg.getKind() === SyntaxKind.StringLiteral) {
              const specifier = firstArg.getText().slice(1, -1);
              const kind: EdgeKind = 'dynamic-import';

              let resolvedSf: SourceFile | undefined;
              try {
                const sym = firstArg.getSymbol();
                const valDeclaration = sym?.getValueDeclaration();
                if (valDeclaration && valDeclaration.getSourceFile()) {
                  resolvedSf = valDeclaration.getSourceFile();
                }
              } catch {
                // Ignore resolution error for dynamic import AST lookups
              }

              processResolution(
                absoluteRootDir,
                sourceRelPath,
                specifier,
                kind,
                resolvedSf,
                parsedFilesMap,
                rawEdges,
                resolutions
              );
            }
          }
        }
      }
    });
  }

  // Deduplicate edges by (source, target, kind)
  const edgeKeyMap = new Map<string, ParsedEdge>();
  for (const edge of rawEdges) {
    const key = `${edge.source}->${edge.target}:${edge.kind}`;
    if (!edgeKeyMap.has(key)) {
      edgeKeyMap.set(key, edge);
    }
  }
  const edges = Array.from(edgeKeyMap.values());

  // Compute Fan-in and Fan-out per file based on unique edges
  const fanIn: Record<string, number> = {};
  const fanOut: Record<string, number> = {};

  for (const file of parsedFiles) {
    fanIn[file.id] = 0;
    fanOut[file.id] = 0;
  }

  const uniqueSourceTargetPairs = new Set<string>();
  for (const edge of edges) {
    const pair = `${edge.source}=>${edge.target}`;
    if (!uniqueSourceTargetPairs.has(pair)) {
      uniqueSourceTargetPairs.add(pair);
      fanOut[edge.source] = (fanOut[edge.source] || 0) + 1;
      fanIn[edge.target] = (fanIn[edge.target] || 0) + 1;
    }
  }

  let resolvedImports = 0;
  let externalImports = 0;
  let excludedImports = 0;
  let unresolvedImports = 0;

  for (const res of resolutions) {
    if (res.status === 'resolved_internal') resolvedImports++;
    else if (res.status === 'external') externalImports++;
    else if (res.status === 'excluded') excludedImports++;
    else if (res.status === 'unresolved') unresolvedImports++;
  }

  const coverage: CoverageReport = {
    totalFilesFound: rawFiles.length + skippedFiles.length,
    totalFilesParsed: rawFiles.length,
    totalFilesSkipped: skippedFiles.length,
    skippedFiles,
    totalImports: resolutions.length,
    resolvedImports,
    externalImports,
    excludedImports,
    unresolvedImports,
    reExportsFound,
    reExportsResolved,
    resolutions,
  };

  return {
    files: parsedFiles,
    edges,
    fanIn,
    fanOut,
    coverage,
    folders: Array.from(foldersSet).sort(),
  };
}

function processResolution(
  rootDir: string,
  sourceRelPath: string,
  specifier: string,
  kind: EdgeKind,
  resolvedSf: SourceFile | undefined,
  parsedFilesMap: Map<string, ParsedFile>,
  rawEdges: { source: string; target: string; kind: EdgeKind; specifier: string }[],
  resolutions: ImportResolution[]
): boolean {
  if (resolvedSf) {
    const resolvedAbsPath = resolvedSf.getFilePath();
    const resolvedRelPath = getRelativePath(rootDir, resolvedAbsPath);

    if (parsedFilesMap.has(resolvedRelPath)) {
      rawEdges.push({
        source: sourceRelPath,
        target: resolvedRelPath,
        kind,
        specifier,
      });
      resolutions.push({
        source: sourceRelPath,
        specifier,
        kind,
        status: 'resolved_internal',
        target: resolvedRelPath,
      });
      return true;
    } else {
      resolutions.push({
        source: sourceRelPath,
        specifier,
        kind,
        status: 'excluded',
        reason: `Target file exists but was excluded from parse: ${resolvedRelPath}`,
      });
      return false;
    }
  }

  if (isBuiltinModule(specifier) || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
    resolutions.push({
      source: sourceRelPath,
      specifier,
      kind,
      status: 'external',
      reason: isBuiltinModule(specifier)
        ? `Node builtin module: ${specifier}`
        : `Third-party external package: ${specifier}`,
    });
    return false;
  }

  resolutions.push({
    source: sourceRelPath,
    specifier,
    kind,
    status: 'unresolved',
    reason: `Could not resolve specifier '${specifier}' to a file in directory`,
  });
  return false;
}
