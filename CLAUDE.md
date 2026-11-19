@AGENTS.md

# Cách làm việc

Claude xây dựng toàn bộ Backend, Frontend và app điện thoại.

## Thứ tự

1. Đọc task trong `.design/seedgw/TASKS.md`, phần liên quan ở `DESIGN_BRIEF.md`, trang tương ứng ở `INFORMATION_ARCHITECTURE.md` và `BRAND.md`.
2. Làm theo `AGENTS.md` §5 và khuôn trong `docs/MAU_CODE.md`.
3. Đối chiếu giao diện với `.design/seedgw/brand/demo-giao-dien.html`.
4. Chạy `pnpm check`, chạy thử luồng chính, rồi báo đúng những gì đã và chưa kiểm tra.

## Yêu cầu riêng

- Migration có thay đổi phá dữ liệu phải hỏi người dùng trước.
- Tích hợp FAST, Zalo, Mattermost gửi qua worker, có retry, idempotency và log. Luồng đơn hàng sang FAST ghi `SyncOutbox` cùng transaction với đổi trạng thái.
- Check-in luôn được ghi nhận, idempotent theo `clientId`, cờ nghi vấn không được chặn.
- Cảnh báo tồn kho và công nợ không được chặn tạo đơn.
- Không thêm thư viện lớn, màu ngoài token, font hoặc weight khác khi chưa được duyệt.
- Không tự chế dữ liệu giả trong component.
