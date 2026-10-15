export type EdgeKind = 'import' | 're-export' | 'dynamic-import';

export interface ParsedFile {
  id: string; // Relative path normalized with forward slashes
  path: string; // Relative path
  folder: string; // Folder path relative to root
  lineCount: number;
  hash: string; // SHA-256 hash of file content
  moduleName: string;
}

export interface ParsedEdge {
  source: string; // Relative path of source file
  target: string; // Relative path of target file
  kind: EdgeKind;
  specifier: string;
}

export type ResolutionStatus =
  | 'resolved_internal'
  | 'external'
  | 'excluded'
  | 'unresolved';

export interface ImportResolution {
  source: string;
  specifier: string;
  kind: EdgeKind;
  status: ResolutionStatus;
  target?: string;
  reason?: string;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface CoverageReport {
  totalFilesFound: number;
  totalFilesParsed: number;
  totalFilesSkipped: number;
  skippedFiles: SkippedFile[];
  totalImports: number;
  resolvedImports: number;
  externalImports: number;
  excludedImports: number;
  unresolvedImports: number;
  reExportsFound: number;
  reExportsResolved: number;
  resolutions: ImportResolution[];
}

export interface ParseResult {
  files: ParsedFile[];
  edges: ParsedEdge[];
  fanIn: Record<string, number>;
  fanOut: Record<string, number>;
  coverage: CoverageReport;
  folders: string[];
}
