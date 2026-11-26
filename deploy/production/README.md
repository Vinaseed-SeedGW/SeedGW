# Dựng máy chủ thật SeedGW

Chốt 26/11/2026:

- SeedGW chạy trên **máy ảo Ubuntu 24.04** do IT tạo trên VMware: 8 vCPU, 16 GB RAM, ổ 400 GB. Code không phải sửa vì vốn chạy trên Linux và Docker như máy chủ thử.
- **IIS trên Windows Server 10.10.8.35** giữ tên miền `seedgw.vinaseed.com.vn` và chứng chỉ HTTPS, chuyển tiếp HTTP qua mạng nội bộ vào cổng 80 của máy ảo.
- Dữ liệu ban đầu **chuyển từ máy chủ thử** (đại lý, nhân viên, cơ cấu, vùng tỉnh, lịch vụ), rồi làm sạch dữ liệu đợt thử.

```
Điện thoại 4G, trình duyệt
        |  https://seedgw.vinaseed.com.vn
        v
IIS (10.10.8.35, giữ chứng chỉ)  --HTTP nội bộ-->  Máy ảo Ubuntu: Caddy :80 -> web, MinIO
                                                    (PostgreSQL, Redis, worker chỉ trong Docker)
```

Tệp trong thư mục này:

| Tệp | Dùng để |
|---|---|
| `docker-compose.yml` | Chạy SeedGW trên máy ảo, tên project `seedgw` |
| `Caddyfile` | Chia đường trong máy ảo, chỉ tin IP người dùng do IIS gửi |
| `production.env.example` | Mẫu biến môi trường, chép thành `/opt/seedgw/production.env` |
| `iis/web.config`, `iis/cau-hinh-iis.ps1` | Cấu hình site `Seedgw` trên IIS 10.10.8.35 |
| `lam-sach-du-lieu-thu.sql` | Làm sạch dữ liệu đợt thử sau khi chuyển dữ liệu |

Sao lưu, khôi phục, chờ khởi động dùng chung script ở `deploy/staging/`, đặt `SEEDGW_PROJECT=seedgw` và `SEEDGW_COMPOSE_FILE=deploy/production/docker-compose.yml`.

## 1. IT chuẩn bị

| Việc | Chi tiết |
|---|---|
| Máy ảo Ubuntu 24.04 | 8 vCPU, 16 GB RAM, ổ 400 GB, IP nội bộ cố định cùng mạng với 10.10.8.35 |
| Vào máy ảo | SSH từ máy của nhóm dự án vào máy ảo (cổng 22), hoặc mở console VMware cho nhóm dự án |
| Ra Internet từ máy ảo | `github.com`, `ghcr.io`, Docker Hub, `registry.npmjs.org`, `maps.vietmap.vn`, `exp.host`, `fcm.googleapis.com` |
| Chứng chỉ HTTPS | Cho `seedgw.vinaseed.com.vn` trên IIS: chứng chỉ chung `*.vinaseed.com.vn` nếu có, hoặc Let's Encrypt bằng win-acme |
| Mở ra Internet | Tên miền công khai `seedgw.vinaseed.com.vn` trỏ về IP công khai, chuyển cổng 443 (và 80 nếu dùng Let's Encrypt) vào 10.10.8.35 |
| Thư mục site | Cho biết `C:\inetpub\wwwroot\SeedGW` đang chứa gì; script IIS vẫn tự sao lưu trước khi ghi |

Chưa có chứng chỉ HTTPS thì đăng nhập web không được, vì cookie đăng nhập chỉ gửi qua HTTPS.

## 2. Cài máy ảo Ubuntu (lần đầu)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo useradd -m -s /bin/bash seedgw || true
sudo usermod -aG docker seedgw

# Tường lửa: cổng 80 chỉ cho IIS, SSH cho mạng nội bộ
sudo ufw allow from 10.10.8.35 to any port 80 proto tcp
sudo ufw allow from 10.10.0.0/16 to any port 22 proto tcp
sudo ufw enable

# Mã nguồn (repo riêng tư, dùng khoá triển khai chỉ đọc hoặc tài khoản được cấp quyền)
sudo mkdir -p /opt/seedgw /srv/seedgw-backup && sudo chown -R seedgw:seedgw /opt/seedgw /srv/seedgw-backup
# Máy chủ thật luôn chạy nhánh production (docs/TEST_VA_PRODUCTION.md)
sudo -iu seedgw git clone -b production https://github.com/Vinaseed-SeedGW/SeedGW.git /opt/seedgw/repo

# Biến môi trường: khoá MỚI, không chép từ máy chủ thử
sudo -iu seedgw cp /opt/seedgw/repo/deploy/production/production.env.example /opt/seedgw/production.env
sudo -iu seedgw chmod 600 /opt/seedgw/production.env
sudo -iu seedgw nano /opt/seedgw/production.env
```

Các lệnh dưới đây chạy bằng user `seedgw`, từ `/opt/seedgw/repo`, sau khi:

```bash
export SEEDGW_ENV_FILE=/opt/seedgw/production.env
export SEEDGW_PROJECT=seedgw
export SEEDGW_COMPOSE_FILE=deploy/production/docker-compose.yml
alias dc='docker compose -f $SEEDGW_COMPOSE_FILE -p $SEEDGW_PROJECT'
```

Build và bật phần dữ liệu trước (chưa bật web):

```bash
dc build
dc up -d postgres redis minio
```

## 3. Chuyển dữ liệu từ máy chủ thử

**Trên máy cá nhân đang chạy máy chủ thử** (Git Bash, từ thư mục repo):

```bash
SEEDGW_ENV_FILE=deploy/staging/local-test.env BACKUP_DIR=$HOME/seedgw-backup bash deploy/staging/backup.sh
```

Được hai tệp `db/seedgw-<ngày giờ>.dump` và `photos/minio-<ngày giờ>.tar.gz`. Chép sang máy ảo vào `/srv/seedgw-backup/` (qua SSH: `scp`, hoặc qua thư mục chia sẻ do IT cấp).

**Trên máy ảo:**

```bash
deploy/staging/restore.sh /srv/seedgw-backup/db/seedgw-<ngày giờ>.dump /srv/seedgw-backup/photos/minio-<ngày giờ>.tar.gz
```

Script hỏi lại, gõ `KHOI PHUC`. Xong khôi phục, script bật web và worker; migration mới hơn bản sao lưu tự chạy trước web.

Làm sạch dữ liệu đợt thử (khoá tài khoản mẫu, xoá check-in và điểm GPS thử, giữ đại lý, nhân viên, sổ đồng ý):

```bash
dc exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < deploy/production/lam-sach-du-lieu-thu.sql
```

Kiểm tra từ máy ảo: `curl -s http://127.0.0.1/api/health -H 'Host: seedgw.vinaseed.com.vn'` ra `"status":"ok"`.

## 4. Cấu hình IIS trên 10.10.8.35

Remote Desktop vào 10.10.8.35, chép thư mục `deploy/production/iis` vào máy, mở PowerShell bằng **Run as administrator**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\iis\cau-hinh-iis.ps1 -VmIp <IP máy ảo>
```

Script sao lưu cấu hình IIS và thư mục site trước, hỏi lại rồi mới đổi, in lệnh hoàn tác. Sau đó IT gắn chứng chỉ cho binding `https` của site `Seedgw` và bật quy tắc chuyển sang HTTPS trong `web.config`.

Kiểm tra từ điện thoại đi 4G: `https://seedgw.vinaseed.com.vn/api/health` ra `"status":"ok"`.

## 5. Sau khi chạy

1. Đăng nhập web bằng ADMIN, **đổi mật khẩu ADMIN ngay**.
2. Quản trị, Kết nối: nhập lại cấu hình FAST (khoá mã hoá mới nên cấu hình cũ không đọc được).
3. App bản Production (SeedGW, kênh `production`): đặt `EXPO_PUBLIC_API_URL=https://seedgw.vinaseed.com.vn` ở môi trường EAS `production`, build hồ sơ `production` (Android) và `production-ios`, phát cho người dùng. Bản Test (SeedGW Thử) vẫn trỏ máy chủ thử.
4. Đặt lịch sao lưu mỗi đêm 1:30 (`crontab -e` của user `seedgw`):

   ```
   30 1 * * * SEEDGW_ENV_FILE=/opt/seedgw/production.env SEEDGW_PROJECT=seedgw SEEDGW_COMPOSE_FILE=/opt/seedgw/repo/deploy/production/docker-compose.yml BACKUP_DIR=/srv/seedgw-backup /opt/seedgw/repo/deploy/staging/backup.sh >> /opt/seedgw/backup.log 2>&1
   ```

5. Tắt tunnel và máy chủ thử trên máy cá nhân khi người dùng đã chuyển hết sang máy chủ thật.

Bật km theo đường đi (không bắt buộc): tải bản đồ và chạy `deploy/osrm/prepare.sh` trên máy ảo (cần khoảng 6 GB RAM lúc chạy), đặt `OSRM_URL=http://osrm:5000` trong `production.env`, rồi `dc --profile osrm up -d`.

## 6. Cập nhật bản mới

Chỉ cập nhật khi nhánh `production` đã nhận bản đã thử xong trên Test (docs/TEST_VA_PRODUCTION.md).

```bash
git checkout production
git pull --ff-only
dc up -d --build --remove-orphans
deploy/staging/wait-healthy.sh
docker image prune -f
```

Trước mỗi lần cập nhật có migration, chạy `deploy/staging/backup.sh` (với các biến ở mục 2).

## 7. Vận hành

| Việc | Lệnh |
|---|---|
| Trạng thái | `dc ps` |
| Log web | `dc logs web --tail 200` |
| Khởi động lại web | `dc restart web` |
| Dung lượng | `df -h` và `docker system df` |
