# Rà giao diện SeedGW (Đợt 0)

Rà ngày 25/11/2026 trên máy dev, tài khoản Quản trị hệ thống, ở 1024 px và 375 px, theo bộ quy tắc của skill ui-ux-pro-max (không chạy được công cụ tra cứu của skill vì máy không có Python, nên dùng thẳng danh sách quy tắc và danh sách kiểm tra). Màu, font giữ theo BRAND.md.

## Đo tràn ngang ở 375 px

27 trang trong menu, cả Hub, Thông báo, Thêm khách hàng: không trang nào tràn ngang (chiều rộng trang bằng 375).

## Đã sửa trong lượt này

| Vấn đề | Nơi | Cách sửa |
|---|---|---|
| Danh sách có 9 ô lọc xếp lởm chởm, chiếm hết màn hình đầu trên điện thoại | Mọi bảng dùng `DataTable` | Dưới 768 px gọn lại sau nút Bộ lọc kèm số bộ lọc đang bật; mở ra thì xếp 2 cột đều |
| Câu báo bảng trống nằm trong vùng cuộn ngang, bị cắt mất chữ | Mọi bảng dùng `DataTable` | Đưa câu báo ra ngoài vùng cuộn |
| Đường dẫn vị trí trên thanh trên chỉ còn "H..." ở 375 px | Thanh trên các bộ phận | Ẩn dưới 640 px, tên bộ phận vẫn hiện ở nút chuyển bộ phận |
| Tổng quan điều hành thiếu ô tìm nhanh và chuông thông báo | `/tong-quan` | Thêm như các trang khác |
| Bảng Khách hàng chật ở 1024 px, cột cây trồng xuống dòng từng chữ | `/kinh-doanh/khach-hang` | Cột Đại lý hay mua, Phụ trách hiện từ 1280 px; cột cây trồng rộng tối thiểu |
| Ô Người phụ trách có cả "Tôi phụ trách" lẫn tên mình | Thêm, sửa khách hàng | Bỏ tên mình khỏi danh sách |
| Bộ lọc Dashboard xếp so le trên điện thoại | `/kinh-doanh/dashboard` | Lưới 2 cột, ô chọn rộng đều |

## Còn lại, làm ở Đợt 2

| Ưu tiên | Vấn đề | Nơi |
|---|---|---|
| Cao | Chưa có mẫu đầu trang thống nhất (tiêu đề, mô tả, nút chính, khoảng cách) | Mọi trang |
| Cao | Trạng thái trống chỉ là một dòng chữ, chưa có hướng dẫn bước tiếp theo | Bảng danh sách |
| Cao | App: chưa rà được trên điện thoại thật (vùng bấm, cỡ chữ lớn, vùng an toàn) | App Expo |
| Vừa | Nhãn trạng thái ở các trang dùng màu, cỡ chưa đồng nhất | Check-in, Hỗ trợ, Cần duyệt, Đại lý mới |
| Vừa | Thẻ chỉ số Dashboard, Tổng quan chưa có dấu tăng giảm bằng biểu tượng, chỉ có chữ | Dashboard, Tổng quan |
| Vừa | Form dài chưa có tóm tắt lỗi khi gửi nhiều lỗi | Tài khoản, Đại lý, Tham số |
| Thấp | Chữ "Đăng xuất" chiếm chỗ trên thanh trên ở điện thoại | Thanh trên |

## Đã thử chức năng Đợt 1 trên trình duyệt

- Hub: số chờ và mục Việc cần làm, khối Tổng quan điều hành, Thông báo gần đây.
- Ctrl+K: mở, gõ tìm ra đại lý theo phạm vi, Esc đóng.
- Khách hàng: thêm (số điện thoại tự chuẩn hoá, chọn đại lý hay mua), sửa cây trồng, lọc theo cây trồng; nhật ký ghi đủ Thêm và Sửa.
- Thông báo: trang trống hiện đúng. Chưa thử khi có thông báo vì tài khoản dev chưa nhận thông báo nào.
- Truy cập chéo (đăng nhập thay KD001): hồ sơ khách hàng của người khác ra 404, trang tài khoản ra 403, ô Người phụ trách chỉ có chính mình.
