import fs from 'node:fs';
import path from 'node:path';
import { parseRepository } from './index';
import { fallbackAdapter } from './adapter';

function main() {
  const args = process.argv.slice(2);
  let targetDir = '.';
  let outFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && i + 1 < args.length) {
      outFile = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      targetDir = args[i];
    }
  }

  const absoluteTarget = path.resolve(targetDir);
  console.log(`Parsing repository at: ${absoluteTarget}`);

  const startTime = Date.now();
  const result = parseRepository(absoluteTarget, fallbackAdapter);
  const duration = Date.now() - startTime;

  const { coverage, edges, folders } = result;

  console.log(`\n=== PARSE SUMMARY (${duration}ms) ===`);
  console.log(`Files found:    ${coverage.totalFilesFound}`);
  console.log(`Files parsed:   ${coverage.totalFilesParsed}`);
  console.log(`Files skipped:  ${coverage.totalFilesSkipped}`);
  console.log(`Distinct folders: ${folders.length}`);
  console.log(`Total edges:    ${edges.length}`);

  if (coverage.skippedFiles.length > 0) {
    console.log(`\n--- Skipped Files Summary ---`);
    const reasonCounts = new Map<string, number>();
    for (const item of coverage.skippedFiles) {
      reasonCounts.set(item.reason, (reasonCounts.get(item.reason) || 0) + 1);
    }
    for (const [reason, count] of reasonCounts.entries()) {
      console.log(`- ${reason}: ${count} file(s)`);
    }
  }

  console.log(`\n--- Coverage Summary ---`);
  console.log(`Total imports:       ${coverage.totalImports}`);
  console.log(`Resolved internal:   ${coverage.resolvedImports}`);
  console.log(`External (packages): ${coverage.externalImports}`);
  console.log(`Excluded:            ${coverage.excludedImports}`);
  console.log(`Unresolved:          ${coverage.unresolvedImports}`);
  console.log(`Re-exports found:    ${coverage.reExportsFound}`);
  console.log(`Re-exports resolved: ${coverage.reExportsResolved}`);

  const unresolved = coverage.resolutions.filter((r) => r.status === 'unresolved');
  if (unresolved.length > 0) {
    console.log(`\n--- Unresolved Imports Detail ---`);
    for (const item of unresolved) {
      console.log(`- [${item.source}] import '${item.specifier}': ${item.reason}`);
    }
  }

  if (outFile) {
    const outPath = path.resolve(outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\nOutput written to contract file: ${outPath}`);
  }
}

main();
