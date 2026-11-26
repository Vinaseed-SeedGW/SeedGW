# Kiểm tra máy Windows Server 10.10.8.35

**Đổi hướng 26/11/2026 chiều:** máy chủ thật chạy trên một máy ảo Ubuntu riêng do IT tạo trên VMware (xem `deploy/production/README.md`). Không chạy SeedGW thẳng trên Windows nữa. Máy Windows Server `10.10.8.35` chỉ giữ IIS làm cổng vào HTTPS cho `seedgw.vinaseed.com.vn` và chuyển tiếp vào máy ảo.

Lý do: kiểm tra ngày 26/11 cho thấy máy dùng chung với 12 site IIS, RAM chỉ còn khoảng 1,3 GB trống, chỉ có ổ C: còn 31 GB; chạy thẳng trên Windows còn phải thay Redis, MinIO và bỏ máy chủ tìm đường.

## Script kiểm tra máy (chỉ đọc)

`kiem-tra-may.ps1` chỉ đọc thông tin, không cài đặt, không sửa cấu hình, không đọc mật khẩu hay biến môi trường. Dùng lại khi cần xem tình trạng một máy Windows.

1. Remote Desktop vào máy, chép `kiem-tra-may.ps1` ra Desktop.
2. Mở PowerShell bằng **Run as administrator**, chạy:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Desktop\kiem-tra-may.ps1"
   ```

3. Gửi tệp `seedgw-kiem-tra-<tên máy>-<ngày giờ>.txt` trên Desktop cho nhóm dự án.

Script báo: phiên bản Windows, CPU, RAM, ổ đĩa; IIS, Hyper-V, WSL; tiến trình giữ cổng 80, 443, 3000, 5432, 6379, 9000; địa chỉ đăng ký với dịch vụ HTTP của Windows; phần mềm và dịch vụ liên quan; máy có gọi ra GitHub, npm, Vietmap, Let's Encrypt, Expo, Firebase không; tường lửa; đồng bộ giờ.
