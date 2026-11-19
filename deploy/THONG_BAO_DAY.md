# Thông báo đẩy trên app (M7)

App gửi thông báo qua dịch vụ đẩy của Expo. Expo chuyển sang Google (Firebase Cloud Messaging) cho Android và Apple (APNs) cho iPhone. Code đã xong; còn cấu hình tài khoản dưới đây, rồi build bản app mới (thông báo có phần gốc nên không đẩy qua bản cập nhật được).

## Android: Firebase (người có tài khoản Google của công ty làm)

1. Vào https://console.firebase.google.com, tạo dự án tên `SeedGW` (quyết định 34). Không cần bật Google Analytics.
2. Trong dự án chọn Thêm ứng dụng, chọn Android. Tên gói nhập đúng `vn.vinaseed.seedgw` (mã gói mới theo quyết định 34), biệt danh `SeedGW Android`. Tải tệp `google-services.json`.
3. Vào Cài đặt dự án, thẻ Tài khoản dịch vụ, bấm Tạo khoá riêng tư mới. Tải tệp khoá dạng JSON. Tệp này là bí mật, không gửi qua chat, không đưa vào git.
4. Đưa hai tệp lên EAS từ thư mục `apps/mobile` (Claude làm cùng nếu cần):
   - Tệp cấu hình app, dạng biến môi trường tệp:
     `npx eas-cli env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret`
   - Khoá tài khoản dịch vụ, để Expo gửi được qua Firebase:
     `npx eas-cli credentials` rồi chọn Android, Google Service Account, Push Notifications (FCM V1), tải tệp khoá lên.
5. Xoá hai tệp khỏi máy sau khi tải lên.

## iPhone: APNs

Khi build bản iPhone (TestFlight, M9a), chạy build trên máy có người đăng nhập Apple. EAS hỏi có tạo khoá đẩy (Push Notifications key) không thì chọn có. Mật khẩu và mã 2 lớp do người dùng nhập.

## Sau khi có cấu hình

- Build APK mới: `npx eas-cli build --profile thu-nghiem --platform android`.
- Cài bản mới, đăng nhập, cho phép thông báo. Tab Tôi hiện "Thông báo: Đang bật".
- Thử: Quản trị trả lời một yêu cầu Hỗ trợ trên web, điện thoại nhận thông báo trong vài giây.

## Tuỳ chọn

- `EXPO_ACCESS_TOKEN`: bật Push security trên tài khoản Expo thì phải đặt biến này cho worker.
- Giờ nhắc chưa check-in và bật tắt nhắc ở trang Tham số, nhóm Thông báo trên app.
