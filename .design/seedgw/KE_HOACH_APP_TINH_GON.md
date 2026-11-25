# Kế hoạch app điện thoại tinh gọn: "Quý tinh bất quý đa"

Soạn 25/11/2026 theo yêu cầu: app chỉ phục vụ việc chính của cán bộ kinh doanh (CBKD) là check-in, bớt tính năng để không lan man. Chờ duyệt, chưa sửa code app. Việc quản lý, lập kế hoạch, duyệt, báo cáo làm trên web.

## Nguyên tắc

1. Mở app là check-in được ngay, một chạm tới máy ảnh.
2. Mỗi màn hình một việc. Việc không cần làm ngoài thị trường thì đưa về web.
3. Không mất dữ liệu: mất mạng vẫn check-in, vẫn ghi hành trình.
4. Chữ to vẫn đủ nút (đã làm ở D7).

## App hiện có (0.2.0) và đề xuất

| Hiện có | Đề xuất | Lý do |
|---|---|---|
| Tab Hôm nay: nút Check-in, Đại lý gần tôi, ghi hành trình, Kết thúc ngày, số lượt và km hôm nay, số chờ gửi | **Giữ, làm trung tâm** | Việc chính mỗi ngày |
| Check-in: máy ảnh có giờ máy chủ và địa chỉ, chọn Đại lý, Khách hàng, Điểm khác, hỏi lý do khi xa, mất mạng vẫn lưu | **Giữ** | Lõi của app |
| Tuyến hôm nay: điểm cần ghé, Đã ghé, Chỉ đường | **Giữ, gộp vào tab Hôm nay** | Giúp đi đúng điểm, không cần tab riêng |
| Tab Tuyến: danh sách đại lý tôi phụ trách, Lấy lại vị trí | **Gộp vào Đại lý gần tôi** | Trùng chức năng với Đại lý gần tôi |
| Đăng ký tuyến tuần hoặc ngày trên app | **Đưa về web** (câu hỏi 1) | Là việc lập kế hoạch, làm một lần mỗi tuần |
| Đề xuất đại lý mới (nút Thêm đại lý, mục Đại lý tôi đề xuất) | **Giữ trong bước check-in**: chọn Điểm khác rồi đánh dấu "Đây là đại lý mới". Bỏ nút riêng và danh sách theo dõi, kết quả báo qua thông báo | Phát sinh ngay tại điểm check-in |
| Thẻ Chỉ tiêu và màn đăng ký chỉ tiêu | **Chỉ hiện một dòng % tháng ở Hôm nay**, đăng ký trên web (câu hỏi 2) | Biết mình đang ở đâu là đủ |
| Cần duyệt (Quản lý, Lãnh đạo duyệt tuyến, chỉ tiêu) | **Đưa về web** (câu hỏi 3) | Không phải việc của CBKD ngoài thị trường |
| Tab Lịch sử: check-in theo tháng, ảnh, km từng chặng, xuất Excel | **Giữ phần xem**, bỏ xuất Excel (kế toán xuất trên web) | Nhân viên tự kiểm lượt và km |
| Hỗ trợ: nút nổi ở cả 4 tab, màn Hỗ trợ | **Giữ màn Hỗ trợ ở tab Tôi, bỏ nút nổi** (câu hỏi 4) | Nút nổi che nội dung, gây phân tán |
| Màn Thông báo (D4, chưa gửi lên app) | **Không đưa lên app**; vẫn giữ thông báo đẩy, xem lại trên web | Bớt một màn hình |
| Thông báo đẩy 7 loại | **Giữ 4 loại**: trả lời hỗ trợ, nhắc check-in, toạ độ hoặc đại lý mới được duyệt, tuyến được duyệt hoặc trả lại | Chỉ báo điều liên quan việc ngoài thị trường |
| Tab Tôi: hồ sơ, quyền vị trí, rút đồng ý, đăng xuất, thông tin kỹ thuật | **Giữ, gọn lại**: thông tin kỹ thuật thu vào một dòng "Thông tin cho bộ phận hỗ trợ" | Ít người cần |

## App sau khi gọn

3 tab thay cho 4:

- **Hôm nay**: nút lớn Chụp ảnh check-in; Đại lý gần tôi; tuyến hôm nay kèm Chỉ đường; trạng thái ghi hành trình và Kết thúc ngày; số lượt, km; một dòng % chỉ tiêu tháng; số chờ gửi.
- **Lịch sử**: lượt check-in theo ngày, ảnh, km.
- **Tôi**: hồ sơ, Hỗ trợ, quyền vị trí, đăng xuất, chân trang.

Quản lý và Lãnh đạo đơn vị dùng cùng app này để check-in; việc duyệt làm trên web.

## Việc cần làm (sau khi duyệt)

1. App: bỏ tab Tuyến, đưa tuyến hôm nay và Đại lý gần tôi vào Hôm nay; bỏ màn đăng ký tuyến, màn chỉ tiêu, Cần duyệt, nút Thêm đại lý riêng, danh sách Đại lý tôi đề xuất, xuất Excel ở Lịch sử, nút nổi Hỗ trợ, màn Thông báo.
2. Check-in: thêm ô "Đây là đại lý mới" khi chọn Điểm khác, mở form đề xuất ngay trong bước lưu.
3. Web: kiểm tra đủ chỗ cho việc đã đưa về: đăng ký tuyến thay cho app (đã có), đăng ký chỉ tiêu (đã có), Cần duyệt (đã có), xem đại lý tôi đề xuất (cần thêm cho nhân viên), xem thông báo (đã có).
4. Máy chủ: bớt loại thông báo đẩy không còn dùng; API cũ vẫn giữ để app bản cũ chưa cập nhật không lỗi.
5. Thử trên điện thoại thật: check-in thường, mất mạng, chữ to nhất, đề xuất đại lý mới trong check-in.
6. Gửi bản cập nhật app (chỉ phần JS, không phải build lại), cập nhật slide, kịch bản demo, TASKS.

Ước lượng khoảng 1,5 buổi.

## Câu hỏi cần bạn chọn

1. Đăng ký tuyến: chỉ làm trên web (khuyên), hay giữ trên app vì nhiều CBKD không dùng máy tính?
2. Chỉ tiêu trên app: giữ một dòng % ở Hôm nay (khuyên), hay bỏ hẳn?
3. Duyệt tuyến, chỉ tiêu: chỉ trên web (khuyên), hay giữ cho Quản lý duyệt nhanh trên app?
4. Bỏ nút nổi Hỗ trợ, chỉ còn trong tab Tôi (khuyên)?
5. Lúc nào gửi lên app: trước buổi demo 27/11 (kịch bản demo phải sửa theo), hay sau demo?
