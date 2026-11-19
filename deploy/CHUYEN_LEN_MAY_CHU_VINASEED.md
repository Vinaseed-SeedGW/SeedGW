# Chuyển từ máy cá nhân lên máy chủ Vinaseed

Ngày: 16/11/2026. Trạng thái: **bản nháp, chưa gửi IT**. Gửi IT sau buổi demo 27/11/2026, khi đã làm xong các phần trong mục B do phía dự án tự làm.

Tài liệu đi kèm: [README.md](README.md) (cách dựng máy chủ, yêu cầu cho IT), [staging/staging.env.example](staging/staging.env.example) (mẫu biến môi trường), TASKS.md task F7.

Tóm tắt: phần lõi (web, database, kho ảnh, app) giữ nguyên. Phần phải bỏ hoặc sửa chủ yếu là những thứ dựng tạm để chạy trên máy cá nhân.

---

## A. Không cần nữa

| Thành phần | Hiện dùng để | Vì sao không cần nữa |
|---|---|---|
| Docker Desktop, WSL, file `.wslconfig` trên Windows | Chạy Docker trên máy Windows | Máy chủ Ubuntu cài Docker trực tiếp, nhẹ hơn, không bị giới hạn 6 GB RAM |
| Cloudflare Tunnel tạm (`trycloudflare.com`) | Cho điện thoại đi 4G gọi vào máy cá nhân, không mở cổng router | Máy chủ có tên miền thật, IT mở cổng 443 ở DMZ |
| Cổng `127.0.0.1:8080` trong Caddy | Cổng riêng cho tunnel, chỉ cho API của app đi qua | Không còn tunnel. Giữ lại nếu IT muốn trang web chỉ dùng nội bộ (câu hỏi 1 cho IT) |
| Cập nhật địa chỉ máy chủ qua expo-updates mỗi khi tunnel đổi địa chỉ | Thao tác tay mỗi lần máy cá nhân khởi động lại | Tên miền cố định, địa chỉ đặt một lần |
| File `deploy/staging/local-test.env` | Cấu hình, khoá bí mật của máy chủ thử trên máy cá nhân | Thay bằng file mới trên máy chủ với khoá mới. Không chép file này sang |
| Tài khoản mẫu ADMIN, QT001, KD001, CS001 và `SEED_PASSWORD` | Đăng nhập thử | Máy chủ thật dùng tài khoản nhân viên thật, không chạy lệnh tạo dữ liệu mẫu |
| Chứng chỉ tự cấp cho `localhost` | HTTPS trên máy cá nhân, trình duyệt cảnh báo | Caddy tự xin chứng chỉ Let's Encrypt cho tên miền thật |
| Khoá Vietmap gắn trong app (`EXPO_PUBLIC_VIETMAP_API_KEY` trên Expo) | Lấy địa chỉ trên điện thoại khi chưa có máy chủ (bản thử R3) | Khi nối máy chủ, app hỏi địa chỉ qua máy chủ. Xoá biến trên Expo và đổi khoá vì khoá đã nằm trong file APK thử |
| Script tạm (nạp đại lý, đặt mật khẩu bằng lệnh) | Thao tác nhanh khi không mở được trang web có chứng chỉ | Trên máy chủ thật làm qua trang Quản trị |

Vẫn giữ trên máy cá nhân, chỉ để phát triển: `pnpm dev`, database dev cổng 5432, trang dev cổng 3000.

---

## B. Phải sửa hoặc làm mới

### 1. Biến môi trường

| Biến | Máy cá nhân | Máy chủ Vinaseed |
|---|---|---|
| `SEEDGW_DOMAIN` | `localhost` | Tên miền IT cấp, ví dụ `seedgw.vinaseed.com.vn` |
| `AUTH_URL`, `S3_PUBLIC_ENDPOINT` | `https://localhost` | `https://<tên miền>` |
| `POSTGRES_PASSWORD`, `AUTH_SECRET`, `MINIO_ROOT_PASSWORD` | Chuỗi ngẫu nhiên của bản thử | Tạo mới: `openssl rand -base64 32` |
| `DATABASE_URL` | Chứa mật khẩu cũ | Theo mật khẩu database mới |
| `VIETMAP_API_KEY` | Khoá thử | Khoá mới đứng tên Vinaseed |
| `SEED_PASSWORD` | Có | Bỏ |
| Khoá mã hoá cấu hình kết nối `INTEGRATION_SECRET_KEY` | Có từ A8 (19/11/2026) | Tạo khoá mới cho máy chủ thật; địa chỉ và tài khoản FAST nhập ở trang Kết nối |

### 2. Tách máy chủ thật khỏi máy chủ thử

- Bộ cấu hình production riêng (tên project, file môi trường riêng), không lẫn với `deploy/staging`.
- Quy trình khởi tạo chỉ tạo quyền, vai trò và một tài khoản Quản trị hệ thống, không tạo tài khoản mẫu.
- Triển khai bản thật chỉ khi duyệt tay; bản thử vẫn tự cập nhật khi merge vào `main`.

### 3. Dữ liệu

Không chép nguyên database từ máy cá nhân (có tài khoản mẫu, check-in thử). Làm mới:

- Chạy migration tạo bảng.
- Nạp đại lý từ Excel ở Quản trị › Đại lý › Nhập Excel; sau S10 thì đồng bộ từ FAST.
- Nạp nhân viên thật (G1a).
- Muốn giữ check-in và ảnh của đợt thử thì dùng `backup.sh`, `restore.sh`. **Cần quyết định có giữ hay không.**

### 4. App điện thoại

- `EXPO_PUBLIC_API_URL` thành `https://<tên miền>`.
- Build bản phát hành (M9) trên kênh cập nhật `production`, tách khỏi `thu-nghiem`. Người thử cài bản mới vì bản cũ trỏ vào máy cá nhân.
- Bỏ khoá Vietmap khỏi app, đổi khoá cũ.
- Phát hành iOS (App Store không công khai hoặc Apple Business Manager) và Android (Google Play hoặc APK có trang tải mã QR).

### 5. Tự triển khai

Cài runner GitHub vào máy chủ (README mục 3). IT không cho gọi ra GitHub thì triển khai tay.

### 6. Sao lưu

Đặt lịch `backup.sh` mỗi đêm sang ổ hoặc máy khác; thử khôi phục định kỳ.

### 7. Hiệu năng cho 300 đến 400 người (D5, D6, F8)

- Chia bảng điểm GPS theo tháng (khoảng 800.000 điểm mỗi ngày).
- Chuyển tính km, lấy địa chỉ sang worker chạy nền.
- Giới hạn tần suất đăng nhập.

---

## C. Giữ nguyên, vẫn then chốt

| Thành phần | Vai trò |
|---|---|
| Web Next.js (trang quản trị và API cho app) | Toàn bộ nghiệp vụ: đăng nhập, 3 vai trò, đại lý, báo cáo ghé thăm, Hỗ trợ, Tham số |
| PostgreSQL | Tài khoản, đơn vị, đại lý, check-in, vết GPS, nhật ký |
| MinIO | Kho ảnh check-in, tự xoá sau 45 ngày, link ảnh có chữ ký và hạn dùng |
| Redis và worker | Hàng đợi việc nền: đồng bộ FAST, km theo đường đi, việc định kỳ của Hỗ trợ |
| Caddy | Cổng vào duy nhất, tự lo HTTPS, chặn database, Redis, MinIO khỏi bên ngoài |
| Migration database | Tạo và nâng cấp bảng an toàn mỗi lần cập nhật |
| `backup.sh`, `restore.sh`, `wait-healthy.sh`, `/api/health` | Sao lưu, khôi phục, kiểm tra sau cập nhật; IT theo dõi `/api/health` |
| Dockerfile, Docker Compose | Cùng một cách đóng gói cho máy thử và máy thật |
| Tài khoản Expo, EAS | Build bản phát hành; expo-updates sửa lỗi app không cần cài lại |
| Đăng nhập app bằng token, duyệt máy thứ hai, khoá khi nhập sai nhiều lần | Bảo mật khi API mở ra Internet |
| Hàng đợi offline trên app | Mất sóng vẫn check-in, có mạng tự gửi, không mất, không trùng |
| Lấy địa chỉ Vietmap qua máy chủ | Khoá chỉ nằm trên máy chủ |
| Nhật ký thao tác | Truy vết mọi thao tác tạo, sửa, xoá, duyệt |

---

## Các bước chuyển (task F7, khoảng 1,5 buổi sau khi IT bàn giao)

1. IT bàn giao máy chủ, tên miền, cổng 80 và 443, thư mục sao lưu (README mục 1).
2. Thêm bộ cấu hình production và quy trình chỉ tạo tài khoản quản trị.
3. Tạo file môi trường mới, khoá mới, khoá Vietmap mới.
4. Chạy máy chủ, kiểm tra `https://<tên miền>/api/health` từ điện thoại đi 4G.
5. Nạp đại lý, nhân viên thật.
6. Build app trỏ về tên miền mới, xoá khoá Vietmap trong app, đổi khoá cũ.
7. Đặt lịch sao lưu, diễn tập khôi phục.
8. Tắt tunnel và máy chủ thử trên máy cá nhân.

## Câu hỏi cho IT

1. Trang web quản trị có mở ra Internet không, hay chỉ trong mạng công ty hoặc VPN? Chỉ nội bộ thì giữ cách tách cổng như bản thử, chỉ API của app ra Internet.
2. IT có mở cổng 80 và 443 ở DMZ không? Không thì dùng Cloudflare Tunnel có tên, cần tên miền nằm trên Cloudflare.
3. Máy chủ có gọi ra được GitHub và FAST không?
4. Sao lưu đặt ở đâu, giữ bao lâu?
5. Ai được vào máy chủ, ai nhận cảnh báo khi máy chủ ngừng?
