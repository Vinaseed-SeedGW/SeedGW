// D6: query cho giao diện phải đọc dữ liệu có phạm vi qua getScopedDb(). Script này tìm chỗ đọc thẳng
// db.<model> với model có trong SCOPED_MODELS ở apps/web/src/server/queries. Chỗ nào cố ý đọc toàn bộ
// (chỉ Quản trị hệ thống được gọi) thì ghi comment "pham-vi-toan-bo:" kèm lý do ở dòng ngay trên.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const QUERIES = join(ROOT, 'apps/web/src/server/queries');
const SCOPED = join(ROOT, 'packages/db/src/scoped-client.ts');

const scopedSource = readFileSync(SCOPED, 'utf8');
const models = [...scopedSource.matchAll(/^\s{2}([A-Z][A-Za-z]+): \{ ownerField/gm)].map(
  (match) => match[1].charAt(0).toLowerCase() + match[1].slice(1),
);
if (models.length === 0) {
  console.error('Không đọc được SCOPED_MODELS trong', SCOPED);
  process.exit(1);
}

const pattern = new RegExp(
  `\\bdb\\.(${models.join('|')})\\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|count|groupBy|aggregate)\\b`,
);
const problems = [];
for (const file of readdirSync(QUERIES).filter((name) => name.endsWith('.ts'))) {
  const lines = readFileSync(join(QUERIES, file), 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (!pattern.test(line)) return;
    const above = lines.slice(Math.max(0, index - 3), index).join('\n');
    if (above.includes('pham-vi-toan-bo:')) return;
    problems.push(`apps/web/src/server/queries/${file}:${index + 1}: ${line.trim()}`);
  });
}

if (problems.length > 0) {
  console.error('Đọc dữ liệu có phạm vi mà không qua getScopedDb():');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('Dùng getScopedDb(), hoặc ghi comment "pham-vi-toan-bo: <lý do>" nếu cố ý.');
  process.exit(1);
}
console.log(`Kiểm phạm vi: ${models.length} model, không có chỗ đọc thiếu phạm vi.`);
