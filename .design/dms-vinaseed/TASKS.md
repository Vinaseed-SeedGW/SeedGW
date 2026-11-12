# Build Tasks: DMS Vinaseed (Hub + Kinh doanh + CSKH + Quản trị + App check-in)

Generated from: .design/dms-vinaseed/DESIGN_BRIEF.md (v3) và INFORMATION_ARCHITECTURE.md
Date: 2026-11-06 · Cập nhật v3 (2026-11-09): bổ sung Dashboard, chỉ tiêu và số liệu Thực bán (nhóm K); đồng bộ đường dẫn và tên gọi theo IA; bổ sung việc còn thiếu trên app; cập nhật lịch
Stack: Combo 4 — Next.js 15 / React 19 / TypeScript · Expo (mobile) · PostgreSQL + Prisma · BullMQ worker

**Cách đọc**
- Mỗi task là một *vertical slice*: làm xong là chạy được, nhìn thấy được, kiểm tra được (gồm DB + API + UI + quyền).
- Mã task (`F1`, `S3`…) dùng để tham chiếu phụ thuộc.
- Cỡ: **S** ≤ 1 ngày · **M** 2–3 ngày · **L** 4–5 ngày (1 dev full-stack).
- Codebase hiện trống → mọi component đều *New*; cột "Dùng lại" chỉ các phần do task trước tạo ra.
- Thứ tự: nền móng → **3 spike rủi ro cao làm sớm** → Quản trị (danh mục là dữ liệu gốc) → Kinh doanh + Mobile + Báo cáo ghé thăm → CSKH → Dashboard & chỉ tiêu → hoàn thiện & go-live.
- Đường dẫn và tên gọi trên giao diện theo INFORMATION_ARCHITECTURE.md.

---

## Giai đoạn 0 — Nền móng & Hub (tuần 1–3)

- [x] **F1. Đăng nhập → Hub 3 bộ phận chạy end-to-end**: Người dùng đăng nhập bằng tài khoản seed, vào `/hub` thấy 3 ô *Kinh doanh · CSKH · Quản trị*, bấm vào mỗi ô tới trang trống có layout riêng. _New. Cỡ L._
  - Dựng monorepo trong chính slice này: `apps/web` (Next.js App Router), `apps/worker`, `apps/mobile` (Expo, chưa có màn), `packages/db` (Prisma), `packages/contracts` (Zod), `packages/ui`, `packages/config` (eslint, tsconfig, thông tin chân trang). Quy ước và phân công xem `AGENTS.md`, `docs/KHOI_TAO.md`.
  - Docker Compose dev: Postgres 16, Redis, MinIO, Mailpit.
  - Prisma schema tối thiểu: `User`, `Role`, `Permission`, `UserRole`, `OrgUnit`; seed 1 admin + 3 user mẫu (mỗi bộ phận 1 người).
  - Auth.js Credentials, mật khẩu argon2, session JWT httpOnly; `middleware.ts` chuyển hướng chưa đăng nhập về `/login`.
  - Route groups: `app/(auth)/login`, `app/hub`, `app/kinh-doanh/layout.tsx`, `app/cskh/layout.tsx`, `app/quan-tri/layout.tsx`.
  - **Xong khi**: đăng nhập sai báo lỗi tiếng Việt; đúng thì vào Hub; F5 vẫn giữ phiên; đăng xuất về `/login`; `pnpm dev` một lệnh chạy được toàn bộ.

- [x] **F2. Nhận diện thương hiệu, design tokens + AppShell compound component (thiết lập hướng thẩm mỹ)**: Hub và 3 layout bộ phận dùng chung `<AppShell>`, tuân thủ `BRAND.md`. _New. Phụ thuộc: F1. Cỡ M._
  - Tokens CSS variables 3 lớp (primitive → semantic → component) đúng bảng ở `BRAND.md` §3: xanh `#005b36` và trắng là chủ đạo; thang spacing 4px, type ramp, radius, shadow. Tạm chưa làm giao diện tối và chưa có màu riêng từng bộ phận, nhưng component chỉ dùng token semantic để sau này thêm được.
  - `<AppFooter variant="full|compact">` ở cuối mọi trang web: bản quyền và liên hệ Phòng ĐMST&CĐS theo `BRAND.md` §5.
  - `packages/ui`: component `<Logo variant size>` với 4 cỡ S, M, L, XL, dùng SVG có câu "A MEMBER OF THE PAN GROUP" trong `.design/dms-vinaseed/brand/logo/`; 4 file font UTM Neo Sans Intel chuyển WOFF2, khai báo `@font-face` kèm chỉnh vị trí chữ, `font-synthesis: none`; ánh xạ `font-medium` thành 400, `font-semibold` thành 700.
  - Gạch chân: mặc định không có, chỉ hiện khi di chuột hoặc focus vào phần bấm được.
  - `packages/contracts`: hàm `formatVnd()` ra dạng `48.750.000 đ`; lint chặn ký tự font không có (`BRAND.md` §2).
  - `<AppShell>` dạng compound: `AppShell.Sidebar`, `AppShell.Header`, `AppShell.Breadcrumb`, `AppShell.Content`, `AppShell.DeptSwitcher` (quay lại Hub / chuyển bộ phận). Không dùng boolean prop kiểu `isAdmin` — mỗi bộ phận tự truyền `children` menu.
  - Hub: lời chào, 3 ô bộ phận (icon, mô tả, số việc chờ xử lý — tạm để 0), lối vào Tổng quan điều hành (ẩn nếu không có quyền), ô "Thông báo gần đây".
  - Menu trái theo IA §1: nhóm là nhãn cố định, tối đa 2 cấp; bấm ô bộ phận tới trang đích theo vai trò (IA §2).
  - **Xong khi**: Hub đẹp ở 1440px, 1024px, 768px, 375px; logo đúng bản, kích thước và vùng an toàn theo `BRAND.md` §1, sidebar thu gọn chỉ còn biểu tượng; toàn bộ chữ tải đúng 4 kiểu UTM Neo Sans Intel, không có font thay thế; sidebar thu gọn được và nhớ trạng thái (localStorage có version).

- [x] **F3. Phân quyền RBAC + phạm vi dữ liệu, Hub chỉ hiện bộ phận được phép**: _Dùng lại: F1, F2. New: `can()` helper, `<Can>` component. Cỡ L._
  - Quyền dạng `module.resource.action` (vd `sales.order.approve`, `cs.ticket.assign`, `admin.user.manage`); vai trò gán nhiều quyền; user nhiều vai trò.
  - Phạm vi dữ liệu (data scope): `own` / `orgUnit` / `orgUnitTree` / `all` — gắn vào vai trò, áp ở tầng query (Prisma extension) chứ không chỉ ở UI.
  - `getCurrentUser()` bọc `React.cache()` để mỗi request chỉ tra quyền 1 lần.
  - Mọi Server Action & Route Handler gọi `assertCan(...)` ở dòng đầu (`server-auth-actions`).
  - Chặn truy cập trực tiếp theo **từng trang và từng thao tác**, không chỉ theo bộ phận → trang `/403` tiếng Việt. Cần vì đại lý và khách hàng có nhiều lối vào (IA §1).
  - **Xong khi**: user CSKH chỉ thấy 1 ô trên Hub; gõ thẳng `/quan-tri` bị 403; test tự động cho ma trận vai trò × route.

- [x] **F4. DataTable compound component — dùng thử trên danh sách tài khoản**: _Dùng lại: F2, F3. New. Cỡ L._
  - `DataTable.Root / Toolbar / Search / Filters / Columns / Body / Pagination / BulkActions / Export`.
  - Phân trang, sắp xếp, lọc **phía server** qua `searchParams` (URL chia sẻ được), Server Component render trang đầu, ô tìm kiếm debounce + `useDeferredValue`.
  - Trạng thái: loading (skeleton qua Suspense), rỗng, lỗi, không có quyền.
  - Xuất Excel (exceljs chạy ở máy chủ, không nằm trong bundle trình duyệt) theo bộ lọc hiện tại và phạm vi dữ liệu.
  - **Xong khi**: danh sách 10.000 user giả lập trả trang < 1s; URL `?q=…&trang=3` mở lại đúng trạng thái.

- [x] **F5. Form pattern + Audit log + Thông báo toast**: chuẩn hoá form tạo/sửa dùng chung cho mọi danh mục. _New. Phụ thuộc: F3. Cỡ M._
  - `FormSheet` (drawer bên phải) + `FormPage` (trang riêng) — hai variant tường minh thay vì `isDrawer`.
  - React Hook Form + Zod schema lấy từ `packages/contracts` (dùng chung với API và mobile).
  - `AuditLog` ghi trong `after()` sau mỗi Server Action: ai, lúc nào, thực thể, trước/sau (JSON diff), IP.
  - **Xong khi**: sửa 1 bản ghi bất kỳ → thấy dòng log có diff; lỗi validate hiện đúng dưới từng ô.

- [ ] **F6. Môi trường staging + CI/CD**: _New. Cỡ M._
  - GitHub Actions/GitLab CI: lint, typecheck, test, build image Docker; deploy staging tự động khi merge `main`.
  - Staging có domain HTTPS công khai (bắt buộc cho webhook Zalo ở R2).
  - Sentry cho web + worker; healthcheck `/api/health`; backup Postgres hằng đêm.
  - **Xong khi**: merge 1 PR → 10 phút sau staging cập nhật; lỗi cố ý xuất hiện trên Sentry.

- [ ] **F7. Hạ tầng server nội bộ + domain công khai**: chuẩn bị máy chủ staging & production tại Vinaseed. _New. Cỡ M. Làm cùng IT Vinaseed._
  - Cấu hình gợi ý (300–400 user): 8 vCPU, 16–32 GB RAM, SSD 1 TB; tách volume ảnh check-in (MinIO) khỏi DB.
  - Nginx ở DMZ, TLS; chỉ mở ra Internet: trang web, `/api/mobile/*`, `/api/v1/*` (giới hạn IP của FBO nếu FAST cung cấp), `/api/webhooks/zalo`. Mattermost & DB chỉ trong mạng nội bộ.
  - Rate limit, chặn dò mật khẩu (fail2ban), giám sát dung lượng đĩa.
  - Sao lưu: Postgres hằng đêm + WAL, MinIO đồng bộ sang ổ/máy khác; diễn tập khôi phục 1 lần trước go-live.
  - **Xong khi**: từ mạng 4G gọi được `https://<domain>/api/health`; Zalo gửi webhook thử thành công; khôi phục DB từ bản sao lưu trên máy trắng < 1 giờ.

---

## Giai đoạn 0b — Spike rủi ro cao (song song với F2–F7, tuần 2–5)

- [ ] **R1. Spike tích hợp FAST Business Online — chốt hợp đồng API**: _New. Cỡ L (tăng do 2 chiều)._
  - Họp đội FAST, xác nhận khả năng của **FBO**: (a) API nhận đơn bán/chứng từ; (b) API **tạo KH với mã truyền vào** — quyết định cách C hay B ở brief §10; (c) API đọc sản phẩm, kho, **tồn kho**, **công nợ & hạn mức**; (d) FBO có gọi được webhook/API của DMS không; (e) chi phí mở API, giới hạn số lần gọi, môi trường test; (f) API đọc **hoá đơn bán và hàng trả lại** cho chỉ số Thực bán (K2).
  - Chốt chế độ cho từng luồng: Push (DMS gọi FBO) hay Pull (FBO gọi DMS).
  - Danh sách trường bắt buộc của chứng từ bán hàng (mã KH, mã vật tư, mã kho, ĐVT, đơn giá, CK, VAT, ngày chứng từ, mã NV bán).
  - Lấy định dạng mã KH hiện tại trên FAST → chốt **dải mã cho DMS** với kế toán (vd `DL{5 số}`, không gắn mã vùng), ghi biên bản.
  - Xuất mẫu dữ liệu KH hiện tại (cả mã DMS cũ và mã FAST) để đánh giá trùng lặp, thiếu ánh xạ trước G1.
  - Viết OpenAPI draft + endpoint mock trên staging (hoặc client gọi sandbox FBO nếu là Push).
  - **Xong khi**: tạo thử 1 KH (với mã dải DMS) và 1 đơn trên môi trường test FBO thành công; đọc được tồn kho & công nợ của 1 đại lý; đọc được hoá đơn và hàng trả lại của 1 ngày (hoặc đã chốt phương án nhập Excel); có biên bản xác nhận của FAST và kế toán.

- [ ] **R2. Spike Zalo OA — nhận & gửi 1 tin nhắn**: _New. Phụ thuộc: F6 (HTTPS). Cỡ M._
  - **Phối hợp Khối Marketing & PTSP (admin OA)**: admin đăng nhập Zalo for Developers, tạo app, liên kết OA Vinaseed, cấp quyền cho app; bàn giao App ID/Secret cho IT qua kênh bảo mật. Thống nhất: tin truyền thông (4 tin/KH/tháng) vẫn do Marketing gửi trên OA Manager, DMS chỉ dùng tin tư vấn.
  - Cấu hình webhook `https://<domain>/api/webhooks/zalo` (staging dùng domain con).
  - Xác minh với gói **Nâng cao**: thời hạn khung tương tác miễn phí; cách tính 2.000 tin tư vấn ngoài khung (theo tháng hay cả gói); giới hạn 5 tổng đài viên có áp cho tin gửi qua API không; API có trả về số hạn mức còn lại không.
  - Xác thực chữ ký webhook; lưu raw event vào bảng tạm; gửi lại tin trả lời qua OA API.
  - Lưu access/refresh token mã hoá trong `IntegrationAccount`; job refresh token chạy định kỳ.
  - Ghi lại các giới hạn gửi tin của OA (khung thời gian sau tương tác, loại tin, hạn mức) để thiết kế C4.
  - **Xong khi**: nhắn vào OA từ điện thoại → thấy bản ghi trong DB < 3s; gọi lệnh gửi → điện thoại nhận được.

- [ ] **R3. Spike app check-in — máy ảnh có dấu vị trí, ghi hành trình chạy nền, pin**: _New. Cỡ L (tăng 11/11/2026)._
  - Expo dev build trên 1 máy Android + 1 iPhone (**bắt buộc cả iOS**). Đồng thời khởi động thủ tục **tài khoản Apple Developer đứng tên Vinaseed** (cần số D-U-N-S, mất 1–3 tuần) và tài khoản Google Play Console.
  - Máy ảnh trong app có dải giờ, toạ độ trên khung ngắm và in lên ảnh (`expo-camera` + `react-native-view-shot`); không cho chọn ảnh có sẵn.
  - Ghi vị trí chạy nền 5 giây một lần trong 8 giờ (`expo-location` + `expo-task-manager`), màn hình tắt, app ở nền; đọc cờ mock location trên Android.
  - Thử lưu SQLite khi tắt mạng rồi gửi lại khi có mạng.
  - **Xong khi**: báo cáo ngắn: độ chính xác GPS trong nhà và ngoài trời, mức hao pin sau 8 giờ, vết có bị đứt khi app ở nền không, ảnh có đọc rõ dải thông tin ngoài nắng không, mock location có bị phát hiện không, nội dung giải trình quyền vị trí cho Apple và Google.

- [ ] **R4. Spike máy chủ tìm đường và địa chỉ** (CHECK_IN_PLAN §3): dựng OSRM hoặc Valhalla với bản đồ OpenStreetMap Việt Nam bằng Docker, thử API khớp vết (`match`) và đường ngắn nhất (`route`); đo RAM, ổ đĩa, thời gian xử lý. Thử reverse geocoding của Vietmap và Goong trên 50 toạ độ check-in thật để chọn bên. Chỉ dùng nguồn miễn phí (CHECK_IN_PLAN §3.7): OSRM chạy trên máy phát triển, 60.000 lượt miễn phí của Vietmap, 100 USD tặng của Goong. _Dùng lại: R3 (vết thật). Cỡ M. Làm cùng IT Vinaseed (F7)._
  - **Xong khi**: trên 3 tuyến thật đi bằng xe máy (có đường làng), km tính ra lệch với đồng hồ xe không quá 5%; có số cấu hình máy chủ cần xin; chốt được nhà cung cấp địa chỉ. Lệch quá 5% thì hỏi giá API khớp đường của Vietmap.

---

## Giai đoạn 1 — Quản trị: tài khoản & danh mục gốc (tuần 4–8)

> Làm trước Kinh doanh vì đơn hàng, check-in và CSKH đều tham chiếu danh mục này.

- [x] **A1. Cơ cấu tổ chức (Công ty → Miền → Vùng → Khu vực)**: cây đơn vị kéo-thả, gán trưởng đơn vị. _Dùng lại: F4, F5. New: `TreeView` compound. Cỡ M._
  - **Xong khi**: tạo/sửa/di chuyển nút; không xoá được nút còn nhân viên; phạm vi dữ liệu `orgUnitTree` của F3 dùng cây này.

- [x] **A2. Quản lý tài khoản CBNV**: danh sách, tạo, sửa, khoá/mở khoá, đặt lại mật khẩu, gán đơn vị, chức danh, quản lý trực tiếp, vai trò. _Dùng lại: F4, F5, A1. Cỡ L._
  - Hồ sơ NV: mã NV, họ tên, SĐT, email, đơn vị, chức danh, ngày vào làm, thiết bị mobile đã đăng ký.
  - Bắt đổi mật khẩu lần đầu; chính sách mật khẩu; tạm khoá 5 phút sau 10 lần sai trong 15 phút.
  - Import Excel danh sách NV (mẫu tải về, báo lỗi từng dòng, xem trước trước khi ghi).
  - "Đăng nhập thay" (impersonate) cho admin để hỗ trợ — có ghi audit.
  - Thu hồi phiên & thiết bị mobile khi khoá tài khoản.
  - **Xong khi**: import 200 NV từ Excel; NV mới đăng nhập được cả web và (sau M1) mobile; khoá tài khoản → mobile bị đăng xuất ở lần gọi API tiếp theo.
  - Phần mobile kiểm tra ở M1: API mobile phải đối chiếu `sessionVersion` và trạng thái `MobileDevice` mỗi lần gọi, đăng nhập dùng lại `checkCredentials`.

- [x] **A3. Vai trò & ma trận quyền (UI)**: màn hình bảng vai trò × quyền dạng checkbox nhóm theo bộ phận, chọn phạm vi dữ liệu. _Dùng lại: F3. Cỡ M._
  - Vai trò mặc định: Quản trị hệ thống, Quản trị đơn vị, NV kinh doanh, ASM, Sales Admin, NV CSKH, Trưởng nhóm CSKH, Lãnh đạo (chỉ xem).
  - Chỉ Quản trị hệ thống được sửa ma trận, tạo và xoá vai trò. Quản trị đơn vị chỉ thao tác trong đơn vị của mình và cấp dưới: tài khoản, chức danh, đơn vị, quản lý trực tiếp, Trưởng đơn vị.
  - **Xong khi**: bỏ quyền `sales.order.approve` của ASM → nút Duyệt biến mất và gọi API trực tiếp bị 403. Nút Duyệt thuộc S4 nên kiểm tra đúng tiêu chí này ở S4; A3 đã kiểm tra cơ chế bằng quyền `admin.user.manage` (mất nút, trang 403, gọi Server Action trực tiếp bị `FORBIDDEN`).

- [ ] **A4. Danh mục sản phẩm — đồng bộ từ FAST (FAST chuẩn 100%)**: DMS **không có nút tạo sản phẩm**. Worker đồng bộ vật tư từ FBO (mỗi giờ + nút "Đồng bộ ngay"): mã, tên, ĐVT, VAT, trạng thái. Các trường từ FAST hiển thị khoá (chỉ đọc). DMS chỉ bổ sung: nhóm hiển thị (lúa, ngô, rau màu…), ảnh, mô tả kỹ thuật, quy cách bán (bao 1kg/5kg/25kg), cờ "cho phép bán trên DMS". _Dùng lại: F4, F5, R1. Cỡ L._
  - Sản phẩm mới trên FAST → vào DMS ở trạng thái "Chưa bán" chờ Sales Admin bổ sung thông tin và bật bán.
  - Sản phẩm bị ngừng/xoá trên FAST → DMS ngừng bán, không xoá dữ liệu lịch sử.
  - Nhật ký đồng bộ: số bản ghi thêm/sửa/ngừng, lỗi từng dòng.
  - **Xong khi**: sửa tên vật tư trên FBO → sau lần đồng bộ DMS đổi theo; người dùng DMS không sửa được mã/tên/ĐVT; tìm theo mã/tên không dấu.

- [ ] **A5. Kho, đơn vị tính & tồn kho — đồng bộ từ FAST**: kho (mã FAST, chi nhánh, vùng phục vụ), ĐVT & quy đổi (bao ↔ kg) lấy từ FAST. Đồng bộ **tồn kho** theo kho × sản phẩm mỗi 15 phút vào `InventorySnapshot` (+ gọi trực tiếp FBO khi tạo đơn nếu R1 xác nhận có API). Cấu hình "kho phục vụ" cho từng vùng/đơn vị để biết cảnh báo tồn theo kho nào. _Dùng lại: F4, R1. Cỡ M._
  - Trang `/quan-tri/kho` quản lý kho; trang `/kinh-doanh/ton-kho` để nhân viên xem tồn.
  - **Xong khi**: trang Tồn kho hiển thị thời điểm đồng bộ gần nhất; lệch so với FBO không quá 1 chu kỳ đồng bộ.

- [ ] **A6. Bảng giá & chính sách chiết khấu**: bảng giá theo vùng/kênh/thời gian hiệu lực; chiết khấu theo % hoặc số tiền, theo sản phẩm/nhóm/đại lý, theo bậc số lượng. _Dùng lại: F4, F5, A4. Cỡ L._
  - Hàm thuần `resolvePrice(product, dealer, qty, date)` trong `packages/contracts` dùng chung web & mobile, có unit test đủ ca.
  - **Xong khi**: 2 bảng giá chồng thời gian bị chặn; xem trước giá cho 1 đại lý cụ thể ra đúng số.

- [ ] **A7. Danh mục đại lý / khách hàng mua hàng — một mã duy nhất = mã FAST** (theo brief §10, cách C): đại lý cấp 1/cấp 2 (cấp 2 thuộc cấp 1), **mã nghiệp vụ = mã FAST**, `legacyCode` (mã DMS cũ), MST, địa chỉ theo đơn vị hành chính, **toạ độ** (chọn trên bản đồ), NV phụ trách, tuyến, người liên hệ, trạng thái; công nợ & hạn mức **đọc từ FAST**. _Dùng lại: F4, F5, A1. New: `MapPicker` (Leaflet + OSM, `next/dynamic`). Cỡ L._
  - **Một hồ sơ, hai lối vào** (IA §1): `/kinh-doanh/dai-ly/[id]` và `/quan-tri/dai-ly/[id]` dùng chung `DealerProfile`. Quản trị có thêm gộp trùng, gán nhân viên hàng loạt, nhập Excel, tab Đồng bộ FAST.
  - Phân quyền theo trường: trường thuộc FAST (tên pháp lý, MST, địa chỉ xuất HĐ, công nợ, hạn mức) hiển thị khoá; sửa → tạo "yêu cầu cập nhật sang FAST" (S10). Trường thuộc DMS (toạ độ, NV phụ trách, tuyến, ảnh, liên hệ, phân loại) sửa trực tiếp.
  - Đồng bộ KH từ FBO về DMS (mỗi giờ); KH kế toán tạo trên FAST tự vào DMS, chờ gán NV phụ trách.
  - Ô tìm kiếm nhận cả mã FAST, `legacyCode`, tên không dấu, SĐT, MST.
  - Phát hiện trùng theo MST/SĐT khi tạo mới; gộp đại lý trùng (có audit).
  - **Xong khi**: NV kinh doanh chỉ thấy đại lý được phân cho mình (phạm vi `own`); tìm theo mã DMS cũ ra đúng đại lý; bản đồ không làm tăng bundle trang danh sách.

- [ ] **A8. Kết nối & API key**: màn `/quan-tri/ket-noi` quản lý `ApiClient` cho FAST (tạo key — chỉ hiện 1 lần, lưu hash; secret HMAC; IP whitelist; quyền đọc/ghi từng endpoint; thu hồi), cấu hình Zalo OA (trạng thái token, nút kết nối lại), Mattermost (URL, bot token, kênh nhận thông báo). _Dùng lại: F5, R1, R2. Cỡ M._
  - **Xong khi**: thu hồi key → FAST gọi bị 401 ngay; xem được 100 request gần nhất của mỗi client.

- [x] **A9. Tham số hệ thống & nhật ký**: bán kính check-in hợp lệ (m), SLA CSKH theo mức ưu tiên, ngưỡng cảnh báo công nợ (%), chu kỳ đồng bộ FAST, dải mã KH của DMS (`CodeSequence`), số ngày N để coi là "đại lý không đặt hàng"; màn xem `AuditLog` có lọc theo người/thực thể/thời gian. _Dùng lại: F4, F5. Cỡ M._

- [x] **A10. Trình cấu hình quy trình duyệt đơn theo đơn vị (`/quan-tri/quy-trinh-duyet`)**: mỗi đơn vị (A1) có quy trình riêng; đơn vị con **kế thừa** quy trình đơn vị cha nếu không tự cấu hình. _Dùng lại: A1, A3, F5. New: `WorkflowEditor` compound (`WorkflowEditor.Steps / StepDetail / Condition / Preview`). Cỡ L — task rủi ro, làm sớm trong giai đoạn 1._
  - Mỗi bước: tên bước, **người duyệt** theo (a) vai trò trong đơn vị của người tạo đơn (vd "ASM của vùng"), (b) chức danh ở đơn vị cấp trên (vd "Giám đốc miền"), (c) người cụ thể; kiểu duyệt: 1 người bất kỳ / tất cả; SLA giờ + leo thang khi quá hạn.
  - **Điều kiện kích hoạt bước** (bước chỉ chạy khi đúng): tổng tiền > X; chiết khấu > Y%; **đơn có cờ vượt hạn mức công nợ**; **đơn có cờ thiếu tồn kho**; nhóm sản phẩm; loại đại lý. Ví dụ: đơn < 50 triệu, không cờ → chỉ ASM duyệt; có cờ vượt công nợ → thêm bước Kế toán công nợ.
  - Tự duyệt (bỏ qua bước) khi người tạo chính là người duyệt bước đó, hoặc khi đơn dưới ngưỡng cấu hình.
  - **Một người duyệt hai bước liên tiếp** (bổ sung 11/11/2026): người đã duyệt bước trước không phải duyệt lại bước liền sau, bước đó tự qua. Chỉ áp dụng khi hai bước nằm liền nhau trong chuỗi của đơn, xem DESIGN_BRIEF §9 mục 17.
  - **Kéo thả** (bổ sung 11/11/2026): chuỗi bước bên trái, chi tiết bước đang chọn bên phải; kéo khối "Duyệt theo vai trò", "Duyệt theo chức danh", "Người duyệt cụ thể" vào chuỗi để chèn bước, kéo tay nắm để đổi thứ tự.
  - **Uỷ quyền** khi người duyệt vắng (từ ngày – đến ngày) — có audit.
  - **Phiên bản hoá**: sửa quy trình tạo phiên bản mới; đơn đang chạy giữ phiên bản cũ, đơn mới dùng phiên bản mới.
  - Màn **Xem trước**: nhập đơn giả định (đơn vị, giá trị, cờ) → hiện chuỗi bước & người duyệt thực tế.
  - Động cơ duyệt viết tách biệt, thuần (`packages/contracts/approval-engine.ts`) để dùng lại sau cho duyệt KH mới.
  - **Xong khi**: cấu hình 2 đơn vị khác nhau → 2 đơn cùng giá trị đi 2 chuỗi duyệt khác nhau; xem trước khớp thực tế; test cho kế thừa, điều kiện, uỷ quyền, đổi phiên bản giữa chừng.

- **A11. Ca làm việc & lịch nghỉ: ĐÃ BỎ (11/11/2026).** CBKD đi thị trường ở nhiều địa điểm, giờ làm khác nhau nên không có giờ làm thống nhất. Nhân viên dùng dữ liệu check-in để tính công với kế toán của đơn vị, DMS không quản lý ca. Đã gỡ trang `/quan-tri/ca-lam-viec`, quyền `admin.shift.*` và các bảng ca, gán ca, lịch nghỉ (migration `20261111130000_remove_shifts`).

---

## Giai đoạn 2 — Kinh doanh (DMS) + FAST (tuần 8–14)

- [ ] **S1. Khách hàng (nông dân / HTX / hộ kinh doanh)**: danh sách, chi tiết, tạo/sửa; trường: SĐT (khoá chính nghiệp vụ), Zalo ID (liên kết từ CSKH), địa chỉ, cây trồng, diện tích, đại lý mua hàng thường xuyên. **Một hồ sơ, hai lối vào**: `/kinh-doanh/khach-hang/[id]` và `/cskh/khach-hang/[id]` dùng chung `CustomerProfile`. _Dùng lại: F4, F5, A7. Cỡ M._
  - Trang chi tiết dạng tab: Thông tin · Đơn hàng · Phản hồi CSKH · Lịch sử viếng thăm (các tab tải song song, mỗi tab một `<Suspense>`).
  - **Xong khi**: tìm KH theo SĐT < 300ms; tab Phản hồi sẵn chỗ cho C8.

- [ ] **S2. Tạo đơn hàng (web)**: chọn đại lý → thêm dòng sản phẩm → giá & chiết khấu tự tính từ A6 → VAT → tổng; lưu nháp hoặc gửi duyệt. _Dùng lại: A4–A7, F5. New: `OrderForm` compound (`OrderForm.Dealer / Lines / Summary / Actions`). Cỡ L._
  - Variant tường minh `OrderFormCreate` / `OrderFormEdit` thay vì boolean.
  - **Cảnh báo — không chặn** (theo quyết định §9.8):
    - *Tồn kho giống*: so số lượng đặt với tồn của kho phục vụ (A5) trừ lượng đã giữ bởi đơn đã duyệt chưa xuất; hiện ngay cạnh dòng sản phẩm "Tồn khả dụng: 120 bao — thiếu 30".
    - *Hạn mức công nợ*: công nợ hiện tại (từ FAST) + giá trị đơn đang chờ + đơn này so với hạn mức; thanh tiến độ % hạn mức.
    - Vẫn cho lưu/gửi duyệt; đơn được gắn cờ `OVER_CREDIT` / `LOW_STOCK` hiển thị nổi bật cho người duyệt và kích hoạt bước duyệt có điều kiện (A10).
    - Hiện "dữ liệu cập nhật lúc hh:mm" để người dùng biết độ mới của tồn/công nợ.
  - Cảnh báo khác: sản phẩm ngừng kinh doanh (chặn), số lượng không theo quy cách đóng gói (cảnh báo).
  - Mã đơn tự sinh theo quy tắc (vd `DH-{vùng}-{yyMM}-{seq}`), chống trùng khi bấm 2 lần (idempotency key).
  - **Xong khi**: đơn 30 dòng nhập mượt bằng bàn phím (Tab/Enter); tổng tiền khớp từng đồng với hàm `resolvePrice`.

- [ ] **S3. Danh sách & chi tiết đơn hàng**: lọc theo trạng thái, đại lý, NV, vùng, khoảng ngày, trạng thái đồng bộ FAST; chi tiết có dòng thời gian trạng thái, người thao tác, in/xuất PDF phiếu đặt hàng. _Dùng lại: F4, S2. Cỡ M._

- [ ] **S4. Quy trình duyệt đơn (state machine + động cơ duyệt theo đơn vị)**: `Nháp → Chờ duyệt (bước 1..n) → Đã duyệt → Đã chuyển FAST → Đang giao → Hoàn thành`, nhánh `Từ chối` / `Trả lại sửa` / `Huỷ`; chuỗi bước lấy từ quy trình của đơn vị người tạo (A10), chụp lại phiên bản quy trình vào đơn khi gửi duyệt. _Dùng lại: S3, F3, A10. Cỡ L._
  - Người duyệt thấy rõ cờ cảnh báo (vượt công nợ, thiếu tồn) với số liệu tại thời điểm tạo **và** thời điểm duyệt.
  - Trang **Cần duyệt** `/kinh-doanh/can-duyet` với `ApprovalQueue` dùng chung (tab Đơn hàng trước; tab Đại lý mới thêm ở S10): gồm mục được uỷ quyền, sắp quá hạn lên đầu, duyệt ngay trên dòng; leo thang khi quá SLA bước.
  - State machine định nghĩa một chỗ (`packages/contracts/order-machine.ts`), bảng chuyển trạng thái hợp lệ + quyền cần có cho từng bước.
  - Duyệt hàng loạt; lý do bắt buộc khi từ chối/huỷ; ghi `OrderStatusHistory`.
  - Lưu lượt duyệt chuyển tiếp mà `approvalProgress` trả về (`carried`) thành bản ghi duyệt do hệ thống tạo, có ghi bước gốc, và ghi nhật ký riêng. Không gửi thông báo cần duyệt cho bước đã tự qua.
  - Khi chuyển sang `Đã duyệt` → ghi `SyncOutbox` **trong cùng transaction**.
  - Thông báo cho người tạo (in-app; Mattermost nếu bật).
  - **Xong khi**: không thể nhảy trạng thái sai kể cả gọi API trực tiếp; test cho mọi cạnh của state machine; bỏ quyền `sales.order.approve` của ASM ở `/quan-tri/vai-tro` → nút Duyệt biến mất, gọi Server Action trực tiếp bị `FORBIDDEN`, API di động trả 403 (tiêu chí chuyển từ A3).

- [ ] **S5. Kết nối FBO cho đơn hàng (Push client và/hoặc API v1 Pull)**: triển khai thật hợp đồng đã chốt ở R1. _Dùng lại: R1, A8, S4. Cỡ L._
  - Nếu **Push** (FBO có API nhận chứng từ): worker `fast-push` đọc `SyncOutbox`, ánh xạ đơn → chứng từ FBO, gọi API với idempotency = mã đơn, lưu số chứng từ trả về. Phần API v1 dưới đây vẫn làm cho luồng FBO đẩy ngược (công nợ, giao hàng) và tra cứu.
  - Nếu **Pull**: làm đầy đủ các endpoint dưới đây.
  - `GET /api/v1/orders?status=approved&updatedSince=&cursor=` (phân trang cursor), `GET /api/v1/orders/{code}`.
  - `POST /api/v1/orders/{code}/ack` — FAST báo thành công (số chứng từ, ngày) hoặc lỗi (mã + thông điệp) → cập nhật trạng thái đơn & `SyncLog`.
  - `GET /api/v1/products`, `/dealers`, `/customers`, `/warehouses` (đối chiếu danh mục, hỗ trợ `updatedSince`).
  - Tuỳ R1: `PUT /api/v1/dealers/{code}/debt` (FAST đẩy công nợ), `PUT /api/v1/orders/{code}/delivery` (trạng thái giao hàng).
  - Middleware: xác thực API key + HMAC + timestamp (±5 phút), IP whitelist, rate limit theo client, ghi log request/response (che dữ liệu nhạy cảm), header `Idempotency-Key` cho POST/PUT.
  - Định dạng lỗi thống nhất `{ error: { code, message, details } }`; versioning qua đường dẫn `/v1`.
  - **Xong khi**: bộ test hợp đồng (contract test) chạy trong CI; đội FAST đồng bộ được 1 đơn thật trên staging từ đầu đến cuối.

- [ ] **S6. Tài liệu API & sandbox cho FAST**: trang `/api/docs` (Scalar) sinh từ Zod → OpenAPI; ví dụ ký HMAC bằng C#/.NET (FAST thường dùng .NET) và Postman collection; API key sandbox riêng. _Dùng lại: S5. Cỡ S._

- [ ] **S7. Màn theo dõi đồng bộ FAST (`/kinh-doanh/dong-bo-fast`)**: đơn chờ đồng bộ, đã đồng bộ, lỗi; xem payload & phản hồi lỗi; nút "Gửi lại"; nếu chế độ Push thì worker retry luỹ tiến (1m, 5m, 30m, 2h) và đánh dấu "cần xử lý tay" sau N lần. _Dùng lại: F4, S5. Cỡ M._
  - Cảnh báo vào kênh Mattermost khi có lỗi đồng bộ (dùng C6 khi có; trước đó ghi Notification).
  - **Xong khi**: giả lập FAST trả lỗi → đơn hiện ở tab Lỗi với lý do rõ ràng; sửa dữ liệu và gửi lại thành công.

- [ ] **S8. Tuyến & kế hoạch viếng thăm**: gán đại lý vào tuyến theo ngày trong tuần; ASM lập kế hoạch tuần cho NV; NV xem "Hôm nay cần thăm". _Dùng lại: A7, F4. Cỡ M._
  - **Xong khi**: kế hoạch tuần hiện trên mobile (M6) và trên web; tỉ lệ hoàn thành tuyến tính đúng.

- [ ] **S10. Tạo đại lý/KH mới trên DMS và đẩy sang FAST (cách C — brief §10)**: NV kinh doanh tạo đại lý mới (web hoặc mobile) → hệ thống cấp mã ngay từ dải `CodeSequence` → (tuỳ cấu hình) Sales Admin duyệt thông tin pháp lý ở Cần duyệt › Đại lý mới → worker tạo KH trên FBO **với đúng mã đó**. _Dùng lại: A7, A9, A10 (động cơ duyệt), S5. Cỡ L._
  - Trạng thái đồng bộ: `Nháp → Chờ duyệt → Đã gửi FAST → Đã xác nhận` / `Lỗi` (hiện badge trên danh sách đại lý).
  - Cấp mã trong transaction có khoá dòng → 2 người tạo cùng lúc không bị trùng; trước khi gửi, kiểm tra mã chưa tồn tại trên FBO; nếu trùng thì báo lỗi để xử lý tay, không ghi đè.
  - Hàng đợi có thứ tự: đơn của đại lý mới được tạo & duyệt bình thường nhưng **chỉ gửi FAST sau khi đại lý ở trạng thái "Đã xác nhận"**; màn S7 hiện lý do "chờ KH được FAST xác nhận".
  - Sửa trường thuộc FAST (tên pháp lý, MST, địa chỉ xuất HĐ) → tạo yêu cầu cập nhật gửi FBO; giá trị chỉ đổi trên DMS khi FBO xác nhận.
  - **Phương án dự phòng (cách B)** nếu R1 cho thấy FBO không nhận mã truyền vào: gửi KH sang FBO, nhận mã FBO trả về rồi ghi vào đại lý; trong lúc chờ, đại lý mang mã tạm `TMP-…` không được dùng cho đối soát.
  - **Xong khi**: tạo đại lý trên web → được cấp mã, duyệt, xuất hiện trên FBO đúng mã; đơn tạo ngay sau đó chỉ sang FBO sau khi đại lý đã sang. Luồng trên app kiểm tra ở M10.

- [ ] **S11. Đồng bộ công nợ & hạn mức từ FAST**: worker lấy công nợ hiện tại & hạn mức của từng đại lý từ FBO mỗi 15 phút (hoặc FBO đẩy vào `PUT /api/v1/dealers/{code}/debt`); hiển thị trên chi tiết đại lý, form tạo đơn (S2) và mobile. _Dùng lại: R1, A7. Cỡ M._
  - **Xong khi**: ghi nhận thanh toán trên FBO → sau 1 chu kỳ, công nợ trên DMS giảm tương ứng; mỗi số liệu có thời điểm cập nhật.

---

## Giai đoạn 2b — App điện thoại check-in (song song S-tasks, tuần 9–14)

> Cấu trúc 5 tab (Hôm nay · Tuyến · Đơn hàng · Công · Tôi) theo IA §1.

- [ ] **M1. Đăng nhập mobile + đăng ký thiết bị**: cùng tài khoản web; access token ngắn hạn + refresh token lưu SecureStore; mỗi NV gắn tối đa 1 thiết bị (đổi thiết bị cần admin duyệt ở A2); mở bằng vân tay/FaceID. _Dùng lại: R3, A2, `packages/contracts`. Cỡ M._
  - Nhận diện theo `BRAND.md`: nạp 4 font bằng `expo-font`, component `<Text>` chung chọn `fontFamily` theo kiểu chữ; icon app và màn khởi động xanh với logo ngang màu trắng cỡ L, không xếp chồng; thanh tiêu đề logo cỡ M; cuối tab Tôi có logo cỡ S, bản quyền và liên hệ Phòng ĐMST&CĐS.
  - **Xong khi**: khoá tài khoản trên web → app bị đăng xuất; đăng nhập trên máy thứ 2 bị chặn kèm hướng dẫn.

- [ ] **M2. Check-in có ảnh bắt buộc** (viết lại 11/11/2026, CHECK_IN_PLAN §4, §5): bấm **Check-in** là mở ngay máy ảnh trong app (`expo-camera`), không mở máy ảnh của điện thoại, không chọn ảnh có sẵn. Khung ngắm luôn hiện dải thông tin: giờ phút giây và ngày theo giờ máy chủ đã đồng bộ, toạ độ và sai số, địa chỉ khi có mạng (V3), tên nhân viên; sai số trên 50 m thì báo "Đang chờ định vị chính xác". Chụp xong, dải thông tin được in hẳn lên ảnh, ảnh thu về 1600 px, khoảng 300 KB. Sau đó chọn điểm (**Đại lý** gợi ý gần nhất, **Khách hàng**, hoặc **Điểm khác** tự đặt tên) và nhập **Ghi chú** (bắt buộc nếu không tại đại lý). Chỉ có trên app, không có trên web. _Dùng lại: R3, M1, A7, S1. Cần duyệt thư viện `react-native-view-shot`. Cỡ L._
  - **Xong khi**: ảnh chụp ở 3 loại điểm đều có giờ, toạ độ in trên ảnh, đọc rõ ngoài nắng; không lưu được nếu chưa chụp ảnh hoặc thiếu ghi chú khi không tại đại lý; khi có mạng hiện trên báo cáo web trong 5 giây.

- [ ] **M3. Hàng đợi offline — "check-in lúc nào cũng được ghi nhận"**: mọi check-in và điểm GPS ghi SQLite trước, check-in có `clientId` UUID, trạng thái `pending/synced/failed`; đồng bộ khi có mạng, khi mở app và chạy nền; API `POST /api/mobile/check-ins` idempotent theo `clientId`; ảnh upload riêng, có resume. _Dùng lại: M2. Cỡ L._
  - Hiện số check-in chờ gửi; không cho đăng xuất khi còn bản ghi chưa đồng bộ.
  - **Xong khi**: bật chế độ máy bay, check-in 5 lần, tắt máy bay → đủ 5 bản ghi trên server, không trùng, giờ thiết bị được giữ nguyên.

- [ ] **M12. Ghi hành trình chạy nền** (CHECK_IN_PLAN §3.1, §3.5): từ lượt check-in đầu tiên trong ngày, app lấy vị trí 5 giây một lần, chỉ giữ điểm khi đã đi thêm 10 m, lưu SQLite, gửi theo lô khoảng 60 giây một lần qua `POST /api/mobile/track-points` (chống trùng theo nhân viên và giờ). Dừng khi bấm "Kết thúc ngày" hoặc tới giờ trong Tham số (mặc định 20:00). Android chạy dịch vụ nền có thông báo cố định; iOS cần quyền "Luôn luôn", thiếu quyền thì nhắc mỗi lần mở app. Lần đầu dùng có màn đồng ý cho ghi vị trí trong giờ làm việc. Khoảng thời gian, khoảng cách lọc và giờ dừng nằm ở Tham số (A9). _Dùng lại: M1, M3, R3, A9. Cỡ L._
  - **Xong khi**: chạy thử 8 giờ trên 1 Android và 1 iPhone với app ở nền và màn hình tắt: vết không đứt quá 5 phút khi đang di chuyển, mức hao pin ghi vào báo cáo; tắt mạng 1 giờ rồi bật lại thì đủ điểm.

- [ ] **M4. Kiểm tra vị trí khi check-in đại lý, khách hàng (geofence)**: tính khoảng cách từ vị trí hiện tại tới toạ độ đã lưu của điểm được chọn; ngoài bán kính (A9) vẫn ghi nhận nhưng **bắt nhập lý do** và gắn cờ. Điểm khác không kiểm tra bán kính. _Dùng lại: M2, M3, S8, A7. Cỡ M._
  - Cho phép cập nhật toạ độ đại lý lần đầu (đại lý chưa có toạ độ) — cần ASM duyệt.
  - **Xong khi**: check-in cách đại lý 50m → hợp lệ; cách 2km → có cờ + lý do; web thấy cả hai.

- [ ] **M5. Chống gian lận check-in**: cờ nghi vấn khi: mock location (Android), độ chính xác GPS kém (> 100m), chênh giờ thiết bị/server > 5 phút, thiết bị root/jailbreak, tốc độ di chuyển giữa 2 điểm phi lý. Ảnh chỉ chụp được trong app nên không còn trường hợp ảnh từ thư viện. _Dùng lại: M3, M4, M12. Cỡ M._
  - Không chặn cứng (để luôn ghi nhận) — gắn cờ và lý do cho quản lý xem ở báo cáo ghé thăm (V2).

- [ ] **M6. Lịch sử & lịch tuyến của tôi**: xem check-in của mình theo ngày/tháng kèm ảnh, ghi chú, km từng chặng và tổng km trong ngày (V1), trạng thái đồng bộ, kế hoạch viếng thăm hôm nay/tuần (S8), bản đồ điểm cần đến. _Dùng lại: M3, S8, V1. Cỡ M._

- [ ] **M7. Thông báo đẩy**: expo-notifications; đơn được duyệt/từ chối, kế hoạch mới. _Dùng lại: M1, S4. Cỡ S._

- [ ] **M8. Tạo đơn nhanh trên mobile (tuỳ chọn — Giai đoạn 2)**: tạo đơn ngay tại đại lý sau check-in, dùng `resolvePrice` chung, lưu nháp offline, gửi duyệt khi có mạng. _Dùng lại: S2 (logic), M3 (offline). Cỡ L._

- [ ] **M9. Phát hành app Android + iOS cho 300–400 NV**: EAS Build & EAS Submit. _Cỡ L (tăng do iOS)._
  - **iOS**: tài khoản Apple Developer Organization đứng tên Vinaseed (khởi động từ R3); phát hành dạng **Unlisted App** trên App Store (chỉ ai có link mới cài được) hoặc **Custom App** qua Apple Business Manager; TestFlight cho nhóm thử. Chuẩn bị cho Apple review: tài khoản demo, giải thích lý do dùng vị trí chạy nền & camera (chuỗi `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSCameraUsageDescription` tiếng Việt, video minh hoạ ghi hành trình; Google Play cần khai báo quyền vị trí nền và dịch vụ nền), chính sách quyền riêng tư công khai.
  - **Android**: Google Play phát hành private/closed testing cho tài khoản công ty, hoặc APK ký số phát qua link nội bộ (kèm hướng dẫn bật cài đặt từ nguồn ngoài).
  - OTA update (expo-updates) để sửa lỗi JS không cần duyệt lại store; chính sách bắt buộc cập nhật khi API đổi phiên bản.
  - Trang hướng dẫn cài đặt có QR code cho từng nền tảng.
  - **Xong khi**: 10 NV thí điểm (≥ 3 iPhone) cài từ store/link chính thức và check-in được.

- [ ] **M10. Thêm đại lý mới trên app**: tab Tuyến › Thêm đại lý; lưu trên máy khi mất mạng; gửi lên khi có mạng rồi mới được cấp mã (S10); lấy toạ độ tại chỗ. _Dùng lại: M3, S10. Cỡ M._
  - **Xong khi**: thêm đại lý lúc mất mạng → có mạng thì được cấp mã, duyệt, xuất hiện trên FBO đúng mã.

- [ ] **M11. Cần duyệt và chỉ tiêu của tôi trên app**: người có quyền duyệt thấy đơn hàng cần duyệt ngay trong tab Đơn hàng (cùng API với web); tab Hôm nay hiện % chỉ tiêu tháng của nhân viên. Phần chỉ tiêu làm sau K3, K4. _Dùng lại: S4, K3. Cỡ M._

- **S9. Trang Check-in trên web cho quản lý: đã gộp vào V2 (11/11/2026).**

---

## Giai đoạn 2c — Báo cáo ghé thăm (tuần 12–14)

> **Quyết định 11/11/2026 (DESIGN_BRIEF §9 mục 20):** DMS không tính công. Check-in chỉ ghi lại nhân viên đã ở đâu, lúc nào, làm gì và đi bao nhiêu km. Kế toán đơn vị dùng file Excel để tính công. Các task T1 đến T5 (tổng hợp ngày công, bảng công, giải trình và đơn từ, chốt kỳ công, tích hợp HRM) đã bỏ.
>
> **Kế hoạch chi tiết phần check-in:** [CHECK_IN_PLAN.md](CHECK_IN_PLAN.md) (máy ảnh có dấu vị trí, ghi hành trình 5 giây, tính km theo đường đi thực tế, địa chỉ, mẫu Excel). Thứ tự làm: R3, R4 → M1, M2, M3, M12 → V3, V1 → V2.

- [ ] **V3. Địa chỉ của điểm check-in**: worker đổi toạ độ ra địa chỉ (reverse geocoding) qua nhà cung cấp Việt Nam (Vietmap hoặc Goong, chờ chốt), một lần cho mỗi check-in, lưu lại; lỗi thì thử lại, báo cáo vẫn có toạ độ. API `GET /api/mobile/address?lat=&lng=` cho dải thông tin trên máy ảnh, có cache theo ô khoảng 50 m để giảm số lượt gọi. Khoá API chỉ nằm trên máy chủ. _Dùng lại: F3 (worker), M2. Cỡ S._
  - **Xong khi**: 20 check-in thật ra địa chỉ đúng tên xã, tỉnh mới; tắt mạng nhà cung cấp thì check-in vẫn lưu và địa chỉ được bù khi có lại.

- [ ] **V1. Quãng đường giữa các điểm check-in** (theo CHECK_IN_PLAN §3): khi nhận check-in, worker lấy vết GPS từ check-in liền trước trong cùng ngày, lọc điểm sai, tính **Khoảng cách theo GPS** (cộng các đoạn) và **Khoảng cách** theo đường đi thực tế (khớp vết vào đường qua máy chủ tìm đường R4). Đoạn vết đứt trên 5 phút hoặc trên 2 km nối bằng đường ngắn nhất và đánh dấu "ước tính". Lượt đầu ngày ghi 0 km. Check-in hoặc điểm GPS gửi trễ thì tính lại các chặng bị ảnh hưởng. Lưu `roadDistanceKm`, `gpsDistanceKm`, `isDistanceEstimated` trên `CheckIn`. Tính khoảng cách đường qua lớp `RoadDistanceProvider` để đổi nhà cung cấp được. _Dùng lại: M2, M3, M12, R4, F3. Cỡ L._
  - **Xong khi**: test cho lọc điểm sai, vết đứt, lượt đầu ngày, qua nửa đêm, dữ liệu gửi lệch thứ tự; trên 3 tuyến thật của R4, km lệch với đồng hồ xe không quá 5%.

- [ ] **V2. Báo cáo ghé thăm (`/kinh-doanh/check-in`)**: bảng check-in phân trang phía máy chủ, xem ảnh khi chọn một dòng, bản đồ hành trình một ngày của một nhân viên (vết GPS và các điểm check-in, tải bằng `next/dynamic`). _Dùng lại: F4, M2 đến M5, V1, V3, A1. New: `CheckInMap`. Cỡ L._
  - Cột trên web và trong Excel giống mẫu `Bao-cao-cu-ly-di-chuyen.xlsx`, thêm 2 cột: STT, Tên đơn vị, Mã nhân viên, Tên nhân viên, Ngày, Thời gian checkin, Địa chỉ, Khách hàng, **Tên đại lý**, **Ghi chú**, Khoảng cách (km), Khoảng cách theo GPS (km). Tên đại lý chỉ có khi check-in tại đại lý; Ghi chú là nội dung nhân viên nhập, bắt buộc với lượt không tại đại lý. Dòng có km ước tính được đánh dấu.
  - Lọc: khoảng ngày (mặc định hôm nay), nhân viên, đơn vị, loại điểm, chỉ dòng có cờ. Dưới bảng có tổng số lượt và tổng km theo bộ lọc.
  - **Xuất Excel** đúng bộ lọc, đúng định dạng mẫu (CHECK_IN_PLAN §6): tiêu đề gộp ô dòng 3, tiêu đề cột dòng 5, Times New Roman 11, viền, km 3 chữ số thập phân, ngày và giờ theo giờ Việt Nam, sắp theo đơn vị, nhân viên, giờ mới nhất ở trên. Giới hạn `MAX_EXPORT_ROWS`.
  - **Phạm vi**: nhân viên chỉ thấy check-in của mình; quản lý thấy nhân viên trong đơn vị mình quản lý theo phạm vi dữ liệu của vai trò. Áp ở trang, Excel và API.
  - Không có nút check-in trên web.
  - **Thời gian lưu** (CHECK_IN_PLAN §7): job worker mỗi đêm xoá dòng check-in quá 18 tháng, điểm GPS quá 45 ngày; ảnh trên MinIO tự hết hạn sau 45 ngày. Dòng còn mà ảnh đã xoá thì ghi "Ảnh đã hết thời gian lưu"; bộ lọc ngày chỉ cho chọn trong 18 tháng gần nhất.
  - **Xong khi**: nhân viên A chỉ thấy và xuất được dòng của A; quản lý vùng 1 không thấy vùng 2, kể cả gọi thẳng action; file Excel mở ra giống mẫu, có thêm 2 cột, tổng km khớp với trang.

---

## Giai đoạn 3 — Chăm sóc khách hàng (tuần 13–18)

- [ ] **C1. Phiếu tiếp nhận thủ công (hotline, trực tiếp, email)**: tạo phiếu: KH (tìm theo SĐT hoặc tạo nhanh), kênh, loại (khiếu nại chất lượng giống, hỏi kỹ thuật canh tác, giao hàng, giá/chính sách, khác), mức ưu tiên, mô tả, ảnh đính kèm, liên kết đại lý/đơn hàng/lô sản phẩm. _Dùng lại: F4, F5, S1. Cỡ M._
  - Vòng đời: `Mới → Đã phân công → Đang xử lý → Chờ KH → Đã giải quyết → Đóng` (+ `Mở lại`).
  - **Xong khi**: tạo phiếu, phân công, đóng; mỗi bước ghi `TicketEvent`.

- [ ] **C2. Nhận tin Zalo OA vào hệ thống**: webhook production-ready từ R2: xác thực, chống trùng (event id), lưu `Message` + đính kèm (tải ảnh về MinIO), tự gom vào `Conversation` theo Zalo user, tự tạo/ghép `Customer` theo Zalo ID/SĐT, tự mở `Ticket` nếu hội thoại không có phiếu đang mở; trả 200 nhanh rồi xử lý trong worker. _Dùng lại: R2, C1, S1. Cỡ L._
  - Xử lý các sự kiện: tin văn bản, ảnh, file, sticker, follow/unfollow OA.
  - **Xong khi**: 100 tin nhắn dồn dập không mất tin, không tạo phiếu trùng.

- [ ] **C3. Hộp thư hợp nhất (`/cskh/hop-thu`)**: giao diện 3 cột: danh sách hội thoại (lọc: của tôi / chưa phân công / theo kênh / chưa đọc) · khung chat · thông tin KH + phiếu liên quan + đơn hàng gần nhất. Realtime qua SSE; TanStack Query cache theo hội thoại. _Dùng lại: C2, S1. New: `Inbox` compound (`Inbox.List / Thread / Composer / CustomerPanel`). Cỡ L._
  - Danh sách hội thoại ảo hoá; khung chat tải ngược trang cũ khi cuộn lên.
  - Chỉ báo "đang có người khác xử lý" để 2 NV không cùng trả lời.
  - **Xong khi**: tin mới hiện < 2s không cần F5; mở 1.000 hội thoại vẫn mượt.

- [ ] **C4. Trả lời KH qua Zalo từ hộp thư + quản lý hạn mức gói Nâng cao**: soạn văn bản, gửi ảnh/file, mẫu trả lời nhanh (C7); gửi qua worker, hiện trạng thái *đang gửi / đã gửi / lỗi* + nút gửi lại. _Dùng lại: C3, R2. Cỡ L (tăng do hạn mức)._
  - Mỗi hội thoại hiện **đồng hồ khung tương tác** ("Còn 2 ngày 5 giờ trả lời miễn phí").
  - Trả lời **ngoài khung** → hộp xác nhận "Tin này dùng 1/2.000 tin tư vấn ngoài khung"; bộ đếm hạn mức còn lại ở góc hộp thư; cảnh báo cho Trưởng nhóm CSKH khi dùng 80% và 95%.
  - Phân quyền: chỉ vai trò được cấp mới gửi được tin ngoài khung (tránh tiêu hết hạn mức).
  - Báo cáo hạn mức theo tháng gửi cho Khối Marketing & PTSP (chủ OA).

- [ ] **C5. Phân công, SLA & chuyển tiếp**: phân công thủ công hoặc tự động (round-robin theo ca/nhóm, theo vùng của KH); SLA phản hồi đầu & giải quyết theo mức ưu tiên (A9); cảnh báo sắp/quá hạn; chuyển phiếu sang bộ phận khác (vd kỹ thuật, kinh doanh vùng) kèm ghi chú nội bộ. _Dùng lại: C1, C3, A9. Cỡ L._
  - **Xong khi**: phiếu quá SLA đổi màu trong danh sách và bắn thông báo (C6).

- [ ] **C6. Tích hợp Mattermost**: bot đăng vào kênh cấu hình ở A8 khi: phiếu mới mức cao, phiếu quá SLA, phiếu được chuyển cho nhóm, lỗi đồng bộ FAST (S7); tin có nút/đường dẫn mở thẳng phiếu trên web; slash command `/phieu <mã>` tra cứu, `/phieu nhan <mã>` nhận xử lý (outgoing webhook xác thực token). _Dùng lại: A8, C5, S7. Cỡ M._
  - **Xong khi**: tạo phiếu mức cao → kênh Mattermost có tin < 10s; gõ `/phieu nhan` → phiếu được gán cho người gõ (map user Mattermost ↔ User qua email).

- [ ] **C7. Mẫu trả lời & cơ sở kiến thức ngắn**: mẫu câu trả lời theo loại vấn đề có biến (`{ten_kh}`, `{ma_don}`), gõ `/` trong composer để chèn. _Dùng lại: C4. Cỡ S._

- [ ] **C8. Liên kết CSKH ↔ Kinh doanh**: tab "Phản hồi CSKH" trong chi tiết KH/đại lý/đơn hàng (S1, S3); từ phiếu tạo nhanh yêu cầu cho NV kinh doanh phụ trách vùng (thông báo mobile M7); KH khiếu nại theo lô sản phẩm → thống kê theo lô. _Dùng lại: C1, S1, S3, M7. Cỡ M._

- [ ] **C9. Khảo sát hài lòng (CSAT)**: khi đóng phiếu gửi tin Zalo xin đánh giá 1–5 sao **chỉ khi hội thoại còn trong khung tương tác** (không tiêu hạn mức ngoài khung); lưu điểm vào phiếu. _Dùng lại: C4. Cỡ S._

---

## Giai đoạn 3b — Dashboard, chỉ tiêu & số liệu (tuần 16–20)

> Định nghĩa từng chỉ số ở IA §3.5. Khi dựng biểu đồ dùng skill `dataviz`.

- [ ] **K1. Nền số liệu**: bảng `SalesDailyFact`, worker tổng hợp mỗi 15 phút từ đơn đã duyệt (nguồn Đặt hàng); quy đổi sản lượng ra kg/tấn; gắn đơn vị và nhân viên tại thời điểm bán; công thức chỉ số viết tập trung một chỗ, có unit test. Áp phạm vi dữ liệu ở tầng truy vấn. _Dùng lại: S4, A1, A5, F3. Cỡ L._
  - **Xong khi**: số tổng hợp khớp truy vấn trực tiếp trên dữ liệu gốc; đổi vùng của đại lý không làm đổi số quá khứ; sản phẩm thiếu quy đổi được liệt kê riêng.

- [ ] **K2. Số liệu Thực bán từ FAST**: worker lấy hoá đơn bán và hàng trả lại từ FBO vào `FastSalesLine`, đưa vào bảng tổng hợp với nguồn Thực bán. Dự phòng nếu không có API: nhập file Excel xuất từ FAST. Tab đối soát: chênh lệch Đặt hàng và Thực bán theo đơn. _Dùng lại: R1, K1, S7. Cỡ M._
  - **Xong khi**: sản lượng và doanh thu Thực bán của một tháng khớp báo cáo bán hàng trên FAST; hàng trả lại được trừ đúng kỳ.

- [ ] **K3. Chỉ tiêu và Lịch vụ**: trang `/quan-tri/lich-vu` khai báo vụ; trang `/kinh-doanh/chi-tieu` giao chỉ tiêu theo kỳ (tháng/vụ) × đơn vị hoặc nhân viên × nhóm sản phẩm, gồm sản lượng và doanh thu; nhập tay hoặc Excel; phân bổ Miền → Vùng → Nhân viên, cảnh báo khi tổng cấp con khác cấp cha; sửa có ghi nhật ký. _Dùng lại: F4, F5, A1, A4. Cỡ M._
  - **Xong khi**: nhập Excel chỉ tiêu một vụ cho toàn công ty, xem được theo từng cấp; nhân viên chỉ thấy chỉ tiêu của mình.

- [ ] **K4. Dashboard Kinh doanh (`/kinh-doanh/dashboard`)**: đủ các khu vực ở IA §3.2 — hàng số chính (Sản lượng đặt hàng, Sản lượng thực bán, Doanh thu, % hoàn thành chỉ tiêu, Số đại lý đặt mua), sản lượng theo kỳ so với chỉ tiêu và cùng kỳ, theo nhóm sản phẩm, top giống; top đại lý, đại lý mới, đại lý không đặt hàng, độ phủ; đơn hàng theo trạng thái; công nợ và tồn kho; thị trường. _Dùng lại: K1–K3, S8, S9, S11, A5. New: `DashboardGrid`, `MetricTile`, `ChartCard`, `DashboardFilters`. Cỡ L._
  - Bộ lọc kỳ/vụ, đơn vị, nhóm sản phẩm, nguồn số liệu nằm trên URL.
  - Biểu đồ dùng màu và font theo `BRAND.md`: chuỗi chính `#005b36`, chuỗi phụ từ thang nhạt và `#789a3d`; truyền UTM Neo Sans Intel vào trục, chú giải, tooltip.
  - Mỗi khối fetch song song (`Promise.all`), một `<Suspense>` riêng; biểu đồ `next/dynamic`; mỗi khối hiện thời điểm cập nhật; bấm vào để tới danh sách đã lọc.
  - **Xong khi**: nhân viên, ASM, lãnh đạo mở cùng trang thấy đúng phạm vi và khối của mình; gửi link giữ nguyên bộ lọc; LCP < 2.5s (4G giả lập).

- [ ] **K5. Báo cáo Kinh doanh (`/kinh-doanh/bao-cao`)**: bảng số chi tiết theo các chiều đại lý, sản phẩm, nhân viên, đơn vị, kỳ; lưu bộ lọc hay dùng; xuất Excel đúng phạm vi. _Dùng lại: K1, K2, F4. Cỡ M._

- [ ] **K6. Tổng quan điều hành (`/tong-quan`)**: màn hình một trang cho lãnh đạo theo IA §3.3: chỉ số chính, so sánh các miền, danh sách "Cần chú ý", mỗi mục dẫn tới trang đã lọc. Lối vào từ Hub. _Dùng lại: K4, D2. New: `ExecutiveShell`. Cỡ M._
  - **Xong khi**: người không có quyền bị `/403`; không cuộn trên màn 1440px; mỗi mục "Cần chú ý" mở đúng danh sách.

- [ ] **D2. Dashboard CSKH (`/cskh/dashboard`)**: theo IA §3.4 — phiếu mới, đang mở, quá hạn; thời gian phản hồi đầu và giải quyết; tỉ lệ đạt SLA; điểm hài lòng; theo loại và kênh; khiếu nại theo giống/lô; hiệu suất từng nhân viên; hạn mức tin Zalo ngoài khung. _Dùng lại: C1–C9, `DashboardGrid`. Cỡ M._

---

## Giai đoạn 4 — Hub hoàn chỉnh & hoàn thiện (tuần 20–23)

- [ ] **D3. Hub hoàn chỉnh**: mỗi ô bộ phận hiện số việc chờ thật (mục cần duyệt, phiếu chưa xử lý, lỗi đồng bộ), việc cần làm của tôi, thông báo gần đây; tìm kiếm toàn cục (Ctrl+K) tìm đơn hàng/đại lý/khách hàng/phiếu theo quyền; prefetch bộ phận khi hover ô (`bundle-preload`). _Dùng lại: F2, F3, K4, K6, D2. Cỡ M._

- [ ] **D4. Trung tâm thông báo (`/thong-bao`)**: chuông thông báo trong AppShell, đánh dấu đã đọc, cài đặt nhận qua web/mobile/Mattermost theo loại. _Dùng lại: F2, C6, M7. Cỡ M._

- [ ] **D5. Rà soát hiệu năng**: chạy theo checklist vercel-react-best-practices: không waterfall, không barrel import, bundle analyzer từng route, `server-serialization`, index DB cho các truy vấn lọc chính (EXPLAIN ANALYZE), kiểm thử tải API FAST & webhook Zalo (k6). _Cỡ M._
  - **Xong khi**: LCP < 2.5s (4G giả lập) trên Hub, danh sách đơn hàng, Hộp thư, Dashboard; p95 API < 500ms ở 50 user đồng thời.

- [ ] **D6. Rà soát bảo mật**: OWASP Top 10, kiểm tra IDOR trên mọi `[id]` (đổi id sang bản ghi ngoài phạm vi phải 404/403), rate limit đăng nhập, header bảo mật (CSP, HSTS), mã hoá token tích hợp at-rest, quét dependency. _Cỡ M._

- [ ] **D7. Accessibility & responsive pass**: điều hướng bàn phím trên form đơn hàng & inbox, contrast WCAG AA, nhãn form, kiểm tra 375/768/1024/1440. _Cỡ S._

---

## Giai đoạn 5 — Chuyển đổi dữ liệu, UAT & Go-live (tuần 23–26)

- [ ] **G1. Chuyển đổi dữ liệu thật**: import NV, cơ cấu tổ chức, bảng giá từ Excel; sản phẩm, kho, tồn, đại lý/KH từ FBO; bổ sung toạ độ, NV phụ trách từ DMS cũ. _Dùng lại: A2, A4–A7, S10, S11. Cỡ L._
  - **Hợp nhất mã khách hàng** (brief §10): ghép KH DMS cũ ↔ FAST theo mã đã ánh xạ, rồi theo MST/SĐT; mã FAST thành mã chính, mã DMS cũ vào `legacyCode`.
  - Xuất 3 danh sách cho kế toán & kinh doanh xử lý trước go-live: (1) KH chỉ có trên DMS cũ — tạo trên FAST hay bỏ; (2) KH chỉ có trên FAST — gán NV phụ trách; (3) KH trùng — chọn bản giữ lại.
  - Ánh xạ đơn hàng lịch sử sang KH sau hợp nhất; nạp số liệu bán các năm trước vào bảng tổng hợp để dashboard so được cùng kỳ; nhập chỉ tiêu vụ hiện tại.
  - Chạy thử chuyển đổi ≥ 2 lần trên staging; đối soát số lượng & tổng công nợ khớp FAST; ký biên bản.

- [ ] **G2. UAT theo kịch bản từng bộ phận**: kịch bản Kinh doanh (tạo → duyệt → FAST nhận → giao), Mobile (check-in offline, ngoài geofence), CSKH (Zalo → phiếu → Mattermost → đóng → CSAT), Quản trị (tạo NV → phân quyền → đăng nhập mobile), Báo cáo ghé thăm (check-in 3 loại điểm → km → quản lý xem → xuất Excel), Dashboard (đối soát Thực bán với báo cáo FAST; kiểm tra phạm vi từng vai trò). Ghi nhận lỗi, sửa, ký biên bản. _Cỡ L._

- [ ] **G3. Đào tạo & tài liệu**: hướng dẫn sử dụng theo vai trò (PDF/video ngắn), tài liệu vận hành cho IT (deploy, backup/restore, xoay API key, kết nối lại Zalo OA), tài liệu API cho FAST. _Cỡ M._

- [ ] **G4. Go-live theo đợt**: mỗi đợt có kế hoạch rollback và theo dõi Sentry/log 2 tuần. _Cỡ M._
  - Đợt 1: Quản trị + Kinh doanh web + kết nối FAST cho 1 vùng thí điểm; Dashboard nguồn Đặt hàng.
  - Đợt 2: app check-in toàn bộ nhân viên thị trường; kế toán đơn vị dùng thử file Excel báo cáo ghé thăm ít nhất 1 tháng.
  - Đợt 3: CSKH (Zalo + Mattermost).
  - Đợt 4: bật Thực bán, chỉ tiêu và Tổng quan điều hành sau khi đối soát số với FAST.

## Review

- [ ] **Design review**: chạy `/design-review` đối chiếu DESIGN_BRIEF và INFORMATION_ARCHITECTURE sau F2 (hướng thẩm mỹ), sau C3 (Hộp thư), sau K4 (Dashboard) và trước G2 (toàn bộ).
- [ ] **Code review**: chạy `/code-review` cho mỗi PR có Server Action, API v1 hoặc webhook.

---

## Tóm tắt lộ trình

| Giai đoạn | Tuần | Kết quả nhìn thấy được |
|---|---|---|
| 0 · Nền móng & Hub | 1–3 | Đăng nhập → Hub 3 bộ phận, phân quyền, staging HTTPS trên server nội bộ |
| 0b · Spike | 2–5 | Hợp đồng FBO 2 chiều + dải mã KH đã chốt, nhận/gửi tin Zalo, GPS trên Android & iPhone, đã nộp hồ sơ Apple Developer |
| 1 · Quản trị | 4–8 | Tài khoản, vai trò, sản phẩm/kho/tồn từ FAST, bảng giá, đại lý mã FAST, **quy trình duyệt theo đơn vị** |
| 2 · Kinh doanh + FAST | 8–14 | Đơn có cảnh báo tồn/công nợ, duyệt nhiều bước, đơn & KH mới sang FBO, công nợ về DMS |
| 2b · App check-in | 9–14 | Check-in đại lý, khách hàng, điểm khác, offline, chống gian lận, phát hành Android + iOS |
| 2c · Báo cáo ghé thăm | 12–14 | Quãng đường giữa các điểm check-in, báo cáo theo phạm vi quản lý, xuất Excel |
| 3 · CSKH | 13–18 | Hộp thư Zalo + hạn mức gói Nâng cao, phiếu + SLA, Mattermost |
| 3b · Dashboard & chỉ tiêu | 16–20 | Số lượng hàng bán (Đặt hàng/Thực bán), đại lý đặt mua, % chỉ tiêu, Tổng quan điều hành, Báo cáo |
| 4 · Hoàn thiện | 20–23 | Hub có số việc chờ, tìm kiếm toàn cục, thông báo, rà soát hiệu năng/bảo mật |
| 5 · UAT & Go-live | 23–26 | Hợp nhất mã KH, dữ liệu thật và số liệu lịch sử, đào tạo, triển khai 4 đợt |

Ước lượng ~26 tuần (tăng 2 tuần so với bản trước do thêm chỉ tiêu, số liệu Thực bán từ FAST, Tổng quan điều hành và các việc còn thiếu trên app) với **2 dev full-stack + 1 dev mobile (từ tuần 5, toàn thời gian từ tuần 9) + 1 BA/tester**. Tổng các task khoảng 230 ngày công, chưa tính họp, sửa lỗi và thời gian chờ bên thứ ba. Một dev đơn lẻ: nhân khoảng 2–2,5 lần.

**Đường găng**: **R1 (FBO) → A7/S10 (mã KH) → S4/S5 → K2 (Thực bán) → G1 (hợp nhất mã) → G4**. Thủ tục **Apple Developer** (D-U-N-S) là đường găng thứ hai của app mobile — cần khởi động ngay tuần 1.

**Việc cần người ngoài đội dev làm sớm**
| Ai | Việc | Hạn |
|---|---|---|
| Kế toán + FAST | Xác nhận năng lực API của FBO, chốt dải mã KH cho DMS | Tuần 3 |
| Khối Marketing & PTSP | Tạo app Zalo for Developers, cấp quyền OA, bàn giao App ID/Secret | Tuần 3 |
| IT Vinaseed | Server, DMZ, domain/HTTPS, quyền bot Mattermost | Tuần 2 |
| Pháp chế / Hành chính | Hồ sơ D-U-N-S, tài khoản Apple Developer & Google Play đứng tên Vinaseed | Tuần 1–4 |
| Kế toán đơn vị | Mẫu Excel báo cáo cự ly di chuyển: đã nhận 11/11/2026 | Xong |
| IT, Mua sắm | Tài khoản Vietmap hoặc Goong cho địa chỉ check-in; máy chủ cho dịch vụ tìm đường (CHECK_IN_PLAN §9) | Tuần 5 |
| Kinh doanh các vùng | Quy trình duyệt đơn của từng đơn vị | Tuần 6 |
| Lãnh đạo Kinh doanh | Lịch vụ, cách giao chỉ tiêu, mẫu chỉ tiêu đang dùng | Tuần 14 |
| Kế toán | Số liệu bán các năm trước để so cùng kỳ | Tuần 20 |
