# Test và Production

Chốt 26/11/2026. Một kho mã duy nhất, hai nhánh, hai thư mục trên máy, hai máy chủ, hai bản app. Không chép code giữa hai thư mục: đồng bộ bằng `git merge`, nên bản Production luôn là đúng bản đã thử ở Test.

| | Test | Production |
|---|---|---|
| Dùng để | Thử bản sửa lỗi, tính năng mới | Người dùng làm việc hằng ngày |
| Nhánh git | `main` | `production` |
| Thư mục trên máy | `SEEDGW` (thư mục hiện tại) | `SEEDGW\Production` (git worktree) |
| Máy chủ | Máy chủ thử (`deploy/staging`) | Máy ảo Ubuntu sau IIS 10.10.8.35 (`deploy/production`) |
| Địa chỉ | Máy chủ thử | `https://seedgw.vinaseed.com.vn` |
| App | **SeedGW Thử**, mã gói `vn.vinaseed.seedgw.test` | **SeedGW**, mã gói `vn.vinaseed.seedgw` |
| Kênh cập nhật app | `thu-nghiem`, môi trường EAS `preview` | `production`, môi trường EAS `production` |
| Hồ sơ build EAS | `thu-nghiem` (Android), `testflight` (iPhone) | `production` (Android), `production-ios` (iPhone) |

Hai bản app cài song song trên cùng một điện thoại, mỗi bản đăng nhập máy chủ của mình. Cấu hình ở `apps/mobile/app.config.js` theo biến `APP_VARIANT` (`test` hoặc `production`); không đặt thì là bản Test.

Thư mục `Production` nằm trong thư mục Test nhưng git, Prettier, ESLint, Docker, EAS đều bỏ qua nó.

## Quy trình một lần sửa

1. Làm trên nhánh việc `<ma-task>-<mo-ta>` trong thư mục `SEEDGW`, `pnpm check` đạt.
2. Merge vào `main`. Đưa lên máy chủ thử; app gửi bản cập nhật kênh `thu-nghiem`:

   ```powershell
   cd apps/mobile
   $env:APP_VARIANT = 'test'; npx.cmd eas-cli update --channel thu-nghiem --environment preview --message "<nội dung>"
   ```

3. Thử trên SeedGW Thử và web máy chủ thử. Lỗi thì quay lại bước 1.
4. Đạt thì đưa sang Production, trong thư mục `SEEDGW\Production`:

   ```powershell
   git pull --ff-only origin production
   git merge --ff-only origin/main
   git push origin production
   ```

5. Cập nhật máy chủ thật theo `deploy/production/README.md` mục 6; app gửi bản cập nhật kênh `production` từ thư mục `SEEDGW\Production`:

   ```powershell
   cd apps/mobile
   $env:APP_VARIANT = 'production'; npx.cmd eas-cli update --channel production --environment production --message "<nội dung>"
   ```

Sửa gấp trên Production: vẫn sửa ở `main` trước, thử nhanh trên Test, rồi đưa sang như bước 4. Không sửa thẳng trên nhánh `production` để hai nhánh không lệch nhau.

## Tạo thư mục Production (đã làm 26/11/2026, ghi lại để làm trên máy khác)

```powershell
git fetch origin
git worktree add Production production
cd Production
pnpm install
```

Bản cập nhật app (`eas update`) phải gửi từ đúng thư mục của nhánh tương ứng, vì gói cập nhật lấy code trong thư mục đang đứng.

## Việc cần làm một lần cho hai bản app

- Firebase (dự án `seedgw-vinaseed`): thêm app Android `vn.vinaseed.seedgw.test`, tải tệp `google-services.json` mới (có cả hai app) lên biến dạng tệp `GOOGLE_SERVICES_JSON` của cả môi trường EAS `preview` và `production`.
- EAS môi trường `production`: tạo `EXPO_PUBLIC_API_URL=https://seedgw.vinaseed.com.vn` khi máy chủ thật đã chạy.
- EAS hai môi trường: tạo biến `APP_VARIANT` (`test` ở `preview`, `production` ở `production`) để bản cập nhật không cần đặt tay.
- App Store Connect: tạo thêm app `vn.vinaseed.seedgw.test` khi phát bản Test cho iPhone.
- Build lần đầu: hồ sơ `thu-nghiem` cho SeedGW Thử, hồ sơ `production` cho SeedGW. Máy đang cài app SeedGW cũ (kênh `thu-nghiem`) cài bản Production đè lên được, giữ dữ liệu; bản Test cài thêm bên cạnh.
