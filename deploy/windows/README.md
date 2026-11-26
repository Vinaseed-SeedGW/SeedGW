# Máy chủ thật SeedGW trên Windows Server

Quyết định 26/11/2026: máy chủ thật là Windows Server 2022 hoặc 2025 tại `10.10.8.35`, chạy thẳng trên Windows, không dùng Docker. Chưa dùng được SSH, nên mỗi bước là một script PowerShell, người có quyền vào máy chạy qua Remote Desktop rồi gửi kết quả cho nhóm dự án.

Tài liệu cho Ubuntu và Docker ở `deploy/README.md` vẫn dùng cho máy chủ thử trên máy cá nhân, sẽ viết lại khi xong các bước dưới đây.

## Bước 1. Kiểm tra máy (chỉ đọc)

Script `kiem-tra-may.ps1` chỉ đọc thông tin, không cài đặt, không sửa cấu hình, không đọc mật khẩu hay biến môi trường.

1. Remote Desktop vào `10.10.8.35`.
2. Chép tệp `kiem-tra-may.ps1` vào máy, ví dụ ra Desktop (chép dán tệp qua Remote Desktop được).
3. Mở PowerShell bằng **Run as administrator**, chạy:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Desktop\kiem-tra-may.ps1"
   ```

4. Gửi tệp `seedgw-kiem-tra-<tên máy>-<ngày giờ>.txt` vừa tạo trên Desktop cho nhóm dự án.

Script báo: phiên bản Windows, CPU, RAM, ổ đĩa; IIS, Hyper-V, WSL đã bật chưa; tiến trình đang giữ cổng 80, 443, 3000, 5432, 6379, 9000; địa chỉ đăng ký với dịch vụ HTTP của Windows; phần mềm và dịch vụ liên quan (Node, PostgreSQL, Redis, Git, .NET); máy có gọi ra GitHub, npm, Vietmap, Let's Encrypt, Expo, Firebase không; tường lửa; đồng bộ giờ.

## Các bước tiếp theo (chưa làm)

2. Sửa code cho Windows: lưu ảnh check-in ra ổ đĩa thay cho MinIO; thử hàng đợi với Garnet thay Redis.
3. Script `cai-dat.ps1`, `trien-khai.ps1`, `sao-luu.ps1`, `khoi-phuc.ps1`; dịch vụ Windows cho web và worker.
4. Viết lại `deploy/README.md`, `deploy/CHUYEN_LEN_MAY_CHU_VINASEED.md` cho Windows.
5. Dựng trên `10.10.8.35`, nạp đại lý và nhân viên thật, đổi địa chỉ app.
