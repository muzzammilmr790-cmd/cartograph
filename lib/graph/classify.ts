export type FileKind =
  | 'Route'
  | 'Component'
  | 'Hook'
  | 'Type'
  | 'Schema'
  | 'Utility'
  | 'Config'
  | 'Test'
  | 'Style'
  | 'Unidentified';

export const KIND_METADATA: Record<FileKind, { label: string; colorClass: string; borderClass: string; bgClass: string }> = {
  Route: { label: 'Route', colorClass: 'text-purple-400', borderClass: 'border-purple-500/30', bgClass: 'bg-purple-500/10' },
  Component: { label: 'Component', colorClass: 'text-blue-400', borderClass: 'border-blue-500/30', bgClass: 'bg-blue-500/10' },
  Hook: { label: 'Hook', colorClass: 'text-cyan-400', borderClass: 'border-cyan-500/30', bgClass: 'bg-cyan-500/10' },
  Utility: { label: 'Utility', colorClass: 'text-emerald-400', borderClass: 'border-emerald-500/30', bgClass: 'bg-emerald-500/10' },
  Type: { label: 'Type', colorClass: 'text-amber-400', borderClass: 'border-amber-500/30', bgClass: 'bg-amber-500/10' },
  Schema: { label: 'Schema', colorClass: 'text-amber-400', borderClass: 'border-amber-500/30', bgClass: 'bg-amber-500/10' },
  Config: { label: 'Config', colorClass: 'text-orange-400', borderClass: 'border-orange-500/30', bgClass: 'bg-orange-500/10' },
  Test: { label: 'Test', colorClass: 'text-zinc-400', borderClass: 'border-zinc-500/30', bgClass: 'bg-zinc-500/10' },
  Style: { label: 'Style', colorClass: 'text-pink-400', borderClass: 'border-pink-500/30', bgClass: 'bg-pink-500/10' },
  Unidentified: { label: 'Unidentified', colorClass: 'text-zinc-500', borderClass: 'border-zinc-500/20', bgClass: 'bg-zinc-500/10' },
};

/**
 * Classifies a file path into a structural kind based on naming and location conventions.
 */
export function classifyFile(filePath: string): FileKind {
  const normalized = filePath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const fileName = lower.split('/').pop() || '';
  const originalFileName = normalized.split('/').pop() || '';

  // Tests
  if (
    lower.includes('__tests__/') ||
    lower.includes('/tests/') ||
    lower.includes('/test/') ||
    fileName.includes('.test.') ||
    fileName.includes('.spec.')
  ) {
    return 'Test';
  }

  // Styles
  if (fileName.endsWith('.css') || fileName.endsWith('.scss') || fileName.endsWith('.sass') || fileName.endsWith('.less')) {
    return 'Style';
  }

  // Config files
  if (
    fileName.includes('.config.') ||
    fileName.startsWith('tsconfig') ||
    fileName.startsWith('.eslintrc') ||
    fileName.startsWith('.prettierrc') ||
    fileName.startsWith('tailwind.config') ||
    fileName === 'next.config.js' ||
    fileName === 'next.config.ts' ||
    fileName === 'next.config.mjs'
  ) {
    return 'Config';
  }

  // Routes / Pages / Endpoints / Framework Entry Points
  if (
    (lower.includes('app/') && (
      fileName.startsWith('page.') ||
      fileName.startsWith('route.') ||
      fileName.startsWith('layout.') ||
      fileName.startsWith('loading.') ||
      fileName.startsWith('error.') ||
      fileName.startsWith('not-found.') ||
      fileName.startsWith('template.') ||
      fileName.startsWith('default.')
    )) ||
    fileName.startsWith('middleware.') ||
    lower.includes('pages/') ||
    lower.includes('/routes/') ||
    lower.startsWith('routes/') ||
    lower.includes('/api/') ||
    lower.startsWith('api/')
  ) {
    return 'Route';
  }

  // Hooks
  const baseNameNoExt = originalFileName.replace(/\.(tsx?|jsx?)$/, '');
  if (
    lower.includes('/hooks/') ||
    lower.startsWith('hooks/') ||
    fileName.startsWith('use-') ||
    (baseNameNoExt.startsWith('use') && baseNameNoExt.length > 3 && /^[A-Z]/.test(baseNameNoExt.slice(3)))
  ) {
    return 'Hook';
  }

  // Types & Schemas
  if (
    fileName.endsWith('.d.ts') ||
    fileName.includes('.types.') ||
    fileName.includes('-types.') ||
    fileName === 'types.ts' ||
    fileName === 'types.tsx' ||
    lower.includes('/types/') ||
    lower.startsWith('types/')
  ) {
    return 'Type';
  }
  if (
    fileName.includes('.schema.') ||
    fileName.includes('-schema.') ||
    fileName === 'schema.ts' ||
    fileName === 'schemas.ts' ||
    lower.includes('/schemas/') ||
    lower.startsWith('schemas/')
  ) {
    return 'Schema';
  }

  // Components
  const isPascalCase = /^[A-Z][a-zA-Z0-9]+$/.test(baseNameNoExt);
  if (
    lower.includes('/components/') ||
    lower.startsWith('components/') ||
    lower.includes('/ui/') ||
    lower.startsWith('ui/') ||
    ((fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) && isPascalCase)
  ) {
    return 'Component';
  }

  // Utilities / Libraries / Helpers
  if (
    lower.includes('/lib/') ||
    lower.startsWith('lib/') ||
    lower.includes('/utils/') ||
    lower.startsWith('utils/') ||
    lower.includes('/util/') ||
    lower.includes('/helpers/') ||
    lower.startsWith('helpers/') ||
    fileName === 'utils.ts' ||
    fileName === 'helpers.ts'
  ) {
    return 'Utility';
  }

  return 'Unidentified';
}

/**
 * Counts files grouped by their classified kind.
 */
export function groupFilesByKind<T extends { path: string }>(files: T[]): Record<FileKind, number> {
  const counts: Record<FileKind, number> = {
    Route: 0,
    Component: 0,
    Hook: 0,
    Utility: 0,
    Type: 0,
    Schema: 0,
    Config: 0,
    Test: 0,
    Style: 0,
    Unidentified: 0,
  };

  for (const f of files) {
    const kind = classifyFile(f.path);
    counts[kind] = (counts[kind] || 0) + 1;
  }

  return counts;
}

/**
 * Returns true if a file is an entry point reached by the framework or configuration,
 * such that having zero incoming imports is expected rather than an orphan.
 */
export function isFrameworkOrConfig(filePath: string): boolean {
  const kind = classifyFile(filePath);
  return kind === 'Route' || kind === 'Config' || kind === 'Test';
}

