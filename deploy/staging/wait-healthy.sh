#!/usr/bin/env bash
# Chờ web trả /api/health = 200, tối đa khoảng 3 phút. Gọi qua container web nên không phụ thuộc DNS hay HTTPS.
set -euo pipefail

COMPOSE=(docker compose -f "$(dirname "$0")/docker-compose.yml" -p dms-staging)

for attempt in $(seq 1 36); do
  if "${COMPOSE[@]}" exec -T web curl -fsS http://127.0.0.1:3000/api/health; then
    echo
    echo "Máy chủ thử đã chạy (lần thử $attempt)."
    exit 0
  fi
  sleep 5
done

echo "Quá 3 phút web chưa sẵn sàng. Xem log: docker compose -p dms-staging logs web --tail 100" >&2
exit 1
