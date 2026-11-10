# DMS Vinaseed — hướng dẫn cho Claude

Phần mềm nội bộ của Vinaseed: web app (Next.js) + app điện thoại (Expo), gồm 3 bộ phận Kinh doanh (DMS), CSKH, Quản trị, đi qua một Hub chung; tích hợp FAST Business Online, Zalo OA, Mattermost.

## Tài liệu gốc (đọc trước khi làm)

- `docs/DESIGN_BRIEF.md` — mục tiêu, vai trò, công nghệ, mô hình dữ liệu, tích hợp, quyết định đã chốt (§9), câu hỏi còn mở (§11).
- `docs/INFORMATION_ARCHITECTURE.md` — sơ đồ trang, điều hướng, tên gọi, URL, định nghĩa chỉ số.
- `docs/TASKS.md` — danh sách việc theo thứ tự.

Khi brief và code mâu thuẫn, brief thắng; nếu thấy brief sai hoặc thiếu, hỏi lại thay vì tự quyết. Không tự trả lời các câu hỏi ở brief §11.

## Quy trình thiết kế và xây dựng (Combo 4 + design system của Combo 1)

1. **Ý tưởng** — đã xong (brief, IA, tasks). Thêm tính năng mới: `feature-prioritization` → cập nhật `docs/TASKS.md` bằng `brief-to-tasks`.
2. **Design system** — trước khi dựng màn hình đầu tiên:
   - `ui-ux-pro-max`: bảng màu xanh Vinaseed, màu phụ cho từng bộ phận, font hỗ trợ tiếng Việt, mật độ thông tin cao, kiểu biểu đồ cho Dashboard. Lưu kết quả vào `docs/DESIGN.md`.
   - `design-tokens`: sinh token sáng/tối cho Tailwind + shadcn/ui.
   - `design-system`: đặc tả component dùng chung (AppShell, DataTable, OrderForm…).
3. **Build** — `web-design-engineer` là skill thẩm mỹ duy nhất của dự án (không dùng design-taste-frontend, claude-design, superdesign). Dựng 1–2 màn đại diện (Hub, Danh sách đơn hàng), chờ duyệt rồi mới nhân rộng. Luôn bật `vercel-react-best-practices` và `vercel-composition-patterns` khi viết code.
4. **Kiểm định trước khi bàn giao** — `best-practices` (bảo mật), `core-web-vitals` (LCP < 2.5s trên 4G), `accessibility`, `web-quality-audit`, `web-design-guidelines`, `ux-heuristics-review` cho luồng tạo đơn / duyệt / chấm công; xếp lỗi bằng `low-effort-high-reward`.

Đầu mỗi câu trả lời về giao diện, ghi một dòng đang ở bước nào và dùng skill nào. Nếu một skill không có trong môi trường, làm theo nguyên tắc tóm tắt bên dưới.

## Nguyên tắc code bắt buộc

- Không waterfall: fetch song song (`Promise.all`), bọc phần chậm bằng `<Suspense>`.
- Server Action và API route đều tự kiểm quyền **và** phạm vi dữ liệu (NV chỉ thấy tuyến mình, ASM thấy cả vùng); không dựa vào việc ẩn nút trên UI. Áp phạm vi ở máy chủ, kể cả khi xuất Excel.
- Chỉ truyền dữ liệu cần thiết xuống Client Component; `React.cache()` cho user/quyền trong một request.
- Import trực tiếp, không barrel file; bản đồ, biểu đồ, trình soạn thảo tải bằng `next/dynamic`.
- Việc không chặn phản hồi (audit log, đẩy job) dùng `after()`.
- Component dùng chung viết theo compound components (`<DataTable.Toolbar>`); không thêm boolean prop để rẽ nhánh, tạo variant rõ ràng.
- State trong Provider với interface `{ state, actions, meta }`. React 19: không `forwardRef`, dùng `use()`.
- Đồng bộ FAST qua transactional outbox, cùng transaction với đổi trạng thái; khách hàng sang FAST trước, đơn sang sau.
- Check-in offline-first, idempotent theo `clientId`; giờ chuẩn lấy từ server, lưu cả giờ thiết bị.
- Audit log cho mọi thao tác tạo / sửa / xoá / duyệt.

## Quy ước giao diện

- Toàn bộ chữ trên giao diện bằng tiếng Việt; ngày `dd/MM/yyyy`; tiền VND.
- Luôn vào qua Hub; menu trái tối đa 2 cấp; chi tiết dùng tab. Tên trang và URL theo đúng IA.
- Responsive, dùng được trên tablet; hỗ trợ sáng/tối.
- Mỗi khối số trên Dashboard hiện thời điểm cập nhật; Dashboard đọc từ bảng tổng hợp, không tính trực tiếp từ dữ liệu gốc.

## Git

- Chỉ commit và push khi được yêu cầu; nhánh chính là `main`.
- Thông điệp commit viết tiếng Việt, ngắn, nói rõ thay đổi gì.
