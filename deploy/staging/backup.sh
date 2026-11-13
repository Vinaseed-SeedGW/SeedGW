#!/usr/bin/env bash
# Sao lưu máy chủ thử: database (pg_dump) và ảnh MinIO. Đặt cron chạy mỗi đêm, ví dụ:
#   30 1 * * * DMS_ENV_FILE=/opt/dms/staging.env /opt/dms/repo/deploy/staging/backup.sh >> /var/log/dms-backup.log 2>&1
# BACKUP_DIR nên là ổ hoặc máy khác (gắn NFS, ổ USB), không nằm cùng ổ với dữ liệu.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/srv/dms-backup}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DMS_ENV_FILE="${DMS_ENV_FILE:-/opt/dms/staging.env}"
export DMS_ENV_FILE
PROJECT=dms-staging
COMPOSE=(docker compose -f "$(dirname "$0")/docker-compose.yml" -p "$PROJECT")
# Image MinIO không có tar, nên đọc thẳng volume bằng một container nhỏ.
TAR_IMAGE=alpine:3.20
STAMP="$(date +%Y%m%d-%H%M)"

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/photos"

# Dạng custom của pg_dump nén sẵn và khôi phục được từng phần.
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$BACKUP_DIR/db/dms-$STAMP.dump.partial"
mv "$BACKUP_DIR/db/dms-$STAMP.dump.partial" "$BACKUP_DIR/db/dms-$STAMP.dump"

# Ảnh tự xoá sau 45 ngày nên bản chép toàn bộ vẫn nhỏ ở giai đoạn thử.
docker run --rm -v "${PROJECT}_minio-data:/data:ro" "$TAR_IMAGE" tar -C /data -czf - . \
  > "$BACKUP_DIR/photos/minio-$STAMP.tar.gz.partial"
gzip -t "$BACKUP_DIR/photos/minio-$STAMP.tar.gz.partial"
mv "$BACKUP_DIR/photos/minio-$STAMP.tar.gz.partial" "$BACKUP_DIR/photos/minio-$STAMP.tar.gz"

find "$BACKUP_DIR" -type f -name '*.partial' -delete
find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') Đã sao lưu: db/dms-$STAMP.dump, photos/minio-$STAMP.tar.gz"
