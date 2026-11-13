# Design Brief: DMS Vinaseed

Ngày: 2026-11-06 · Cập nhật v3: 2026-11-09
Trạng thái: v3 — đã chốt các quyết định ở §9, đã bổ sung Dashboard và kiến trúc thông tin. Chờ duyệt chiến lược mã khách hàng (§10) và trả lời §11.
Tài liệu đi kèm: [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md) (cấu trúc trang, điều hướng, tên gọi, định nghĩa chỉ số) · [TASKS.md](TASKS.md) (danh sách việc).

## 1. Mục tiêu

Xây một phần mềm nội bộ cho Vinaseed gồm web app + app điện thoại, phục vụ:

1. **Kinh doanh (DMS)**: tạo & quản lý đơn hàng, khách hàng, đại lý, check-in của CBNV. Đơn hàng phải đưa được sang **FAST** (phần mềm kế toán) qua API do hệ thống này cấp ra.
2. **Chăm sóc khách hàng (CSKH)**: tiếp nhận thông tin/phản hồi của KH và xử lý, kết nối với các kênh chat của Vinaseed (**Zalo OA**, **Mattermost**).
3. **Quản trị**: quản lý tài khoản CBNV, phân quyền, danh mục sản phẩm, đại lý, kho, bảng giá…

Trước khi vào app, người dùng luôn đi qua một **Hub** chia thành 3 bộ phận trên. Mỗi người chỉ thấy bộ phận mình được cấp quyền.

**Dashboard chỉ số và chỉ tiêu**: theo dõi số lượng hàng bán được, đại lý đặt mua, doanh thu, % hoàn thành chỉ tiêu… Có Dashboard riêng trong Kinh doanh và CSKH, và trang Tổng quan điều hành cho lãnh đạo (mở từ Hub, không phải bộ phận thứ 4). Chi tiết ở IA §3.

> Giả định: "3 bộ phận" = Kinh doanh · CSKH · Quản trị (gộp "quản lý tài khoản" và "quản lý danh mục" vào Quản trị). Nếu khác, chỉ cần đổi cấu hình Hub — kiến trúc không đổi.

## 2. Người dùng & vai trò

| Vai trò | Bộ phận | Việc chính |
|---|---|---|
| NV kinh doanh (thị trường) | Kinh doanh | Check-in tại đại lý, khách hàng hoặc điểm khác (mobile), tạo đơn, chăm sóc đại lý/KH theo tuyến |
| Quản lý vùng / ASM | Kinh doanh | Duyệt đơn, xem check-in & bản đồ NV, báo cáo vùng |
| Admin bán hàng / Sales Admin | Kinh doanh | Kiểm tra đơn, theo dõi đồng bộ FAST, xử lý lỗi đồng bộ |
| NV CSKH | CSKH | Trả lời tin nhắn Zalo, tạo/xử lý phiếu tiếp nhận |
| Trưởng nhóm CSKH | CSKH | Phân công, theo dõi SLA, báo cáo |
| Quản trị hệ thống | Toàn bộ | Mọi chức năng, gồm phân quyền, tạo vai trò, danh mục, API key FAST, tham số hệ thống |
| Quản trị đơn vị (người phụ trách App tại đơn vị) | Quản trị | Trong đơn vị của mình và cấp dưới: tạo tài khoản, sửa thông tin cá nhân, chức danh, đơn vị, quản lý trực tiếp, Trưởng đơn vị |
| Lãnh đạo | Tổng quan điều hành + Dashboard Kinh doanh, CSKH (chỉ xem) | Theo dõi chỉ số, chỉ tiêu, điểm cần chú ý |
| Hệ thống FAST | (máy) | Gọi API lấy đơn hàng, báo lại số chứng từ |

## 3. Kiến trúc thông tin

Toàn bộ sơ đồ trang, điều hướng, thứ tự nội dung, luồng người dùng, tên gọi và URL nằm ở **[INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md)**. Tóm tắt:

- Đăng nhập → **Hub** → một trong 3 bộ phận → menu trái tối đa 2 cấp → chi tiết dùng tab.
- **Kinh doanh** (11 trang): Dashboard, Cần duyệt · Đơn hàng, Tồn kho, Chỉ tiêu · Đại lý, Khách hàng · Tuyến viếng thăm, Check-in · Đồng bộ FAST, Báo cáo.
- **CSKH** (5 trang): Hộp thư, Phiếu tiếp nhận, Khách hàng, Mẫu trả lời, Dashboard.
- **Quản trị** (12 trang): Tài khoản, Vai trò và quyền, Cơ cấu tổ chức · Sản phẩm, Kho, Đại lý, Bảng giá · Quy trình duyệt, Lịch vụ, Tham số · Kết nối, Nhật ký.
- **App điện thoại** (5 tab): Hôm nay, Tuyến, Đơn hàng, Công, Tôi.

## 4. Công nghệ (Combo 4 — Web app sản phẩm React / Next.js)

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Chia sẻ type/schema giữa web, mobile, worker |
| Web | Next.js 15 (App Router) + React 19 + TypeScript | Server Components cho màn danh sách nặng dữ liệu, Server Actions cho form |
| UI | Tailwind CSS + shadcn/ui (Radix) | Tự sở hữu component, dễ dựng compound components |
| Bảng dữ liệu | TanStack Table (server-side paging/filter) | Danh sách đơn/đại lý lớn |
| Form | React Hook Form + Zod | Dùng chung schema Zod với API |
| Data fetching client | TanStack Query (inbox, realtime) | Dedup, cache, refetch |
| Biểu đồ | Recharts, tải bằng `next/dynamic` | Dashboard; không làm nặng các trang khác |
| DB | PostgreSQL 16 + Prisma | Quan hệ phức tạp, PostGIS tuỳ chọn cho geofence |
| Auth | Auth.js (Credentials + tuỳ chọn SSO/LDAP nội bộ), JWT cho mobile | Một tài khoản dùng cả web và mobile |
| Hàng đợi / job | BullMQ + Redis (app `worker` riêng) | Đồng bộ FAST, gửi Zalo, refresh token, thông báo Mattermost |
| Realtime | Server-Sent Events (inbox CSKH) | Đơn giản hơn WebSocket, đủ cho 1 chiều server→client |
| File | MinIO (S3-compatible) hoặc S3 | Ảnh check-in, file đính kèm chat |
| Mobile | Expo (React Native) + expo-location, expo-camera, expo-sqlite | Chung TypeScript & schema với web |
| API docs | OpenAPI 3 sinh từ Zod (zod-to-openapi) + trang Scalar/Swagger | Bàn giao cho đội FAST |
| Hạ tầng | Docker Compose trên **server nội bộ**, Nginx ở DMZ + domain công khai, HTTPS (Let's Encrypt/chứng chỉ công ty) | Webhook Zalo, FBO (cloud) và app mobile đều đi qua domain công khai. Cấu hình gợi ý cho 300–400 user: 8 vCPU, 16–32 GB RAM, SSD 1 TB (ảnh check-in), sao lưu ra máy/ổ khác. |
| Giám sát | Sentry + log JSON (pino) + uptime check | |

### Nguyên tắc code bắt buộc (từ vercel-react-best-practices & composition-patterns)

- **Không waterfall**: fetch song song bằng `Promise.all`, bọc phần chậm bằng `<Suspense>` để stream (`async-parallel`, `async-suspense-boundaries`).
- **Server Action phải tự kiểm quyền** như API route (`server-auth-actions`) — không tin vào việc ẩn nút trên UI.
- Chỉ truyền dữ liệu cần thiết xuống Client Component (`server-serialization`); `React.cache()` cho lấy user/quyền trong 1 request.
- Import trực tiếp, **không barrel file** (`bundle-barrel-imports`); bản đồ, biểu đồ, trình soạn thảo dùng `next/dynamic` (`bundle-dynamic-imports`).
- Việc không chặn phản hồi (ghi audit log, đẩy job) dùng `after()` (`server-after-nonblocking`).
- Ô tìm kiếm dùng `useDeferredValue`/`startTransition`; danh sách dài dùng `content-visibility` hoặc ảo hoá.
- Component dùng chung viết theo **compound components** (`<AppShell.Sidebar>`, `<DataTable.Toolbar>`, `<OrderForm.Lines>`), **không thêm boolean prop** để rẽ nhánh — tạo variant rõ ràng (`OrderFormCreate`, `OrderFormEdit`).
- State nằm trong Provider với interface `{ state, actions, meta }`; UI không biết state lưu ở đâu.
- React 19: không `forwardRef`, dùng `use()` thay `useContext()`.

## 5. Mô hình dữ liệu (thực thể chính)

- **Tổ chức & người**: `User`, `Role`, `Permission`, `UserRole`, `OrgUnit` (Công ty → Miền → Vùng → Khu vực), `Employee` (mã NV, chức danh, đơn vị, quản lý trực tiếp).
- **Danh mục** (mã theo FAST): `ProductCategory`, `Product` (**mã FAST = mã chính**, chỉ đọc; thuộc tính bổ sung của DMS: ảnh, mô tả kỹ thuật, nhóm hiển thị, quy cách bán), `Unit`, `UnitConversion`, `Warehouse` (mã FAST), `InventorySnapshot` (tồn theo kho × sản phẩm, thời điểm đồng bộ), `PriceList`, `PriceListItem`, `DiscountPolicy`.
- **Khách hàng**: `Dealer` (id UUID + **mã nghiệp vụ = mã FAST**, `legacyCode` mã DMS cũ, trạng thái đồng bộ FAST, cấp 1/cấp 2, MST, địa chỉ hành chính, toạ độ, NV phụ trách, hạn mức & công nợ từ FAST), `CodeSequence` (dải mã DMS được cấp), `Customer` (nông dân/HTX/hộ — chỉ mã DMS, SĐT, Zalo ID, diện tích, cây trồng), `Contact`.
- **Bán hàng**: `Route`, `VisitPlan`, `CheckIn` (chi tiết ở mục Check-in bên dưới), `Order` (cờ cảnh báo: vượt công nợ, thiếu tồn; phiên bản quy trình duyệt), `OrderLine`, `OrderStatusHistory`.
- **Quy trình duyệt**: `ApprovalWorkflow` (theo `OrgUnit`, có phiên bản, kế thừa từ đơn vị cha), `ApprovalStep` (thứ tự, người duyệt theo vai trò/chức danh/người cụ thể, điều kiện kích hoạt, SLA), `ApprovalInstance`, `ApprovalAction`, `Delegation` (uỷ quyền khi vắng).
- **Check-in**: `CheckIn` (nhân viên, đơn vị lúc check-in, loại điểm Đại lý / Khách hàng / Điểm khác, đại lý hoặc khách hàng hoặc tên điểm khác, toạ độ, sai số, giờ trên máy, giờ máy chủ nhận, địa chỉ, ghi chú, ảnh bắt buộc, `roadDistanceKm`, `gpsDistanceKm`, cờ nghi vấn, `clientId` chống trùng), `TrackPoint` (vết GPS 5 giây, chia bảng theo tháng), `TrackSession` (một ngày đi thị trường). DMS không quản lý ca và không tính công (§9 mục 19, 20, 21).
- **Tích hợp**: `ApiClient` (FAST, key hash, IP whitelist), `SyncOutbox` (sự kiện chờ đồng bộ, có thứ tự phụ thuộc: KH trước đơn), `SyncLog`, `IntegrationAccount` (Zalo OA token, Mattermost bot), `ZaloQuota` (hạn mức tin ngoài khung đã dùng/còn lại).
- **CSKH**: `Channel`, `Conversation`, `Message`, `Attachment`, `Ticket` (loại, mức ưu tiên, SLA, người xử lý, liên kết KH/đại lý/đơn), `TicketEvent`, `CannedReply`.
- **Số liệu và chỉ tiêu**: `FastSalesLine` (dòng hoá đơn bán và hàng trả lại từ FAST), `SalesDailyFact` (tổng hợp theo ngày × đại lý × sản phẩm × nhân viên × đơn vị tại thời điểm bán × nguồn Đặt hàng/Thực bán; sản lượng kg, doanh thu), `SalesTarget` (kỳ, đơn vị hoặc nhân viên, nhóm sản phẩm, sản lượng, doanh thu), `Season` (lịch vụ).
- **Hệ thống**: `AuditLog`, `Notification`, `SystemSetting`.

## 6. Kiến trúc tích hợp

**FAST Business Online** (hai chiều; FBO là cloud nên đi qua domain công khai):
- Luồng **FAST → DMS** (FAST làm gốc): sản phẩm, kho, tồn kho, KH/đại lý, công nợ & hạn mức, **hoá đơn bán và hàng trả lại** (cho chỉ số Thực bán). Đồng bộ định kỳ (danh mục: mỗi giờ + nút "Đồng bộ ngay"; tồn kho & công nợ: 15 phút; hoá đơn: 15–60 phút tuỳ giới hạn API) và tra cứu trực tiếp khi tạo đơn nếu FBO có API. Nếu FBO không cho lấy hoá đơn qua API: tạm nhập file Excel xuất từ FAST.
- Luồng **DMS → FAST**: KH mới tạo trên DMS (theo §10), đơn hàng đã duyệt. Hàng đợi có thứ tự: KH phải được FAST xác nhận trước khi đơn của KH đó được gửi.
- Khi đơn được duyệt → ghi `SyncOutbox` (transactional outbox, cùng transaction với đổi trạng thái).
- Chế độ **Pull** (khuyến nghị nếu FAST hỗ trợ): FAST gọi `GET /api/v1/orders?status=approved&since=…` → xử lý → `POST /api/v1/orders/{id}/ack` trả số chứng từ FAST / lỗi.
- Chế độ **Push** (nếu FAST có API nhận): worker gọi API FAST, retry luỹ tiến, idempotency key = mã đơn.
- API danh mục cho FAST đối chiếu: `/api/v1/products`, `/dealers`, `/customers` (đọc), và nhận ngược công nợ/tồn kho nếu cần (`PUT /api/v1/dealers/{code}/debt`).
- Bảo mật: API key riêng mỗi client, chữ ký HMAC-SHA256 + timestamp chống replay, IP whitelist, rate limit, log toàn bộ request.

**Zalo OA**: webhook `POST /api/webhooks/zalo` (xác thực chữ ký) → lưu `Message` → gán `Conversation`/`Ticket` → đẩy SSE tới inbox. Trả lời qua Zalo OA Open API bằng worker. Worker tự refresh access token trước khi hết hạn. Tuân thủ giới hạn khung thời gian/loại tin mà Zalo OA cho phép gửi.

**Mattermost**: bot account + REST API v4 để đăng thông báo (phiếu mới, phiếu quá SLA, lỗi đồng bộ FAST) vào kênh; outgoing webhook/slash command `/phieu` để tra cứu/nhận phiếu từ Mattermost.

**Mobile**: `POST /api/mobile/check-ins` (idempotent theo `clientId` UUID sinh trên máy) — app lưu SQLite trước, đồng bộ sau → **không mất check-in khi mất mạng**.

## 7. Yêu cầu phi chức năng

- Check-in: luôn được ghi nhận (offline-first), thời gian chuẩn lấy từ server khi đồng bộ, lưu cả giờ thiết bị để phát hiện chỉnh giờ.
- Bảo mật: HTTPS, mật khẩu bcrypt/argon2, khoá tài khoản sau N lần sai, phân quyền theo vai trò **và** phạm vi dữ liệu (NV chỉ thấy đại lý/đơn của tuyến mình, ASM thấy cả vùng).
- Audit log cho mọi thao tác tạo/sửa/xoá/duyệt.
- Hiệu năng: danh sách 10.000+ đại lý phân trang server < 1s; trang đầu LCP < 2.5s trên mạng 4G.
- Giao diện tiếng Việt, ngày dd/MM/yyyy, tiền VND, responsive (web dùng được trên tablet).
- Sao lưu DB hằng ngày, giữ 30 ngày.
- Dashboard đọc từ bảng tổng hợp, không tính trực tiếp từ dữ liệu gốc; mỗi khối số hiện thời điểm cập nhật; phạm vi dữ liệu áp ở phía máy chủ, kể cả khi xuất Excel.

## 8. Định hướng thẩm mỹ

Giao diện nghiệp vụ gọn, mật độ thông tin cao, chủ đạo xanh lá `#005b36` kết hợp trắng; toàn bộ chữ dùng UTM Neo Sans Intel; logo dùng đúng file vector và quy chuẩn Brand Guideline. Tạm thời chưa làm giao diện tối và chưa dùng màu riêng cho từng bộ phận; người dùng biết đang ở đâu nhờ tên bộ phận và đường dẫn trang. Chi tiết tại [BRAND.md](BRAND.md).

## 9. Quyết định đã chốt (2026-11-06)

| # | Chủ đề | Quyết định | Hệ quả thiết kế |
|---|---|---|---|
| 1 | FAST | **FAST Business Online (FBO)** — bản cloud | FBO nằm ngoài mạng nội bộ → mọi trao đổi đi qua domain công khai. Cần xác nhận với FAST: FBO có API nhận chứng từ/danh mục không, chi phí mở API, hay FBO gọi vào API của DMS. Thiết kế giữ cả 2 chế độ Push/Pull (xem §6). |
| 2a | Mã khách hàng | FAST làm gốc; KH tạo mới trên DMS phải đẩy sang FAST | Xem **§10 Chiến lược mã khách hàng** (đề xuất, chờ duyệt). |
| 2b | Mã vật tư | **FAST chuẩn 100%** | DMS **không tạo** sản phẩm; chỉ đồng bộ từ FAST, bổ sung thuộc tính riêng của DMS (ảnh, mô tả kỹ thuật, nhóm hiển thị, quy cách bán). |
| 2c | Mã kho | **FAST chuẩn** | Đồng bộ kho từ FAST; tồn kho lấy từ FAST để cảnh báo khi tạo đơn. |
| 3 | Zalo OA | Đã có OA, **gói Nâng cao** (99.000đ/tháng: tương tác cơ bản & nâng cao, 2.000 tin tư vấn ngoài khung, KH nhận 4 tin truyền thông/tháng, 5 tổng đài viên, 15 lượt xuất bản nội dung). Admin: **Khối Marketing & PTSP** | Admin OA (Marketing & PTSP) phải tạo app trên Zalo for Developers và cấp quyền cho DMS. Dự kiến trả lời **trong khung tương tác** không tốn hạn mức, **ngoài khung** trừ vào 2.000 tin (xác minh quy định ở task R2) → hộp thư phải hiện thời hạn khung và bộ đếm hạn mức. Gửi tin CSAT chỉ khi còn trong khung. Giới hạn 5 tổng đài viên áp cho giao diện OA Manager — cần xác nhận không áp cho tin gửi qua API. |
| 4 | Mattermost | **Tự host** | DMS gọi trực tiếp trong mạng nội bộ; cần admin Mattermost bật Bot Accounts + Integrations (slash command, outgoing webhook). |
| 5 | Hạ tầng | **Server nội bộ, có domain công khai** | Nginx reverse proxy ở vùng DMZ; chỉ mở ra Internet: web đăng nhập, `/api/mobile/*`, `/api/v1/*` (giới hạn IP của FBO nếu có), `/api/webhooks/zalo`. Xem task F7. |
| 6 | Người dùng | **300–400**, cần **Android và iOS** | Cần tài khoản Apple Developer đứng tên pháp nhân Vinaseed (cần số D-U-N-S); phát hành iOS dạng Unlisted App hoặc Custom App qua Apple Business Manager. Ảnh check-in ~90–180 GB/năm → lưu trữ & chính sách nén. |
| 7 | Chấm công (đổi ngày 11/11/2026, xem mục 20) | Check-in **thay máy chấm công** cho cán bộ kinh doanh; chưa có HRM | Bổ sung phân hệ **Chấm công**: ca làm việc, lịch nghỉ, giải trình/đơn từ, chốt công tháng, bảng công; chuẩn hoá dữ liệu & API/Excel xuất sang HRM sau này (task T1–T5). |
| 8 | Duyệt đơn | **Mỗi đơn vị một quy trình riêng, tự cấu hình**. Khi tạo đơn: **cảnh báo** tồn kho giống & hạn mức công nợ, **không chặn** | Trình cấu hình quy trình duyệt theo đơn vị (task A10). Đơn mang cờ "vượt công nợ"/"thiếu tồn" để người duyệt thấy; quy trình có thể thêm bước duyệt khi có cờ. |
| 9 | Điều hướng (2026-11-09) | **Luôn qua Hub**; menu tối đa 2 cấp | Ngoại lệ duy nhất: link từ thông báo tới thẳng đối tượng. Xem IA §0, §2. |
| 10 | Vị trí Dashboard (2026-11-09) | **Tổng quan điều hành mở từ Hub + Dashboard trong từng bộ phận** | Hub vẫn là 3 bộ phận. Phạm vi số liệu theo vai trò. Xem IA §3. |
| 11 | Số lượng hàng bán (2026-11-09) | **Hai chỉ số tách rõ: Đặt hàng (DMS) và Thực bán (FAST)** | Cần lấy thêm hoá đơn và hàng trả lại từ FBO (task R1, K2). |
| 12 | Chỉ tiêu kế hoạch (2026-11-09) | **Có giao chỉ tiêu**, nhập tay hoặc Excel | Thêm trang Chỉ tiêu và Lịch vụ (task K3). |
| 13 | Nhận diện (2026-11-09) | **Logo có câu "A MEMBER OF THE PAN GROUP", theo quy chuẩn Brand Guideline trang 11-13; toàn bộ chữ UTM Neo Sans Intel, đã được phép nhúng; gạch chân chỉ khi di chuột; chủ đạo `#005b36` và trắng** | Xem [BRAND.md](BRAND.md). Bỏ màu riêng từng bộ phận và giao diện tối trong giai đoạn này (task F2). |
| 14 | Cỡ logo và chân trang (2026-11-09) | **4 cỡ logo S, M, L, XL theo vị trí; cuối trang có bản quyền và liên hệ Phòng ĐMST&CĐS** | Xem [BRAND.md](BRAND.md) §1, §5 (task F2, M1). |
| 15 | Công cụ xây dựng (2026-11-09) | **Claude xây dựng toàn bộ Backend, Frontend và app** | Các lớp và định dạng code ở [AGENTS.md](../../AGENTS.md); cách khởi tạo ở [docs/KHOI_TAO.md](../../docs/KHOI_TAO.md). |
| 16 | Hai cấp quản trị (2026-11-10) | **Quản trị hệ thống toàn quyền; Quản trị đơn vị chỉ quản lý tài khoản và Trưởng đơn vị trong phạm vi của mình** | Chỉ Quản trị hệ thống sửa ma trận quyền, tạo và xoá vai trò, đăng nhập thay. Không ai sửa vai trò mình đang giữ. Quản trị đơn vị không gán được vai trò có phạm vi rộng hơn mình. |
| 17 | Một người duyệt hai bước liên tiếp (2026-11-11) | **Bước sau tự qua, chỉ khi hai bước nằm liền nhau trong chuỗi của đơn** | Bước không chạy hoặc tự duyệt theo ngưỡng thì bỏ qua khi xét liền nhau. Có người khác duyệt xen giữa thì phải duyệt lại. Chỉ người đã thực sự duyệt bước trước mới được tính, kể cả khi nhận uỷ quyền. Hệ thống ghi một lượt duyệt chuyển tiếp riêng để kiểm toán phân biệt với lượt duyệt thật (task A10, S4). |
| 18 | Trình cấu hình quy trình (2026-11-11) | **Dựng chuỗi bước bằng kéo thả** | Kéo khối loại người duyệt vào chuỗi để chèn bước, kéo tay nắm để đổi thứ tự. Vẫn có nút lên, xuống và phím mũi tên cho người không kéo được. Không thêm thư viện. |
| 19 | Ca làm việc (2026-11-11) | **Bỏ ca làm việc, gán ca và lịch nghỉ khỏi DMS** | CBKD đi nhiều địa điểm, giờ làm khác nhau. Nhân viên dùng dữ liệu check-in để tính công với kế toán đơn vị. Phân hệ Chấm công (T1 đến T5) cần xác định lại phạm vi. |
| 20 | Check-in và chấm công (2026-11-11) | **DMS chỉ ghi lại check-in và xuất báo cáo ghé thăm, không tính công** | Mỗi check-in ghi: điểm (đại lý, khách hàng hoặc điểm khác), thời gian, nội dung làm việc (không bắt buộc), km từ điểm check-in trước trong ngày. Nhân viên xem của mình, quản lý xem nhân viên mình quản lý, xuất Excel cho kế toán đơn vị tính công. Bỏ Vào ca, Ra ca, bảng công, đơn từ, chốt kỳ công, tích hợp HRM (task T1 đến T5). |
| 21 | Ảnh và km khi check-in (2026-11-11) | **Ảnh bắt buộc, chụp bằng máy ảnh trong app có in giờ và vị trí; km theo đường đi thực tế từ vết GPS 5 giây; check-in chỉ trên app, web chỉ có báo cáo** | App ghi vị trí và gửi theo lô, máy chủ khớp vết vào đường bằng máy chủ tìm đường tự dựng, địa chỉ lấy từ nhà cung cấp Việt Nam. Excel theo mẫu cự ly di chuyển, thêm cột Tên đại lý và Ghi chú. Chi tiết ở [CHECK_IN_PLAN.md](CHECK_IN_PLAN.md). |
| 22 | Thời gian lưu dữ liệu check-in (2026-11-12) | **Dòng check-in giữ 18 tháng, ảnh giữ 45 ngày** | Điểm GPS thô giữ 45 ngày cùng ảnh, km đã tính giữ theo dòng check-in. Job worker xoá dữ liệu quá hạn mỗi đêm. Chi tiết ở [CHECK_IN_PLAN.md](CHECK_IN_PLAN.md) §7. |
| 23 | Thư viện cho app check-in (2026-11-12) | **Duyệt `expo-camera`, `expo-location`, `expo-task-manager`, `expo-image-manipulator`, `react-native-view-shot`** | Người dùng giao làm R3 sau khi xem danh sách. Đều miễn phí, bản đúng với Expo SDK của dự án. Ghi vị trí chạy nền cần bản build riêng của app, không chạy được trong Expo Go. |
| 24 | Xuất Excel và địa chỉ trên app thử (2026-11-13) | **Duyệt thêm `expo-file-system`, `expo-sharing`. Bản thử R3 gắn tạm khoá Vietmap trong app** | App tự ghi file .xlsx (không thêm thư viện Excel) rồi mở bảng chia sẻ. Khoá Vietmap nằm trong biến EAS `EXPO_PUBLIC_VIETMAP_API_KEY` chỉ cho bản thử, cài trên vài máy; thử xong đổi khoá. Bản chính thức hỏi địa chỉ qua máy chủ (V3). |

## 10. Chiến lược mã khách hàng (đề xuất — chờ duyệt)

### Phạm vi
Mã FAST chỉ áp cho đối tượng **mua hàng và xuất hoá đơn** từ Vinaseed (đại lý cấp 1, đại lý cấp 2 mua trực tiếp, KH tổ chức). Nông dân/HTX chỉ phát sinh ở CSKH hoặc khảo sát thị trường **không cần mã FAST**, chỉ có mã DMS.

### So sánh 3 cách

| | A. Giữ 2 mã như hiện tại (mã DMS + mã FAST, bảng ánh xạ) | B. FAST sinh mã, DMS chờ mã trả về | **C. Một mã duy nhất: DMS cấp mã theo dải riêng, đẩy sang FAST làm mã FAST** |
|---|---|---|---|
| Số mã nghiệp vụ | 2 | 1 (sau khi FAST trả về) | 1 ngay từ lúc tạo |
| Tạo KH mới ngoài thị trường | Có mã DMS ngay; mã FAST thiếu đến khi kế toán tạo tay | KH ở trạng thái "chờ mã" — phụ thuộc FBO phản hồi | Có mã ngay khi yêu cầu tới máy chủ (mất mạng thì chờ có mạng); khách chỉ tồn tại bên FAST sau khi FBO xác nhận |
| Rủi ro sai lệch | **Cao**: ánh xạ sai/thiếu → đơn đẩy nhầm KH, công nợ lệch, báo cáo 2 bên không khớp | Thấp | Thấp — chỉ cần chống trùng dải mã |
| Phụ thuộc FBO | Thấp | **Cao** (FBO lỗi = không có mã) | Trung bình (đẩy sang FBO có thể chậm, nhưng mã đã có) |
| Yêu cầu với FAST | Không | FBO phải có API tạo KH **và trả mã** | FBO phải cho phép tạo KH **với mã truyền vào** (FAST thường cho nhập mã thủ công — cần xác nhận) |
| Tra cứu, đối soát | Phải nhớ 2 mã | 1 mã | 1 mã |

### Ảnh hưởng tới dữ liệu so với cách hiện tại
1. **Chuyển đổi dữ liệu cũ**: mỗi KH đang có 2 mã → lấy **mã FAST làm mã chính**, mã DMS cũ lưu vào trường `legacyCode` (vẫn tìm kiếm được, in trên lịch sử). Không mất dữ liệu.
2. **KH chỉ có trên DMS cũ, chưa có trên FAST** → danh sách riêng: kế toán quyết định tạo mới bên FAST (đẩy qua API với mã theo dải DMS) hay loại bỏ.
3. **KH có trên FAST nhưng không có trên DMS** → nhập vào DMS, gán NV phụ trách.
4. **KH trùng** (cùng MST/SĐT, khác mã) → gộp trước khi chuyển đổi; đơn hàng lịch sử trỏ về KH sau gộp.
5. **Đơn hàng lịch sử** tham chiếu mã DMS cũ → ánh xạ qua `legacyCode`, báo cáo so sánh cùng kỳ vẫn đúng.
6. **Thói quen người dùng**: NV kinh doanh quen mã DMS cũ → ô tìm kiếm nhận cả 2 mã trong 6–12 tháng đầu.

### Khuyến nghị: **Cách C**
- Mỗi KH có 1 **khoá kỹ thuật** (UUID, không hiển thị, không bao giờ đổi) + 1 **mã nghiệp vụ = mã FAST**.
- Thống nhất với kế toán **dải mã riêng** cho KH tạo từ DMS, theo đúng định dạng/độ dài mã FAST (vd `DL` + số tăng 5 chữ số). Không gắn mã vùng vào mã, vì đại lý có thể chuyển vùng trong khi mã không đổi. Dải chỉ áp cho khách tạo mới sau go-live.
- Chống trùng: kế toán không dùng tiền tố của DMS và số tự tăng của FAST (nếu bật) không chạm dải này. DMS vẫn kiểm tra mã trên FBO trước khi gửi; nếu trùng thì báo lỗi để xử lý tay, không ghi đè.
- KH mới tạo trên DMS → (tuỳ cấu hình) Sales Admin duyệt thông tin pháp lý (tên, MST, địa chỉ xuất HĐ) → đẩy sang FBO bằng cùng mã. Trạng thái: `Nháp → Chờ duyệt → Đã gửi FAST → Đã xác nhận` / `Lỗi`.
- Đơn của KH mới **tạo và duyệt được ngay**, nhưng hàng đợi đồng bộ đảm bảo **KH sang FAST trước, đơn sang sau**.
- **Phân chia quyền làm gốc theo trường**: FAST làm gốc tên pháp lý, MST, địa chỉ xuất hoá đơn, công nợ, hạn mức; DMS làm gốc toạ độ, NV phụ trách, tuyến, ảnh, người liên hệ, phân loại đại lý. Sửa trường thuộc FAST trên DMS → gửi yêu cầu cập nhật sang FAST, không ghi đè cục bộ.
- Lý do chọn: chỉ một mã nên hết lỗi ánh xạ, NV thị trường vẫn có mã khi FBO chậm, kế toán không phải tạo tay, đối soát 1–1.
- **Phương án dự phòng**: nếu FBO **không** cho tạo KH với mã truyền vào → dùng cách B, đơn của KH mới chờ đến khi có mã FAST.

## 11. Câu hỏi còn mở

1. FBO: có API tích hợp không (nhận đơn bán/chứng từ, tạo KH với mã truyền vào, trả tồn kho, công nợ, **hoá đơn bán và hàng trả lại**)? Chi phí mở API? Đầu mối kỹ thuật FAST?
2. Định dạng mã KH hiện tại trên FAST (tiền tố, độ dài) để chốt dải mã cho DMS.
3. Tồn kho cảnh báo theo kho nào: kho của chi nhánh phụ trách vùng hay tổng các kho?
4. Check-in: đã chốt 11/11/2026 (§9 mục 21). Còn mở ở [CHECK_IN_PLAN.md](CHECK_IN_PLAN.md) §9: nhà cung cấp địa chỉ, máy chủ tìm đường, giờ tự dừng ghi hành trình.
5. Mattermost: phiên bản và URL nội bộ; có cho DMS tạo bot account không.
6. Khách mới có bắt buộc qua Sales Admin duyệt trước khi sang FAST không? (Khuyến nghị: bật.)
7. Dashboard: danh sách vụ và thời gian từng vụ; số ngày N để coi là "đại lý không đặt hàng"; ai được giao chỉ tiêu; số liệu lịch sử cần nạp từ bao nhiêu năm để so cùng kỳ.
8. ~~Ảnh check-in lưu bao lâu?~~ Đã chốt 12/11/2026: ảnh 45 ngày, dòng check-in 18 tháng (§9 mục 22).
