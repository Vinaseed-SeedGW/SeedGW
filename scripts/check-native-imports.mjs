// Chặn import thẳng thư viện native mà bản app đã cài trên máy người dùng chưa có (19/11/2026).
// Bản cập nhật qua mạng không thêm được phần native; import thẳng thì app lỗi lúc mở và tự quay về bản cài gốc.
// Thư viện trong danh sách chỉ được nạp sau khi kiểm requireOptionalNativeModule, bằng import() trong hàm.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Thêm vào đây mỗi thư viện native mới, bỏ ra khi mọi máy đã cài bản app có nó.
const OPTIONAL_NATIVE = ['expo-device', 'expo-notifications'];
const ROOTS = ['apps/mobile/App.tsx', 'apps/mobile/src'];

function files(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

const problems = [];
for (const file of ROOTS.flatMap(files).filter((name) => /\.(ts|tsx)$/.test(name))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const name of OPTIONAL_NATIVE) {
      if (new RegExp(`^\\s*import\\s(?!type\\b).*from\\s+['"]${name}['"]`).test(line)) {
        problems.push(`${file}:${index + 1} import thẳng ${name}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error('Thư viện native chưa có trên mọi bản app đã cài, phải nạp có kiểm tra:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('Không có import thẳng thư viện native mới.');
