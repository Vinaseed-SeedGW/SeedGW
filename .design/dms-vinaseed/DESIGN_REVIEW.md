# Rà soát thiết kế và truy cập: Quy trình duyệt (A10)

Đối chiếu với: `DESIGN_BRIEF.md`, `INFORMATION_ARCHITECTURE.md` (mục Quy trình duyệt), `BRAND.md`
Chuẩn truy cập: WCAG 2.1 mức A và AA
Ngày: 11/11/2026
Trang: `/quan-tri/quy-trinh-duyet` (tab Theo đơn vị, tab Uỷ quyền) và `/quan-tri/quy-trinh-duyet/[donViId]` (trình sửa, Xem trước, Lịch sử phiên bản)

**Trạng thái (11/11/2026):** đã sửa mục 1 đến 7 và kiểm tra lại trên trình duyệt. Chữ cảnh báo nay đạt 19:1. Bảng uỷ quyền ở 375 px không còn cuộn ngang. Trang có đủ cấp tiêu đề h1, h2, h3. Kết quả Xem trước nằm trong vùng `aria-live`. Nút biểu tượng 44 px trên điện thoại, 32 px trên máy tính. Nút Thu hồi có tên riêng theo từng người. Các mục 8 đến 10 và phần vấn đề chung cả hệ thống chưa làm.

## Ảnh chụp

| Ảnh | Cỡ | Nội dung |
| --- | --- | --- |
| `screenshots/review-quy-trinh-chi-tiet-desktop-1440-tren.jpg` | 1440 | Trình sửa, bước có 4 điều kiện |
| `screenshots/review-quy-trinh-chi-tiet-desktop-1440-duoi.jpg` | 1440 | Nút lưu, Xem trước, Lịch sử phiên bản |
| `screenshots/review-quy-trinh-danh-sach-tablet-800.jpg` | 800 | Cây đơn vị và nguồn quy trình |
| `screenshots/review-uy-quyen-tablet-800.jpg` | 800 | Bảng uỷ quyền |
| `screenshots/review-quy-trinh-danh-sach-mobile-375.jpg` | 375 | Cây đơn vị |
| `screenshots/review-uy-quyen-mobile-375.jpg` | 375 | Bảng uỷ quyền, cột cuối bị đẩy ra ngoài |
| `screenshots/review-quy-trinh-chi-tiet-mobile-375-buoc-1.jpg` | 375 | Trình sửa, bước 1 |
| `screenshots/review-quy-trinh-chi-tiet-mobile-375-buoc-2.jpg` | 375 | Trình sửa, chuyển sang bước 2 |
| `screenshots/review-xem-truoc-ket-qua-mobile-375.jpg` | 375 | Kết quả Xem trước có uỷ quyền |

Khung trình duyệt trong buổi rà soát chỉ rộng khoảng 373 px. Vì vậy ảnh 1440 lấy từ lần chạy thử ngày 10/11, code giao diện không đổi kể từ đó. Không có giao diện tối nên không chụp chế độ tối.

## Tóm tắt

Trang đúng thương hiệu, đủ nhãn, đủ trạng thái và đi đúng thứ tự nội dung trong IA. Lỗi nặng nhất là chữ màu vàng không đọc được, cùng bảng uỷ quyền trên điện thoại giấu mất nút Thu hồi. Kết luận về truy cập: **có rủi ro cần sửa**, chưa có lỗi chặn người dùng hoàn toàn.

## Phải sửa

1. **Chữ vàng không đọc được.** Chữ `text-warning` trên nền trắng chỉ đạt 1,85:1, trên nền vàng nhạt chỉ 1,67:1, trong khi cần 4,5:1 (WCAG 1.4.3 AA). Lỗi nằm ở chữ "Chưa có quy trình" trong cây đơn vị (`workflow-unit-tree.tsx`) và nhãn "Sắp hiệu lực" (`delegations-table.tsx`). _Cách sửa: chữ màu thường `text-text` trên nền `bg-warning-soft` (19:1), trình bày dạng nhãn tròn giống các nhãn khác._
2. **Bảng uỷ quyền trên điện thoại giấu cột Trạng thái và nút Thu hồi.** Ở 375 px phải vuốt ngang mới thấy (xem `review-uy-quyen-mobile-375.jpg`). _Cách sửa: dưới 768 px gộp Từ ngày và Đến ngày thành một cột Thời gian, ẩn cột Lý do, giữ Trạng thái và Thu hồi trong khung nhìn._

## Nên sửa

3. **Thứ tự tiêu đề nhảy cấp.** Trang đi từ h1 (tên đơn vị) xuống thẳng h3 (Bước 1) (WCAG 1.3.1 A). _Cách sửa: thêm h2 "Các bước duyệt" phía trên danh sách bước._
4. **Kết quả Xem trước không được đọc lên.** Bấm Xem trước xong, trình đọc màn hình không biết đã có kết quả (WCAG 4.1.3 AA). _Cách sửa: đặt vùng kết quả trong `aria-live="polite"`._
5. **Nút biểu tượng nhỏ trên điện thoại.** Các nút lên, xuống, xoá bước và xoá điều kiện chỉ 32x32 px, dưới mức 44 px khuyến nghị cho màn cảm ứng. _Cách sửa: 44 px dưới 640 px, giữ 32 px trên máy tính._
6. **Nút "Thu hồi" mỗi dòng có cùng một tên.** Trình đọc màn hình không biết đang thu hồi uỷ quyền của ai (WCAG 2.4.6 AA). _Cách sửa: `aria-label` dạng "Thu hồi uỷ quyền của A10 ASM Hai"._
7. **Cây đơn vị: đơn vị có quy trình riêng trông giống đơn vị kế thừa.** Phải đọc từng dòng chữ mới phân biệt được (xem `review-quy-trinh-danh-sach-tablet-800.jpg`). _Cách sửa: thêm nhãn "Riêng" màu thương hiệu cho đơn vị có quy trình riêng. Dòng kế thừa giữ chữ xám._

## Có thể cải thiện

8. **Trang chi tiết rất dài trên điện thoại.** Mỗi bước khoảng 10 ô nhập, 3 bước đã dài hơn 4 màn hình, và nút Lưu nằm tận cuối. _Gợi ý: thu bước đã điền thành dòng tóm tắt bấm vào để mở, hoặc giữ thanh nút Lưu cố định ở đáy màn hình._ _Đã sửa 11/11/2026 khi chuyển sang kéo thả: các bước thu thành dòng tóm tắt, chỉ mở chi tiết một bước._
9. **Bấm "Thêm bước" không đưa con trỏ tới bước mới.** Người dùng bàn phím phải tự tìm. _Gợi ý: chuyển con trỏ vào ô Tên bước của bước vừa thêm._ _Đã sửa 11/11/2026._
10. **Ô số tiền hiện 5000000, không có dấu chấm phân cách.** Dòng gợi ý "Bằng 5.000.000 đ" đã bù lại. _Gợi ý: sau này định dạng ngay trong ô._

## Vấn đề chung của cả hệ thống, cần duyệt trước khi sửa

- **Viền ô nhập quá nhạt.** Màu `#d1d3d4` trên nền trắng chỉ đạt 1,5:1, dưới mức 3:1 (WCAG 1.4.11 AA). Lỗi có ở mọi form, không riêng trang này. Muốn sửa phải thêm một màu xám trung gian vào token, việc này cần duyệt màu. _Đã sửa 11/11/2026: `--input` dùng xám `#808285` của Guideline, đạt 3,85:1._
- **Chưa có link "Bỏ qua tới nội dung chính"** trong khung chung AppShell (WCAG 2.4.1 A). _Đã sửa 11/11/2026: có ở khung bộ phận, Hub và Tổng quan điều hành._
- **Chưa có quy tắc `prefers-reduced-motion`.** Trang gần như không có hiệu ứng chuyển động nên rủi ro thấp.

## Câu hỏi nghiệp vụ phát hiện khi rà soát

Một người có thể phải duyệt hai bước liên tiếp trong cùng một đơn. Ví dụ: Kế toán duyệt bước 1, đồng thời nhận uỷ quyền của ASM ở bước 2 (xem `review-xem-truoc-ket-qua-mobile-375.jpg`). Cần quyết: duyệt hai lần, hay bước sau tự cho qua khi người đó đã duyệt bước trước. _Đã chốt 11/11/2026: bước sau tự qua, chỉ khi hai bước liền nhau (DESIGN_BRIEF §9 mục 17)._

## Điểm làm tốt

- Màu, chữ và nhãn trạng thái đều dùng token thương hiệu, không có mã màu viết thẳng trong component.
- Mọi ô nhập và nút đều có tên đọc được: kiểm tra tự động không thấy phần tử nào thiếu nhãn.
- Lỗi hiện bằng chữ ngay dưới ô, không chỉ dựa vào màu. Nhãn trạng thái luôn có chữ đi kèm.
- Có viền khi di chuyển bằng bàn phím. Trang khai báo tiếng Việt, tiêu đề trang riêng, đủ vùng header, nav, main, footer.
- Hộp thoại dùng `dialog` có sẵn của trình duyệt nên tự giữ con trỏ trong hộp và đóng được bằng Escape.
- Thứ tự nội dung trang chi tiết đúng IA: nguồn và chuỗi bước, điều kiện, Xem trước, Lịch sử phiên bản.
- Trang không bị cuộn ngang ở 1440, 1024, 768 và 375 px. Riêng bảng uỷ quyền cuộn ngang trong khung bảng, xem mục 2.

## Chưa kiểm tra được

- Chưa thử với trình đọc màn hình thật như NVDA hay VoiceOver. Các mục 4 và 6 được suy ra từ cấu trúc trang.
- Chưa thử phóng chữ 200% và giãn khoảng cách chữ (WCAG 1.4.4, 1.4.12).
