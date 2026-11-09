// Chan cac ky tu font UTM Neo Sans Intel khong co (AGENTS.md muc 10).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOTS = ['apps/web/src', 'apps/mobile/src', 'apps/mobile/App.tsx', 'packages/ui/src'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.expo', 'dist']);
const FORBIDDEN = /[₫–—•·×→≤≥°«» ]/u;

function* walk(path) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    return;
  }
  if (stats.isFile()) {
    if (EXTENSIONS.has(extname(path))) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (!SKIPPED_DIRECTORIES.has(entry)) yield* walk(join(path, entry));
  }
}

let failures = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        const match = line.match(FORBIDDEN);
        if (match) {
          const code = match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
          console.error(`${relative('.', file)}:${index + 1} ky tu U+${code} khong co trong font`);
          failures += 1;
        }
      });
  }
}

if (failures > 0) {
  console.error(`Co ${failures} cho dung ky tu font khong co. Xem BRAND.md muc 2.`);
  process.exit(1);
}
console.log('Ky tu hop le.');
