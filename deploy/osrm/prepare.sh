#!/usr/bin/env sh
# R4: xử lý bản đồ OpenStreetMap Việt Nam cho OSRM (thuật toán MLD), cách tính đường xe máy.
# Chạy lại mỗi tháng sau khi tải bản đồ mới. Cần khoảng 4 đến 6 GB RAM trong lúc chạy.
#
#   cd deploy/osrm
#   curl -L -o data/vietnam-latest.osm.pbf https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
#   sh prepare.sh
#
# Kết quả nằm trong data/ (không commit), dịch vụ osrm trong docker-compose đọc thư mục này.
set -eu

IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="$HERE/data"

if [ ! -f "$DATA/vietnam-latest.osm.pbf" ]; then
  echo "Thiếu $DATA/vietnam-latest.osm.pbf, tải bản đồ trước." >&2
  exit 1
fi

cp "$HERE/motorbike.lua" "$DATA/motorbike.lua"
run() {
  MSYS_NO_PATHCONV=1 docker run --rm -t -v "$DATA:/data" "$IMAGE" "$@"
}

echo "1/3 Trích đường từ bản đồ (osrm-extract)"
run osrm-extract -p /data/motorbike.lua /data/vietnam-latest.osm.pbf
echo "2/3 Chia vùng (osrm-partition)"
run osrm-partition /data/vietnam-latest.osrm
echo "3/3 Tính trọng số (osrm-customize)"
run osrm-customize /data/vietnam-latest.osrm
echo "Xong. Khởi động lại dịch vụ osrm để dùng bản đồ mới."
