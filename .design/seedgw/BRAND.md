# Nhận diện thương hiệu trong SeedGW

Nguồn duy nhất về logo, font và màu của phần mềm. Căn cứ: `0813 Vinaseed_Brand Guideline.pdf` (số trang là số trang của file PDF) và file `Logo chuẩn CMYK.ai`. Bản xem trực quan: [brand/brand-preview.html](brand/brand-preview.html).

**Tên sản phẩm** (quyết định 34): **SeedGW**. Viết đúng chữ S, G, W hoa, liền nhau, không thêm dấu cách. Tên đặt cạnh hoặc dưới logo Vinaseed bằng font UTM Neo Sans Intel, không ghép vào logo, không thay logo. Code lấy tên từ `APP_NAME` trong `@seedgw/config/brand`.

## 1. Logo

### File AI chứa gì

- Vector 100%, 39 hình: 9 hạt, 8 chữ cái VINASEED, dấu ® 2 hình, câu bảo trợ 20 chữ cái.
- Màu lưu trong file: hạt `#005b36`, chữ `#351800`, khớp trang 15. Tên file ghi CMYK nhưng màu lưu là RGB.
- File có câu "A MEMBER OF THE PAN GROUP", tức bản bảo trợ ở trang 69. **Phần mềm dùng bản này** (đã chốt 2026-11-09).
- Trên nền trắng, câu bảo trợ màu nâu `#351800` (trang 69). Trên nền xanh, câu này màu trắng (trang 23).
- Các bản khác màu được tạo bằng cách đổi màu tô theo trang 11 và 23, không vẽ lại đường nào.
- Chữ VINASEED trong logo là nét vẽ riêng, không phải font. Không được gõ chữ để thay logo.

### Hình học

| Thông số | Giá trị |
|---|---|
| Tỉ lệ rộng : cao | 3,98 : 1 (1222 x 307,1) |
| Biểu tượng | 16,7% chiều rộng, vuông, lưới 3 x 3 hạt |
| Khoảng cách biểu tượng và chữ | 3,9% chiều rộng |
| Chữ VINASEED | 74,3% chiều rộng |
| Dấu ® | 3,8% chiều rộng, thẳng đầu chữ |
| Câu bảo trợ | 77,8% chiều rộng, chiều cao chữ 3,9% chiều rộng, căn giữa dưới logo |
| 1 hạt | 1/18 chiều rộng |

### Các bản và nơi dùng (`brand/logo/`)

| File | Nền | Dùng ở |
|---|---|---|
| `vinaseed-logo-color.svg` | Trắng | Tiêu đề Hub, đăng nhập trên nền trắng |
| `vinaseed-logo-white.svg` | Xanh `#005b36` | Sidebar, nửa xanh trang đăng nhập, màn khởi động app, thanh tiêu đề app |
| `vinaseed-logo-bw-light.svg` | Trắng | Chứng từ in đen trắng |
| `vinaseed-symbol-green.svg` | Trắng | Favicon |
| `vinaseed-symbol-white.svg` | Xanh | Sidebar thu gọn, icon app, ảnh đại diện bot Mattermost |
| `vinaseed-logo-on-dark.svg`, `vinaseed-logo-bw-dark.svg` | Tối | Chưa dùng, có sẵn theo trang 11 |
| `vinaseed-logo-plain-color.svg`, `vinaseed-logo-plain-white.svg` | Trắng, xanh | Bản không có câu bảo trợ, giữ để tham khảo, không dùng trong phần mềm |

Mọi file `vinaseed-logo-*.svg`, trừ bản `plain`, đều đã có câu bảo trợ.

### Kích thước và vùng an toàn

- Vùng an toàn bằng chiều cao 1 hạt ở cả 4 phía (trang 13), tính từ mép ngoài gồm cả câu bảo trợ.
- Tối thiểu khi in: rộng 30 mm (trang 13).
- Tối thiểu trên màn hình: rộng 120 px (đã chốt). Hẹp hơn thì chuyển sang biểu tượng đứng riêng.
- Logo chỉ dùng 4 cỡ dưới đây, chọn qua `<Logo size="s|m|l|xl" />`, không đặt độ rộng tuỳ ý.
- Bản xem đúng kích thước thật: [brand/demo-giao-dien.html](brand/demo-giao-dien.html).

| Cỡ | Rộng | Cao | Vùng an toàn | Chữ câu bảo trợ cao | Dùng ở |
|---|---|---|---|---|---|
| S | 120 px | 30 px | 7 px | 4,6 px | Chân trang Đăng nhập và Hub, tab Tôi trên app |
| M | 160 px | 40 px | 9 px | 6,2 px | Tiêu đề Hub, sidebar, thanh tiêu đề app |
| L | 200 px | 50 px | 12 px | 7,7 px | Màn khởi động app, đăng nhập trên app |
| XL | 280 px | 70 px | 16 px | 10,8 px | Trang đăng nhập web |

Biểu tượng đứng riêng:

| Rộng | Dùng ở |
|---|---|
| 16, 32, 48 px | Favicon |
| 32 px | Sidebar thu gọn |
| 50-60% cạnh icon | Icon app, ảnh đại diện bot Mattermost |

### Không được làm (trang 12)

Kéo giãn hoặc thu hẹp, xô nghiêng, xoay, đổi tỉ lệ chữ và biểu tượng, đổi vị trí biểu tượng, dùng đường viền, đổ bóng, đổi màu, đặt trên nền thiếu tương phản hoặc ảnh phức tạp.

Áp vào phần mềm:

- Chỉ dùng component `<Logo variant=... />`, không chèn SVG rời, luôn giữ tỉ lệ bằng `viewBox`.
- Không xếp biểu tượng trên chữ, kể cả màn khởi động và icon app có chữ.
- Không đặt logo trên các mức xanh nhạt, không thêm hiệu ứng khi di chuột vào logo.
- Không làm logo chuyển động, chỉ báo đang tải dùng biểu tượng xoay riêng.
- Không bỏ dấu ®, không tách câu bảo trợ khỏi logo. Riêng chỗ chỉ đủ cho biểu tượng thì dùng biểu tượng đứng riêng.

## 2. Font

Mọi chữ dùng **UTM Neo Sans Intel**. Trang 17: tiêu đề Bold, nội dung Regular. Vinaseed đã xác nhận được phép nhúng font vào web (2026-11-09).

| Trường hợp | Nguồn | Cách dùng |
|---|---|---|
| Chữ thường | `UTMNeoSansIntel-Regular.ttf` | Mặc định, weight 400 |
| Chữ hoa | Cùng file đang dùng | `text-transform: uppercase`, không có file riêng |
| Bôi đậm | `UTMNeoSansIntel-Bold.ttf` | Tiêu đề, nút, nhãn, weight 700 |
| Nghiêng | `UTMNeoSansIntel-Italic.ttf` | Ghi chú, gợi ý |
| Nghiêng đậm | `UTMNeoSansIntel-BoldItalic.ttf` | Lưu ý quan trọng trong ghi chú |
| Gạch chân | Giao diện tự vẽ | Chỉ khi di chuột, xem bên dưới |

### Kết quả kiểm tra 4 file

- Đủ 134/134 ký tự tiếng Việt ở cả 4 file.
- Chữ số cùng độ rộng, cột số thẳng hàng mà không cần thiết lập thêm.
- Chỉ có 2 độ đậm 400 và 700. Không có Medium hay SemiBold.
- Thiếu các ký tự sau, nếu dùng trình duyệt sẽ tự lấy font khác:

| Thiếu | Thay bằng |
|---|---|
| Ký hiệu đồng (U+20AB) | `đ` hoặc `VNĐ` |
| Gạch dài (U+2013, U+2014) | `-` |
| Chấm giữa, dấu đầu dòng (U+00B7, U+2022) | Dấu phẩy hoặc biểu tượng SVG |
| Dấu nhân (U+00D7) | `x` |
| Mũi tên (U+2192) | Biểu tượng SVG |
| Nhỏ hơn hoặc bằng, lớn hơn hoặc bằng (U+2264, U+2265) | "tối đa", "từ" |
| Dấu độ (U+00B0) | "độ C" |
| Ngoặc kép góc (U+00AB, U+00BB) | Ngoặc kép thường |
| Dấu cách không ngắt (U+00A0) | Dấu cách thường |
| Dấu sổ thẳng `\|` (có trong font nhưng nét bị lỗi, tràn sang ký tự bên cạnh) | Dấu `/` hoặc dấu phẩy |

Ký hiệu © của font có nhưng rất nhỏ, chỉ cao bằng 30% cỡ chữ. Dòng bản quyền phóng riêng ký hiệu này gấp 2 lần: `font-size: 2em; line-height: 0; vertical-align: -.4em`.

### Quy tắc kỹ thuật

- `@font-face` khai báo đủ 4 kiểu, `font-synthesis: none` để trình duyệt không tự làm đậm hoặc nghiêng giả.
- Bản phát hành chuyển sang WOFF2, nạp sẵn Regular và Bold.
- Đặt `ascent-override: 99%; descent-override: 37.7%; line-gap-override: 0%` ở cả 4 kiểu. Không có dòng này chữ bị lệch xuống trong nút và ô nhập. Safari không hỗ trợ các dòng này, chữ cỡ 14 thấp hơn khoảng 2 px, vẫn đọc bình thường.
- Ánh xạ Tailwind: `font-medium` thành 400, `font-semibold` thành 700. Component shadcn phải dùng theo ánh xạ này.
- `Intl.NumberFormat('vi-VN', { style: 'currency' })` sinh ra ký hiệu đồng và dấu cách không ngắt, đều thiếu trong font. Dùng hàm chung `formatVnd()` trong `packages/contracts`, kết quả dạng `48.750.000 đ`.
- `line-height` tối thiểu 1,5 cho nội dung, 1,3 cho tiêu đề. Ô cắt chữ bằng `overflow: hidden` phải giữ đủ chiều cao để không cụt dấu.
- Thang cỡ chữ: 30, 24, 18 Bold cho tiêu đề; 14 Regular cho nội dung và bảng; 13 cho chữ phụ; 12 Bold là nhỏ nhất, chỉ dùng cho nhãn trạng thái.

### Gạch chân

- Mặc định mọi chữ không có gạch chân, kể cả liên kết.
- Gạch chân chỉ hiện khi di chuột vào phần bấm được: menu, liên kết, nút, thao tác trong bảng.
- Khi chọn bằng phím Tab cũng hiện gạch chân, kèm viền focus, để người dùng bàn phím biết đang ở đâu.
- `text-underline-offset: .24em` và `text-decoration-skip-ink: auto` để gạch không đè dấu nặng.
- App điện thoại không có di chuột, dùng đổi nền khi chạm.

### Những chỗ font không áp dụng được

| Vị trí | Cách xử lý |
|---|---|
| App điện thoại | Nạp 4 file bằng `expo-font`. React Native không tự chọn file theo `fontWeight`, phải đặt `fontFamily` theo từng kiểu qua component `<Text>` chung |
| Biểu đồ Recharts | Truyền font vào nhãn trục, chú giải, tooltip |
| PDF xuất từ hệ thống | Nhúng font vào PDF |
| File Excel | Đặt tên font trong file. Máy không cài font sẽ tự thay thế |
| Hộp thoại hệ điều hành, thông báo đẩy, tin nhắn Zalo và Mattermost | Do bên ngoài hiển thị, không kiểm soát được |

## 3. Màu

Xanh `#005b36` và trắng là chủ đạo (trang 15, 16). Tạm thời **chưa làm giao diện tối và chưa dùng màu riêng cho từng bộ phận**.

### Token

| Token | Màu | Dùng cho | Nguồn |
|---|---|---|---|
| `--brand` | `#005b36` | Sidebar, nút chính, tiêu đề, liên kết | Trang 15 |
| `--brand-hover` | `#00512d` | Nút chính khi di chuột | Trang 15 |
| `--brand-90` đến `--brand-10` | `#1a6b4a` `#337c5e` `#4d8c72` `#669d86` `#80ad9b` `#99bdaf` `#b3cec3` `#ccded7` `#e6efeb` | Nền chọn, nền nhãn, biểu đồ | Dải nhạt trang 15 |
| `--surface` | `#ffffff` | Nền chính | Trắng |
| `--surface-subtle` | `#f1f2f2` | Nền phụ | Trang 15 |
| `--border` | `#d1d3d4` | Đường kẻ, khung thẻ | Trang 15 |
| `--input` | `#808285` | Viền ô nhập, ô chọn, bộ lọc | Trang 15, đã duyệt 11/11/2026 |
| `--text` | `#000000` | Chữ chính | Trang 15 |
| `--text-muted` | `#58595b` | Chữ phụ | Ngoài bảng màu, đã duyệt |
| `--warning` | `#e8b909` | Cảnh báo, chữ đen | Trang 15 |
| `--chart-2` | `#789a3d` | Chuỗi thứ hai trong biểu đồ | Trang 15 |
| `--danger` | `#b33131` | Lỗi, vượt hạn mức | Ngoài bảng màu, đã duyệt |
| `--logo-brown` | `#351800` | Chỉ nằm trong logo | Trang 15 |

- Thang nhạt tính bằng cách trộn `#005b36` với trắng theo từng 10%, theo dải ở trang 15.
- Xám `#808285` của Guideline chỉ đạt 3,85:1 trên nền trắng, không dùng cho chữ. Đủ chuẩn 3:1 cho viền ô nhập (WCAG 1.4.11) nên dùng làm `--input`.
- Trang PDF hiển thị xanh hơi khác `#005b36` vì in theo CMYK. Phần mềm luôn dùng đúng mã HEX.

### Độ tương phản đã đo

| Cặp màu | Tỉ lệ | Chuẩn AA 4,5:1 |
|---|---|---|
| Trắng trên `#005b36` | 8,24:1 | Đạt |
| `#005b36` trên `#e6efeb` | 7,02:1 | Đạt |
| `#58595b` trên trắng | 7,01:1 | Đạt |
| `#b33131` trên trắng | 6,18:1 | Đạt |
| Đen trên `#e8b909` | 11,37:1 | Đạt |
| `#808285` trên trắng | 3,85:1 | Không đạt cho chữ, đạt chuẩn 3:1 cho viền ô nhập |

## 4. Bố cục đề xuất

- **Đăng nhập**: nửa trái xanh với logo trắng cỡ XL, nửa phải nền trắng chứa biểu mẫu.
- **Hub**: thanh trên nền trắng với logo đầy đủ màu cỡ M, 3 ô bộ phận.
- **Trong bộ phận**: sidebar xanh với logo trắng cỡ M, khi thu gọn chỉ còn biểu tượng.
- **App điện thoại**: màn khởi động xanh với logo trắng cỡ L, thanh tiêu đề xanh với logo trắng cỡ M.

## 5. Chân trang

Có ở cuối mọi trang web sau đây, nội dung cố định, chữ cỡ 13:

```text
Bản quyền © 2026 thuộc Phòng ĐMST&CĐS
Liên hệ Phòng ĐMST&CĐS: Email dmst-cds@vinaseed.com.vn, SĐT 0982109295
```

| Vị trí | Dạng |
|---|---|
| Đăng nhập, Hub | Đầy đủ: logo cỡ S, bản quyền, liên hệ |
| Trang trong bộ phận | Gọn một dòng: bản quyền, liên hệ, không có logo để giữ chỗ cho dữ liệu |
| App điện thoại | Cuối tab Tôi: logo cỡ S, bản quyền, email, SĐT. Các tab khác có thanh tab ở đáy nên không đặt |

Email mở bằng `mailto:`, SĐT mở bằng `tel:`. Thông tin này đặt tại một chỗ trong `packages/config`.

## 6. Cần xác nhận

| # | Việc | Người xác nhận |
|---|---|---|
| 1 | Cho phép dùng biểu tượng đứng riêng làm icon app và favicon. Trang 15 có dùng, nhưng trang 11-13 không quy định | Khối Marketing & PTSP |
| 2 | Logo trên nền nâu: trang 11 hạt xanh, trang 15 toàn trắng. Chưa ảnh hưởng vì phần mềm không dùng nền nâu | Khối Marketing & PTSP |
