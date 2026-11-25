# Rà bảo mật SeedGW (D6)

Rà ngày 25/11/2026 theo OWASP Top 10 bản 2021. Ghi đúng những gì đã có, đã kiểm và chưa làm.

## Đã có

| Mục OWASP | Cách làm trong SeedGW | Kiểm bằng |
|---|---|---|
| A01 Kiểm soát truy cập | Mỗi trang gọi `requirePermission`, Server Action gọi `assertCan`, Route Handler cho app gọi `assertMobileCan`. Dữ liệu theo người và đơn vị đọc qua `getScopedDb()` với 17 model trong `SCOPED_MODELS`. | `pnpm check:scope` chặn query đọc thẳng `db.<model>` thiếu phạm vi; test quyền theo vai trò ở `packages/contracts/src/access.test.ts` |
| A02 Mã hoá | Mật khẩu băm argon2. Tài khoản FAST mã hoá AES-256-GCM bằng `INTEGRATION_SECRET_KEY`. HTTPS và HSTS do Caddy đặt. | Đọc code `credentials.ts`, `packages/db/src/integration-settings.ts` |
| A03 Chèn mã | Prisma tham số hoá câu lệnh; câu lệnh SQL viết tay dùng tagged template. Mọi đầu vào validate bằng Zod ở máy chủ. React tự escape chữ hiển thị. | Đọc code, `pnpm typecheck` |
| A04 Thiết kế | Cảnh báo không chặn nghiệp vụ (check-in luôn ghi nhận, cờ nghi vấn chỉ để xem lại). Đăng nhập thay ghi rõ người thật. | Theo DESIGN_BRIEF |
| A05 Cấu hình | Header `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` đặt trong `next.config.ts`; bỏ `X-Powered-By`. Không trả stack trace ra ngoài. | `curl -I` trang đăng nhập trên máy dev |
| A06 Thư viện có lỗ hổng | Rà `pnpm audit --prod`; nâng bản vá cùng đời cho `postcss` và `effect` bằng `overrides` trong `pnpm-workspace.yaml`. | `pnpm audit --prod`: từ 9 còn 4 |
| A07 Xác thực | Khoá tài khoản 5 phút khi sai 10 lần trong 15 phút. Mới thêm: chặn theo IP khi sai 30 lần trong 15 phút (Redis), áp cho cả web và app. Mật khẩu tạm phải đổi lần đầu. Token app thu hồi khi khoá thiết bị. | Đọc code `credentials.ts`, `login-rate-limit.ts` |
| A08 Toàn vẹn dữ liệu | Check-in idempotent theo `clientId`; giờ trên ảnh theo giờ máy chủ. | Test check-in |
| A09 Nhật ký | `AuditLog` cho mọi thao tác tạo, sửa, xoá, duyệt, có IP. | Trang Quản trị › Nhật ký |
| A10 SSRF | Máy chủ chỉ gọi địa chỉ cố định trong biến môi trường (FAST, Vietmap, OSRM, kho ảnh), không gọi URL người dùng nhập. | Đọc code `integrations/` |

## Còn lại, chưa xử lý

| Việc | Lý do chưa làm | Đề xuất |
|---|---|---|
| 4 lỗ hổng thư viện gián tiếp: `uuid` (qua exceljs), `deepmerge-ts` (qua Prisma), `glob`, `minimatch` (công cụ build) | Bản vá đổi đời phiên bản, có thể làm hỏng exceljs và Prisma. Phần lớn chỉ dùng lúc build, không nhận dữ liệu từ người dùng. | Nâng khi Next.js, Prisma, exceljs ra bản mới; rà lại mỗi tháng |
| CSP còn `'unsafe-inline'` cho script | Next.js chèn script nội tuyến khi dựng trang; dùng nonce thì mọi trang phải dựng động. | Cân nhắc khi lên máy chủ IT |
| Thử truy cập chéo bằng tài khoản thật trên mọi trang `[id]` | Cần đăng nhập thay từng vai trò trên máy dev. | Làm khi bạn đăng nhập sẵn, ghi kết quả vào đây |
| Giới hạn tần suất các API khác của app | Chưa thấy cần ở 300 người dùng. | Theo dõi khi thử tải (D5) |
| Ghi lỗi tự động | Chốt 25/11 tự ghi vào CSDL (F9). | Làm ở đợt hạ tầng |
