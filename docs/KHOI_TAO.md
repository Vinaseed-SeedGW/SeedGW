# Khởi tạo dự án

Claude xây dựng toàn bộ. Quy tắc nằm ở `AGENTS.md` và `CLAUDE.md`.

## Công cụ cần có

Git, Node.js LTS, pnpm, Docker Desktop (cần WSL 2).

```bash
winget install --id Git.Git -e
```

```bash
winget install --id OpenJS.NodeJS.LTS -e
```

```bash
winget install --id Docker.DockerDesktop -e
```

```bash
npm install -g pnpm
```

## Chạy dự án

```bash
pnpm install
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Chép `.env.example` thành `.env` trước khi chạy lần đầu. Docker Desktop phải đang mở.

## Thứ tự làm các task đầu

F1, F2, F3, F4, F5, sau đó F6, F7 và các spike R1, R2, R3 theo `.design/dms-vinaseed/TASKS.md`.
