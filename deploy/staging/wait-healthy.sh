#!/usr/bin/env bash
# Chờ web trả /api/health = 200, tối đa khoảng 3 phút. Gọi qua container web nên không phụ thuộc DNS hay HTTPS.
set -euo pipefail

# Máy chủ thật (deploy/production) đặt SEEDGW_PROJECT=seedgw và SEEDGW_COMPOSE_FILE trỏ tới file compose của nó.
PROJECT="${SEEDGW_PROJECT:-seedgw-staging}"
COMPOSE=(docker compose -f "${SEEDGW_COMPOSE_FILE:-$(dirname "$0")/docker-compose.yml}" -p "$PROJECT")

for attempt in $(seq 1 36); do
  if "${COMPOSE[@]}" exec -T web curl -fsS http://127.0.0.1:3000/api/health; then
    echo
    echo "Máy chủ $PROJECT đã chạy (lần thử $attempt)."
    exit 0
  fi
  sleep 5
done

echo "Quá 3 phút web chưa sẵn sàng. Xem log: docker compose -p $PROJECT logs web --tail 100" >&2
exit 1
