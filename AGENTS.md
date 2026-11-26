# SeedGW - Quy tắc dự án

Claude xây dựng toàn bộ Backend và Frontend. Cách làm việc nằm ở `CLAUDE.md`. Nếu có mâu thuẫn thì theo file này.

## 1. Dự án

Phần mềm nội bộ của Vinaseed, gồm web và app điện thoại cho 300-400 người dùng. Tên hiện cho người dùng là **SeedGW** (`APP_NAME` trong `@seedgw/config/brand`), mã gói `vn.vinaseed.seedgw`, package `@seedgw/*`. Phần mềm cũ gọi là "hệ thống cũ". Sau đăng nhập, người dùng luôn đi qua **Hub** chia 2 bộ phận: Kinh doanh, Quản trị. Cán bộ nhân viên gửi yêu cầu hỗ trợ bằng nút nổi trên web, quản trị xử lý ở Quản trị › Hỗ trợ. Hệ thống kết nối FAST Business Online, Mattermost và có dashboard chỉ số, chỉ tiêu.

## 2. Nguồn sự thật

Đọc đúng tài liệu trước khi làm. Không tự suy đoán khi tài liệu đã có câu trả lời.

| Cần biết | Đọc ở |
|---|---|
| Mục tiêu, dữ liệu, tích hợp, quyết định đã chốt | `.design/seedgw/DESIGN_BRIEF.md` |
| Trang, menu, thứ tự nội dung, luồng, tên gọi, URL, định nghĩa chỉ số | `.design/seedgw/INFORMATION_ARCHITECTURE.md` |
| Danh sách việc và tiêu chí xong | `.design/seedgw/TASKS.md` |
| Logo, font, màu, chân trang | `.design/seedgw/BRAND.md` |
| Bản nhìn đúng kích thước thật | `.design/seedgw/brand/demo-giao-dien.html` |
| Mẫu code từng lớp | `docs/MAU_CODE.md` |
| Trình tự khởi tạo | `docs/KHOI_TAO.md` |

## 3. Công nghệ

Không đổi công nghệ, không thêm thư viện lớn nếu chưa được duyệt.

- Monorepo: pnpm workspaces + Turborepo, Node.js LTS, TypeScript strict.
- Web: Next.js 15 App Router, React 19, Tailwind CSS 4, shadcn/ui.
- Bảng: TanStack Table. Form: React Hook Form + Zod 4. Client cache: TanStack Query, chỉ dùng cho Hộp thư và phần realtime. Biểu đồ: Recharts qua `next/dynamic`.
- Dữ liệu: PostgreSQL 16, Prisma, Redis, BullMQ, MinIO.
- Đăng nhập: Auth.js cho web, JWT cho app.
- App: Expo, expo-location, expo-camera, expo-sqlite.
- Tên package nội bộ: `@seedgw/db`, `@seedgw/contracts`, `@seedgw/ui`, `@seedgw/config`.

## 4. Cấu trúc và các lớp

| Đường dẫn | Nội dung |
|---|---|
| `packages/db/**` | Schema Prisma, migration, seed |
| `packages/contracts/**` | Hợp đồng Zod, kiểu dữ liệu, nhãn trạng thái, dữ liệu mẫu cho test, `formatVnd` |
| `packages/config/**` | ESLint, tsconfig, thông tin chân trang `FOOTER` |
| `packages/ui/**` | Token, component dùng chung, compound component |
| `apps/worker/**` | Job BullMQ, FAST, Zalo, Mattermost |
| `apps/web/src/server/**` | `auth/`, `queries/`, `actions/`, `services/`, `integrations/` |
| `apps/web/src/app/api/**`, `apps/web/src/middleware.ts` | Route Handler, chặn truy cập |
| `apps/web/src/app/**` (trừ `api/`) | Route, layout, page, loading, error |
| `apps/web/src/features/**`, `apps/web/src/components/**`, `apps/web/src/lib/**` | Giao diện theo nghiệp vụ, tiện ích hiển thị |
| `apps/web/public/**` | Logo, ảnh tĩnh |
| `apps/mobile/app/**`, `apps/mobile/src/components/**` | Màn hình, component app |
| `apps/mobile/src/sync/**`, `apps/mobile/src/api/**` | Hàng đợi offline, gọi API |
| `docker-compose*.yml`, `.github/**`, `deploy/**`, `.env.example` | Hạ tầng, CI/CD |

Quy tắc giữa các lớp:

1. Giao diện chỉ lấy và ghi dữ liệu qua `apps/web/src/server/queries`, `actions`, dùng kiểu trong `@seedgw/contracts`.
2. Giao diện không import `@seedgw/db`, không gọi database, không tự kiểm quyền thay cho máy chủ. Ẩn nút chỉ để giao diện gọn, không phải bảo mật.
3. File trong `server/` phải có `import 'server-only'`, riêng file Server Action dùng `'use server'`.
4. Không tạo API nội bộ cho web tự gọi. Page dùng query, form dùng action. `app/api/**` chỉ dành cho app điện thoại, FAST, webhook và SSE.

## 5. Quy trình cho mỗi tính năng

1. Viết hợp đồng trong `packages/contracts/src/<mien>.ts`.
2. Viết migration, service, query, action, kèm kiểm quyền, phạm vi dữ liệu, audit.
3. Dựng giao diện theo IA và `BRAND.md`, đủ trạng thái đang tải, trống, lỗi, không có quyền, có dữ liệu.
4. Kiểm tra theo tiêu chí "Xong khi" trong `TASKS.md`.

## 6. Định dạng code

Prettier và ESLint là chuẩn cuối cùng. Không định dạng tay trái với cấu hình.

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| File và thư mục | `kebab-case` | `order-form.tsx`, `list-orders.ts` |
| Component | `PascalCase` | `OrderForm` |
| Hàm, biến | `camelCase` | `listOrders` |
| Hook | `useX`, file `use-x.ts` | `useOrderDraft` |
| Hằng số | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |
| Schema Zod | `camelCase`, đuôi theo vai trò | `createOrderInput`, `orderSummary` |
| Kiểu suy ra | `PascalCase` | `CreateOrderInput` |
| Giá trị enum | `UPPER_SNAKE_CASE` tiếng Anh | `PENDING_APPROVAL` |
| Model Prisma | `PascalCase` số ít, bảng `snake_case` số nhiều qua `@@map` | `Order`, `orders` |
| Trường Prisma | `camelCase`, cột `snake_case` qua `@map` | `orderedAt`, `ordered_at` |
| Quyền | `module.resource.action` | `sales.order.approve` |
| URL | Tiếng Việt không dấu, chữ thường, nối `-` | `/kinh-doanh/don-hang/tao-moi` |
| Tham số URL | Theo IA §9 | `?q= ?trang= ?sap-xep= ?tab=` |

- **Ngôn ngữ**: định danh trong code viết tiếng Anh. Chữ hiện cho người dùng, thông báo lỗi và URL viết tiếng Việt. Tên gọi trên giao diện theo đúng bảng IA §6.
- **Từ vựng code**: Đại lý `Dealer`, Khách hàng `Customer`, Đơn hàng `Order`, Phiếu `Ticket`, Hội thoại `Conversation`, Đơn từ `AttendanceRequest`, Chỉ tiêu `SalesTarget`, Đơn vị `OrgUnit`, Bộ phận `Department`, Vụ `Season`, Sản lượng `quantityKg`.
- **TypeScript**: `strict`, `noUncheckedIndexedAccess`. Không dùng `any`, không dùng `@ts-ignore`. Dùng `satisfies` cho dữ liệu mẫu.
- **Import**: không tạo barrel file `index.ts`. Import đúng file, ví dụ `@seedgw/contracts/orders`. Trong `apps/web` dùng alias `@/`.
- **Export**: dùng named export, trừ các file Next.js bắt buộc default.
- **Comment**: chỉ viết khi giải thích lý do không hiển nhiên, bằng tiếng Việt.
- **Dữ liệu**:
  - Tiền là số nguyên VND, tên trường có đuôi `Vnd`.
  - Khối lượng lưu theo kg, tên trường có đuôi `Kg`.
  - Thời điểm là chuỗi ISO 8601 UTC, hiển thị `dd/MM/yyyy` theo giờ Việt Nam.
  - Ô nhập ngày trên web dùng `Form.DateInput` hoặc `DataTable.DateFilter`, không dùng `type="date"` vì trình duyệt hiện theo ngôn ngữ máy.
  - Khoá chính là UUID. Đơn hàng và Phiếu có thêm mã nghiệp vụ `code`.

## 7. Hợp đồng dữ liệu và lỗi

Mẫu đầy đủ ở `docs/MAU_CODE.md`.

- Danh sách trả `{ items, total, page, pageSize }`, phân trang phía máy chủ, `pageSize` tối đa 100.
- Server Action trả kiểu `ActionResult<T>`:
  - Thành công: `{ ok: true, data, warnings? }`
  - Thất bại: `{ ok: false, code, message, fieldErrors? }`
- `code` thuộc `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `INTEGRATION`, `INTERNAL`. `message` là tiếng Việt, hiển thị được ngay.
- `warnings` dùng cho trường hợp vẫn cho làm tiếp, ví dụ vượt hạn mức công nợ, thiếu tồn kho. Đơn hàng vẫn được tạo.
- API `/api/v1` và `/api/mobile` trả lỗi JSON `{ code, message, details? }` với mã HTTP tương ứng.
- Không để lộ stack trace, câu lệnh SQL hay khoá bí mật trong phản hồi.

## 8. Bảo mật

- Mỗi query, Server Action và Route Handler kiểm đăng nhập và quyền ở đầu hàm, áp phạm vi dữ liệu `own`, `orgUnit`, `orgUnitTree`, `all` ngay trong truy vấn.
- Trang mới: thêm quy tắc vào `ROUTE_RULES` trong `@seedgw/contracts/access`, trang gọi `requirePermission` ở đầu. Server Action gọi `assertCan`. Query nghiệp vụ dùng `getScopedDb()`, model mới có dữ liệu theo người hoặc đơn vị phải khai báo trong `SCOPED_MODELS`.
- Validate mọi đầu vào bằng Zod ở máy chủ, kể cả dữ liệu từ form đã validate ở client.
- Ghi `AuditLog` cho mọi thao tác tạo, sửa, xoá, duyệt.
- Không commit `.env`, khoá API, mật khẩu, token. Biến mới phải thêm vào `.env.example` với giá trị giả.

## 9. React và hiệu năng

- Mặc định dùng Server Component. Chỉ thêm `'use client'` ở lá cây cần tương tác.
- Fetch song song bằng `Promise.all`, phần chậm bọc `<Suspense>` riêng.
- Chỉ truyền xuống Client Component những trường cần dùng.
- Bản đồ, biểu đồ, trình soạn thảo tải bằng `next/dynamic`.
- Việc không chặn phản hồi như ghi audit, đẩy job dùng `after()`.
- Component dùng chung viết dạng compound. Không dùng boolean prop để rẽ nhánh, tạo variant tường minh như `OrderFormCreate`, `OrderFormEdit`.
- State đặt trong Provider với giao diện `{ state, actions, meta }`.
- React 19: không `forwardRef`, dùng `use()` thay `useContext()`.

## 10. Nhận diện thương hiệu

Chi tiết ở `BRAND.md`. Các điểm không được vi phạm:

- **Màu**: chủ đạo `#005b36` và trắng. Chỉ dùng token, không viết mã màu trực tiếp trong component. Token ở `.design/seedgw/brand/tokens.css`. Chưa làm giao diện tối, chưa có màu riêng từng bộ phận.
- **Font**: mọi chữ dùng UTM Neo Sans Intel, chỉ weight 400 và 700. Đặt `font-synthesis: none`.
- **Ký tự font không có, cấm dùng trong chữ hiển thị**: ký hiệu đồng, gạch dài, chấm giữa, dấu đầu dòng, dấu nhân, mũi tên, nhỏ hơn hoặc bằng, lớn hơn hoặc bằng, dấu độ, ngoặc kép góc, dấu cách không ngắt. Không dùng dấu `|` vì nét bị lỗi. Cách thay ở `BRAND.md` §2.
- **Tiền**: dùng `formatVnd()`, ra dạng `48.750.000 đ`. Không dùng `Intl.NumberFormat` kiểu `currency`.
- **Gạch chân**: mặc định không có. Chỉ hiện khi di chuột hoặc focus vào phần bấm được.
- **Logo**: chỉ dùng `<Logo variant size />` với các cỡ `s` 120, `m` 160, `l` 200, `xl` 280 px. Logo có dòng "A MEMBER OF THE PAN GROUP". Không kéo giãn, xoay, đổ bóng, đổi màu, không xếp biểu tượng lên trên chữ, không gõ chữ thay logo. Giữ vùng an toàn bằng 1/18 chiều rộng logo.
- **Chân trang**: mọi trang web có `<AppFooter>` ghi bản quyền và liên hệ Phòng ĐMST&CĐS. App đặt ở cuối tab Tôi.

## 11. Git

- Nhánh: `<ma-task>-<mo-ta>`, ví dụ `f1-khung-du-an`.
- Commit: `<loai>(<ma-task>): <mo ta>`, `loai` thuộc `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. Ví dụ `feat(F2): them AppShell`.
- Mỗi commit chỉ chứa một thay đổi có ý nghĩa.
- Chỉ merge vào `main` khi `pnpm check` đạt. Không dùng `--force`, không bỏ qua hook.
- `main` là bản Test (máy chủ thử, app SeedGW Thử), `production` là bản người dùng (máy chủ thật, app SeedGW). Chỉ đưa `main` sang `production` bằng merge fast-forward sau khi đã thử xong, không sửa thẳng trên `production`. Trên máy, `SEEDGW\Test` là kho mã chính (nhánh `main`), `SEEDGW\Production` là git worktree nhánh `production`. Quy trình ở `docs/TEST_VA_PRODUCTION.md`.

## 12. Lệnh chuẩn

Chạy từ thư mục gốc.

| Lệnh | Tác dụng |
|---|---|
| `pnpm install` | Cài thư viện |
| `pnpm dev` | Chạy toàn bộ môi trường phát triển |
| `pnpm build` | Build tất cả |
| `pnpm format` | Định dạng code |
| `pnpm check` | Kiểm tra format, lint, type, test và ký tự cấm |
| `pnpm db:migrate` | Chạy migration |
| `pnpm db:seed` | Nạp dữ liệu mẫu |

## 13. Tiêu chí hoàn thành

Một task chỉ xong khi:

1. Đạt mọi tiêu chí "Xong khi" trong `TASKS.md`.
2. `pnpm check` đạt và đã chạy thử thực tế luồng chính.
3. Web dùng được ở 1440, 1024, 768, 375 px nếu là giao diện người dùng.
4. Không còn dữ liệu mẫu trong luồng đã nghiệm thu.
5. Báo lại đúng sự thật: đã làm gì, đã kiểm tra gì, chưa kiểm tra được gì.
