# Dựng máy chủ thử (staging) DMS Vinaseed

Tài liệu cho IT Vinaseed, task F6 và F7. Máy chủ thử dùng để chạy thử app check-in và web với dữ liệu thử, trước khi dựng máy chủ thật.

## 1. IT cần chuẩn bị

| Hạng mục | Yêu cầu |
|---|---|
| Máy chủ | Một máy ảo Linux Ubuntu 24.04, 4 vCPU, 8 GB RAM, ổ SSD 100 GB. Máy thật (production) theo cấu hình ở TASKS.md F7 |
| Tên miền | Một tên miền con, ví dụ `dms-thu.vinaseed.com.vn`, bản ghi A trỏ về địa chỉ IP công khai của DMZ |
| Mở cổng | Từ Internet vào máy chủ: TCP 80 và 443. Cổng 80 cần để Let's Encrypt cấp và gia hạn chứng chỉ |
| Ra Internet | Máy chủ gọi ra được `github.com`, `ghcr.io`, Docker Hub, `registry.npmjs.org`, `maps.vietmap.vn`, `acme-v02.api.letsencrypt.org` |
| Sao lưu | Một thư mục trên ổ hoặc máy khác, gắn vào máy chủ, ví dụ `/srv/dms-backup` |
| Tài khoản | Một user Linux tên `dms`, có quyền chạy Docker |

Nếu công ty đã có Nginx ở DMZ làm HTTPS, xem mục 6.

## 2. Cài đặt lần đầu

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker dms

# Mã nguồn (repo riêng tư, dùng tài khoản GitHub được cấp quyền đọc)
sudo mkdir -p /opt/dms && sudo chown dms:dms /opt/dms
git clone https://github.com/Vinaseed-DMS/dms-vinaseed.git /opt/dms/repo

# Biến môi trường: chép mẫu, điền mật khẩu và khoá thật (sinh bằng openssl rand -base64 32)
cp /opt/dms/repo/deploy/staging/staging.env.example /opt/dms/staging.env
chmod 600 /opt/dms/staging.env
nano /opt/dms/staging.env
```

Chạy lần đầu, từ `/opt/dms/repo`:

```bash
export DMS_ENV_FILE=/opt/dms/staging.env
docker compose -f deploy/staging/docker-compose.yml -p dms-staging up -d --build
deploy/staging/wait-healthy.sh
# Tạo quyền, vai trò và tài khoản mẫu. Chỉ chạy một lần, chỉ trên máy chủ thử, không chạy trên máy thật.
docker compose -f deploy/staging/docker-compose.yml -p dms-staging run --rm -e NODE_ENV=staging migrate \
  pnpm --filter @dms/db exec tsx prisma/seed.ts
```

Kiểm tra từ điện thoại dùng 4G: mở `https://<tên miền>/api/health`, phải thấy `"status":"ok"`.

## 3. Tự triển khai khi merge vào main

GitHub Actions (`.github/workflows/ci.yml`) kiểm tra mọi PR. Khi merge vào `main`, bước cuối chạy trên một runner cài ngay trong máy chủ thử. Runner chỉ gọi ra GitHub, GitHub không cần vào được mạng nội bộ.

1. Trên GitHub: repo, Settings, Actions, Runners, New self-hosted runner, chọn Linux. Làm theo các lệnh GitHub hiện, cài vào `/opt/dms/runner` bằng user `dms`.
2. Khi cấu hình, thêm nhãn `dms-staging`: `./config.sh --url ... --token ... --labels dms-staging`.
3. Chạy như dịch vụ: `sudo ./svc.sh install dms && sudo ./svc.sh start`.
4. Trên GitHub: Settings, Environments, tạo môi trường `staging`.

Sau đó merge một PR, khoảng 10 phút sau máy chủ thử chạy bản mới. Phiên bản đang chạy xem ở trường `version` của `/api/health`.

## 4. Sao lưu và khôi phục

```bash
# Cron mỗi đêm 1:30
30 1 * * * DMS_ENV_FILE=/opt/dms/staging.env BACKUP_DIR=/srv/dms-backup /opt/dms/repo/deploy/staging/backup.sh >> /var/log/dms-backup.log 2>&1
```

Giữ 14 ngày gần nhất. Khôi phục (ghi đè dữ liệu hiện tại, script hỏi lại trước khi làm):

```bash
deploy/staging/restore.sh /srv/dms-backup/db/dms-<ngày giờ>.dump /srv/dms-backup/photos/minio-<ngày giờ>.tar.gz
```

Trước khi chạy thật cần diễn tập khôi phục một lần trên máy trắng, ghi lại thời gian (mục tiêu dưới 1 giờ).

## 5. Vận hành hằng ngày

| Việc | Lệnh (từ `/opt/dms/repo`, đã `export DMS_ENV_FILE=/opt/dms/staging.env`) |
|---|---|
| Xem trạng thái | `docker compose -f deploy/staging/docker-compose.yml -p dms-staging ps` |
| Xem log web | `docker compose -f deploy/staging/docker-compose.yml -p dms-staging logs web --tail 200` |
| Khởi động lại | `docker compose -f deploy/staging/docker-compose.yml -p dms-staging restart web` |
| Dung lượng đĩa | `df -h` và `docker system df` |

Chỉ Caddy mở cổng ra ngoài. Database, Redis, MinIO chỉ nằm trong mạng nội bộ của Docker. Đăng nhập sai 10 lần liên tiếp thì tài khoản tự khoá 5 phút (đã có trong hệ thống).

## 6. Nếu dùng Nginx sẵn có ở DMZ

Nginx giữ chứng chỉ HTTPS và chuyển tiếp về máy chủ thử. Khi đó đặt `DMS_DOMAIN=:80` trong `staging.env` để Caddy chỉ nhận HTTP từ Nginx, và chỉ cho Nginx gọi vào cổng 80 của máy chủ.

```nginx
server {
  listen 443 ssl http2;
  server_name dms-thu.vinaseed.com.vn;
  client_max_body_size 5m;
  location / {
    proxy_pass http://<IP máy chủ thử>:80;
    # Giữ nguyên Host để link xem ảnh check-in đúng chữ ký.
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

## 7. Sau khi máy chủ thử chạy

Báo lại tên miền cho Phòng ĐMST&CĐS để:

- Đặt biến `EXPO_PUBLIC_API_URL=https://<tên miền>` cho bản build app trên Expo, rồi build lại app iPhone.
- Đổi khoá Vietmap đã gắn trong app bản thử R3, khoá mới chỉ đặt trong `staging.env`.

## 8. Thử trên máy cá nhân qua Cloudflare Tunnel (TASKS P1)

Dùng trong giai đoạn xây dựng, 2 đến 3 tài khoản thử, chưa có máy chủ của IT. Điện thoại đi 4G gọi vào máy cá nhân qua Cloudflare; máy không cần mở cổng router.

- Caddy có thêm cổng `127.0.0.1:8080`, **chỉ cho đi qua `/api/mobile/*` và `/api/health`**. Trang web quản trị không ra Internet, xem trong máy ở `https://localhost`.
- `cloudflared` cài ở `C:\Users\<tên>\tools\cloudflared\cloudflared.exe` (bản 2026.10.7, có chữ ký Cloudflare).

Chạy (PowerShell, từ thư mục gốc repo, Docker Desktop đang chạy):

```powershell
$env:DMS_ENV_FILE = './local-test.env'
docker compose -f deploy/staging/docker-compose.yml -p dms-staging up -d --build
& "$HOME\tools\cloudflared\cloudflared.exe" tunnel --no-autoupdate --url http://127.0.0.1:8080
```

Lệnh cuối in ra địa chỉ dạng `https://<bốn-từ>.trycloudflare.com`. Đây là **tunnel tạm**: mỗi lần chạy lại (tắt máy, khởi động lại) địa chỉ đổi. Khi đổi:

```powershell
cd apps/mobile
npx eas-cli env:set --environment preview --name EXPO_PUBLIC_API_URL --value https://<địa-chỉ-mới> --non-interactive
npx eas-cli update --channel thu-nghiem --environment preview --message "Đổi địa chỉ máy chủ thử"
```

App tự tải bản cập nhật ở lần mở kế tiếp và dùng địa chỉ mới từ lần mở sau nữa. Dữ liệu đang chờ gửi trên máy không mất.

Muốn địa chỉ cố định: thêm một tên miền vào tài khoản Cloudflare, tạo tunnel có tên (`cloudflared tunnel login`, `cloudflared tunnel create dms-thu`) và trỏ một tên miền con vào `http://127.0.0.1:8080`. Khi đó không cần bước cập nhật app ở trên.
