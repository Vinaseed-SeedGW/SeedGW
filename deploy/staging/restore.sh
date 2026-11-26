#!/usr/bin/env bash
# Khôi phục máy chủ thử từ bản sao lưu. GHI ĐÈ toàn bộ dữ liệu hiện có.
#   deploy/staging/restore.sh /srv/seedgw-backup/db/seedgw-20261113-0130.dump [/srv/seedgw-backup/photos/minio-20261113-0130.tar.gz]
set -euo pipefail

DB_DUMP="${1:?Cần đường dẫn file .dump}"
PHOTOS_TAR="${2:-}"
SEEDGW_ENV_FILE="${SEEDGW_ENV_FILE:-/opt/seedgw/staging.env}"
export SEEDGW_ENV_FILE
# Máy chủ thật (deploy/production) đặt SEEDGW_PROJECT=seedgw và SEEDGW_COMPOSE_FILE trỏ tới file compose của nó.
PROJECT="${SEEDGW_PROJECT:-seedgw-staging}"
COMPOSE=(docker compose -f "${SEEDGW_COMPOSE_FILE:-$(dirname "$0")/docker-compose.yml}" -p "$PROJECT")
TAR_IMAGE=alpine:3.20

# Kiểm tra đủ file và file không hỏng TRƯỚC khi đụng vào dữ liệu đang chạy.
[ -f "$DB_DUMP" ] || { echo "Không thấy file database: $DB_DUMP" >&2; exit 1; }
if [ -n "$PHOTOS_TAR" ]; then
  [ -f "$PHOTOS_TAR" ] || { echo "Không thấy file ảnh: $PHOTOS_TAR" >&2; exit 1; }
  gzip -t "$PHOTOS_TAR" || { echo "File ảnh bị hỏng: $PHOTOS_TAR" >&2; exit 1; }
fi

read -r -p "Khôi phục sẽ ghi đè dữ liệu hiện tại. Gõ KHOI PHUC để tiếp tục: " answer
[ "$answer" = "KHOI PHUC" ] || { echo "Đã huỷ."; exit 1; }

trap 'echo "Khôi phục dừng giữa chừng. Kiểm tra lỗi ở trên, sửa rồi chạy lại. Web và worker đang tắt." >&2' ERR

"${COMPOSE[@]}" stop web worker
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" exec -T postgres sh -c \
  'until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q; do sleep 1; done'
"${COMPOSE[@]}" exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$DB_DUMP"

if [ -n "$PHOTOS_TAR" ]; then
  "${COMPOSE[@]}" stop minio
  docker run --rm -i -v "${PROJECT}_minio-data:/data" "$TAR_IMAGE" \
    sh -c 'rm -rf /data/* /data/.minio.sys && tar -xzf - -C /data' < "$PHOTOS_TAR"
  "${COMPOSE[@]}" up -d minio
fi

trap - ERR
"${COMPOSE[@]}" up -d web worker
"$(dirname "$0")/wait-healthy.sh"
echo "Khôi phục xong."
