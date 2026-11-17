# Information Architecture: DMS Vinaseed

Ngày: 2026-11-09, cập nhật 2026-11-13 · Dựa trên: DESIGN_BRIEF.md · Task tương ứng: TASKS.md v4

> **Cập nhật 14/11/2026 (quyết định 30):** bỏ bộ phận Trao đổi, Hub còn **Kinh doanh, Quản trị**. Hỗ trợ chia theo vai trò: trên web, Cán bộ nhân viên dùng **nút nổi Hỗ trợ** ở góc dưới bên phải mọi trang; Quản trị đơn vị và Quản trị hệ thống xử lý ở trang **Quản trị › Hỗ trợ** `/quan-tri/ho-tro`. Trên app, Hỗ trợ là một màn hình riêng mở từ tab Tôi.
>
> **Cập nhật 14/11/2026 (quyết định 29):** Trao đổi chỉ còn giữa CBNV và quản trị, gộp Tin nhắn và Báo lỗi thành một trang **Hỗ trợ** `/trao-doi/ho-tro`.
>
> **Cập nhật 13/11/2026 (quyết định 28):** bỏ bộ phận CSKH, thêm bộ phận **Trao đổi** (tin nhắn nội bộ, báo lỗi hệ thống); còn 3 vai trò Quản trị hệ thống, Quản trị đơn vị, Cán bộ nhân viên, chức danh ghi ở hồ sơ tài khoản; đại lý đồng bộ 2 chiều với FAST, có trang Đồng bộ FAST trong Quản trị.
>
> **Cập nhật 13/11/2026 (DESIGN_BRIEF quyết định 27):** đợt này không làm đơn hàng. Đã bỏ khỏi cấu trúc: Cần duyệt, Đơn hàng, Tạo đơn, Tồn kho, Đồng bộ FAST (đơn hàng), Sản phẩm, Kho, Bảng giá, Quy trình duyệt, tab Đơn hàng trên app. FAST chỉ dùng để đọc công nợ đại lý và doanh số Thực bán. Dashboard tính từ check-in, đại lý và Thực bán.

Tài liệu này là **nguồn duy nhất** về cấu trúc trang, điều hướng, tên gọi và chỉ số dashboard. Brief và Tasks tham chiếu về đây.

## 0. Quyết định cấu trúc

| Câu hỏi | Quyết định |
|---|---|
| Sau đăng nhập đi đâu? | **Luôn qua Hub**, kể cả người chỉ có quyền 1 bộ phận. Ngoại lệ: bấm link từ thông báo/Mattermost thì tới thẳng trang đó (chưa đăng nhập → đăng nhập → tới trang đó). |
| Hub có mấy bộ phận? | **2**: Kinh doanh · Quản trị (quyết định 30). Hỗ trợ không phải bộ phận: nhân viên dùng nút nổi, quản trị dùng trang trong Quản trị. "Tổng quan điều hành" là lối vào riêng cho người có quyền, không phải bộ phận thứ 4. |
| Menu sâu mấy cấp? | **Tối đa 2 cấp** trong bộ phận: nhóm (chỉ là nhãn, không bấm được) → trang. Chi tiết của một đối tượng dùng **tab**, không thêm cấp menu. |
| Dashboard đặt ở đâu? | `/tong-quan` cho người được cấp quyền; Dashboard trong Kinh doanh; thống kê yêu cầu hỗ trợ trong Quản trị › Hỗ trợ. Mỗi người chỉ thấy số trong phạm vi của mình. |
| "Số lượng hàng bán" tính thế nào? | Chỉ có *Thực bán* (hoá đơn trên FAST, trừ hàng trả lại). Đợt này không có Đặt hàng. |
| Có chỉ tiêu kế hoạch không? | **Có**: giao theo kỳ × đơn vị hoặc nhân viên × nhóm sản phẩm; dashboard hiện % hoàn thành. |

### Việc chính theo tần suất và trang dùng nhiều nhất

| Vai trò | Việc thường xuyên nhất (giảm dần) | Trang dùng ~80% thời gian |
|---|---|---|
| Cán bộ nhân viên | Check-in đại lý, khách hàng, điểm khác → xem tuyến hôm nay → gửi yêu cầu hỗ trợ khi vướng → xem chỉ tiêu của mình | **Hôm nay** (app điện thoại) |
| Quản trị đơn vị | Xem báo cáo ghé thăm → duyệt toạ độ, đại lý mới → lập tuyến → xử lý yêu cầu hỗ trợ của đơn vị → tài khoản trong đơn vị | **Check-in** |
| Quản trị hệ thống | Tài khoản, vai trò → danh mục đại lý, đồng bộ FAST → yêu cầu hỗ trợ được chuyển lên → tham số, kết nối | **Tài khoản** |

## 1. Site Map (web)

Trang có dấu `*` là bổ sung so với plan trước.

- Đăng nhập `/login`
  - Quên mật khẩu* `/quen-mat-khau`
  - Đổi mật khẩu lần đầu* `/doi-mat-khau`
  - Đồng ý chia sẻ vị trí* `/dong-y-vi-tri` (sau đăng nhập, khi chưa đồng ý bản câu chữ hiện tại)
- **Hub** `/hub`
- **Tổng quan điều hành*** `/tong-quan`
- Thông báo* `/thong-bao`
- Tài khoản của tôi* `/toi`
- Không có quyền* `/403`

- **Kinh doanh** `/kinh-doanh` (chuyển tới trang đích theo vai trò)
  - Tổng quan
    - Dashboard `/kinh-doanh/dashboard`
  - Đối tác
    - Chỉ tiêu* `/kinh-doanh/chi-tieu`
    - Đại lý `/kinh-doanh/dai-ly`
      - Hồ sơ đại lý `/kinh-doanh/dai-ly/[id]` (tab: Thông tin · Công nợ · Viếng thăm · Phản hồi)
    - Khách hàng `/kinh-doanh/khach-hang`
      - Hồ sơ khách hàng `/kinh-doanh/khach-hang/[id]`
  - Thị trường
    - Tuyến viếng thăm `/kinh-doanh/tuyen-vieng-tham`
    - Check-in `/kinh-doanh/check-in` (báo cáo ghé thăm, chỉ xem: danh sách, ảnh, km theo đường đi và theo GPS, xuất Excel theo mẫu cự ly di chuyển, bản đồ hành trình theo ngày, cờ nghi vấn)
  - Đối soát
    - Báo cáo `/kinh-doanh/bao-cao`


- **Quản trị** `/quan-tri` (Quản trị đơn vị vào Hỗ trợ, Quản trị hệ thống vào Tài khoản)
  - Tiếp nhận
    - Hỗ trợ `/quan-tri/ho-tro`, chi tiết: `/quan-tri/ho-tro/[ma]`
  - Người dùng
    - Tài khoản `/quan-tri/tai-khoan`, chi tiết: `/quan-tri/tai-khoan/[id]`
    - Vai trò và quyền `/quan-tri/vai-tro`
    - Cơ cấu tổ chức `/quan-tri/co-cau-to-chuc`
  - Danh mục
    - Đại lý `/quan-tri/dai-ly`, hồ sơ: `/quan-tri/dai-ly/[id]`, nhập từ DMS cũ: `/quan-tri/dai-ly/nhap-excel`, đồng bộ: `/quan-tri/dai-ly/dong-bo-fast` (nút Đồng bộ FAST, lịch sử, dòng lỗi, gửi lại)
    - Duyệt toạ độ `/quan-tri/dai-ly/duyet-toa-do` (tab: Chờ duyệt · Đã xử lý; đề xuất toạ độ từ lần check-in đầu tại đại lý chưa có toạ độ, kèm ảnh, địa chỉ lúc chụp, cùng phố hay khác phố)
  - Quy định
    - Lịch vụ* `/quan-tri/lich-vu` (Đông Xuân, Hè Thu, Vụ Mùa… dùng làm kỳ báo cáo)
    - Tham số `/quan-tri/tham-so`
  - Hệ thống
    - Kết nối `/quan-tri/ket-noi` (FAST: đại lý hai chiều, công nợ và Thực bán chỉ đọc · Mattermost, kèm trạng thái và lỗi đồng bộ gần nhất)
    - Nhật ký `/quan-tri/nhat-ky`

- **API (không có giao diện)**
  - Cho FAST/HRM: `/api/v1/*`, tài liệu: `/api/docs`
  - Cho app điện thoại: `/api/mobile/*`
  - Webhook: `/api/webhooks/zalo`, `/api/webhooks/mattermost`

### Site Map app điện thoại

- Đăng nhập / Đăng ký thiết bị
- Tab **Hôm nay**: nút Check-in (mở máy ảnh trong app) · Đại lý gần tôi · trạng thái ghi hành trình kèm nút Kết thúc ngày · điểm cần thăm (tuyến đã duyệt, chưa có tuyến thì đại lý gần nhất chưa ghé) · chỉ tiêu tháng của tôi (K3a) · số check-in chờ gửi
- Tab **Tuyến**: tuyến đã duyệt hôm nay, nút Chỉ đường mở Google Maps (S8) · đăng ký tuyến tuần hoặc ngày, gửi duyệt (S8) · đại lý tôi phụ trách, gần tôi → Check-in · Thêm đại lý (M10)
- Tab **Lịch sử**: toàn bộ check-in của tôi (18 tháng, ảnh 45 ngày) theo tháng và ngày, ảnh, ghi chú, km từng chặng, tổng km trong ngày, xuất Excel. Có mạng lấy từ máy chủ, mất mạng lấy trên máy, lượt chưa gửi gắn nhãn Chờ gửi
- Tab **Tôi**: hồ sơ, thiết bị, Hỗ trợ, quyền vị trí, rút lại đồng ý chia sẻ vị trí, đăng xuất, thông tin kỹ thuật, chân trang. Quản lý và Lãnh đạo đơn vị có thêm mục Cần duyệt (A10b)

### Quy tắc "một hồ sơ, nhiều lối vào"

Trong plan trước, đại lý xuất hiện ở cả Kinh doanh và Quản trị mà không rõ quan hệ. Quy tắc mới:

| Đối tượng | Lối vào | Khác nhau ở |
|---|---|---|
| Đại lý | Kinh doanh (làm việc hằng ngày) · Quản trị (quản lý danh mục) | Quản trị có thêm: gộp trùng, gán nhân viên hàng loạt, nhập Excel, tab Đồng bộ FAST |
| Khách hàng | Kinh doanh | Một lối vào trong đợt này |

Dữ liệu chỉ có một bản; mọi lối vào dùng chung component `DealerProfile` / `CustomerProfile`. URL theo bộ phận đang đứng để menu trái luôn đúng ngữ cảnh. Quyền kiểm tra theo từng trang và từng thao tác, không chỉ theo bộ phận.

## 2. Navigation Model

- **Cấp 0 — Hub**: 3 ô bộ phận (ẩn ô không có quyền) + lối vào Tổng quan điều hành (nếu có quyền).
- **Điều hướng chính**: menu trái của từng bộ phận. Kinh doanh 7 trang chia 4 nhóm; Quản trị 9 trang chia 5 nhóm (thêm nhóm Tiếp nhận có trang Hỗ trợ). Nhóm là nhãn cố định, không thu gọn được, để người dùng luôn thấy đủ.
- **Điều hướng phụ**: tab trong trang chi tiết. Breadcrumb từ cấp bộ phận.
- **Điều hướng tiện ích** (thanh trên): chuyển bộ phận (quay về Hub hoặc sang bộ phận khác) · tìm kiếm Ctrl+K · chuông thông báo · tài khoản của tôi.
- **Hiển thị có điều kiện**: mục nào không có quyền thì ẩn hẳn. Badge số việc chờ trên nút nổi Hỗ trợ (trả lời chưa đọc, với nhân viên), trên Quản trị › Hỗ trợ (yêu cầu chờ xử lý) và toạ độ, đại lý mới chờ duyệt.
- **Web trên điện thoại/tablet**: dưới 1024px menu trái thành ngăn kéo. Quản trị › Hỗ trợ 2 cột thu thành 1 cột theo bước (danh sách yêu cầu → chi tiết và trao đổi). Nút nổi Hỗ trợ dời sát góc (cách mép 16 px), trang chừa khoảng trống cuối để nút không che chân trang. Bảng dữ liệu ẩn bớt cột phụ.
- **App điện thoại**: 4 tab dưới cùng (Hôm nay, Tuyến, Lịch sử, Tôi); màn hình **Hỗ trợ** riêng mở từ đầu tab Tôi, tab Tôi có số đỏ khi quản trị trả lời; không dùng nút nổi vì che camera và bản đồ; không có menu trái, không có Hub (app chỉ phục vụ công việc ngoài thị trường).

### Trang đích khi bấm ô bộ phận

| Vai trò | Kinh doanh | Quản trị | Hỗ trợ |
|---|---|---|---|
| Cán bộ nhân viên | Dashboard (số của tôi) | không có | Nút nổi ở mọi trang web, màn hình Hỗ trợ trên app |
| Quản trị đơn vị | Check-in | Hỗ trợ (hộp chung của đơn vị) | Trang Quản trị › Hỗ trợ |
| Quản trị hệ thống | Dashboard | Tài khoản | Trang Quản trị › Hỗ trợ (yêu cầu được chuyển lên) |

## 3. Dashboard và chỉ số

### 3.1 Bộ lọc chung

Kỳ (ngày · tuần · tháng · quý · **vụ** · năm · tuỳ chọn) · đơn vị · nhân viên · cấp đại lý · nhóm sản phẩm (chỉ cho Thực bán). Bộ lọc nằm trên URL để gửi link được. Phạm vi dữ liệu tự áp theo vai trò ở phía máy chủ.

Mọi khối số hiện **"cập nhật lúc hh:mm"**. Mọi khối bấm được để đi tới danh sách đã lọc tương ứng.

### 3.2 Dashboard Kinh doanh `/kinh-doanh/dashboard`

| Khu vực | Nội dung |
|---|---|
| **Hàng số chính** | Số lượt ghé thăm · **Độ phủ đại lý** (đại lý được ghé ÷ đại lý đang hoạt động) · Nhân viên đã check-in hôm nay · Tổng km đi thị trường · Doanh số Thực bán và % chỉ tiêu (khi nối FAST) |
| **Thị trường** | Lượt ghé thăm theo ngày, tuần, tháng · theo loại điểm (đại lý, khách hàng, điểm khác) · tỉ lệ hoàn thành tuyến · km bình quân mỗi lượt · check-in có cờ nghi vấn |
| **Đại lý** | **Đại lý lâu chưa ghé thăm quá N ngày** · đại lý chưa có toạ độ · đại lý chưa gán nhân viên · độ phủ theo vùng và theo cấp |
| **Nhân viên** | Bảng xếp hạng theo số lượt, độ phủ, km · nhân viên chưa check-in trong ngày làm việc |
| **Thực bán và công nợ** (khi nối FAST) | Thực bán theo tháng và vụ so với chỉ tiêu và cùng kỳ · theo nhóm sản phẩm · top đại lý · tổng công nợ · đại lý vượt hạn mức |

Theo vai trò: **Cán bộ nhân viên** thấy số của mình và đại lý mình phụ trách. **Quản trị đơn vị** thấy đơn vị và đơn vị con, có thêm bảng xếp hạng nhân viên. **Quản trị hệ thống** thấy toàn công ty và so sánh giữa các đơn vị.

### 3.3 Tổng quan điều hành `/tong-quan`

Một màn hình, không cuộn trên màn 1440px: Độ phủ đại lý · Lượt ghé thăm · Nhân viên đã check-in hôm nay · Thực bán so với chỉ tiêu · Công nợ · Yêu cầu hỗ trợ quá hạn; so sánh các đơn vị; danh sách **"Cần chú ý"** (vùng độ phủ thấp, đại lý lâu chưa ghé, đại lý vượt hạn mức, lỗi đồng bộ FAST kéo dài, Báo lỗi mức chặn công việc quá hạn).

### 3.5 Định nghĩa chỉ số

| Chỉ số | Cách tính | Nguồn | Độ mới |
|---|---|---|---|
| Số lượt ghé thăm | Số check-in trong kỳ và phạm vi đang chọn, theo giờ chụp ảnh | DMS | Gần như tức thì |
| Độ phủ đại lý | Số đại lý **khác nhau** có ≥ 1 check-in trong kỳ ÷ số đại lý đang hoạt động trong phạm vi | DMS | ≤ 15 phút |
| Đại lý lâu chưa ghé thăm | Đại lý đang hoạt động, check-in gần nhất cách quá N ngày (N đặt ở Tham số) | DMS | ≤ 15 phút |
| Tổng km đi thị trường | Tổng Khoảng cách (km) theo đường đi; chưa có thì dùng Khoảng cách theo GPS | DMS | ≤ 15 phút |
| Tỉ lệ hoàn thành tuyến | Điểm đã check-in ÷ điểm trong kế hoạch | DMS | ≤ 15 phút |
| Sản lượng thực bán | Số lượng trên hoá đơn bán **trừ hàng trả lại**, quy ra kg, theo ngày hoá đơn | FAST | Theo chu kỳ đồng bộ (15 đến 60 phút) |
| Doanh thu thực bán | Tiền hàng sau chiết khấu, chưa VAT, trừ hàng trả lại | FAST | Như trên |
| % hoàn thành chỉ tiêu | Thực bán ÷ Chỉ tiêu của kỳ và phạm vi đang chọn | FAST + DMS | Như trên |

Quy tắc tính:
- Số liệu gắn với **đơn vị và nhân viên tại thời điểm phát sinh** (check-in lưu đơn vị lúc check-in), nên đổi vùng hay đổi người phụ trách không làm sai số quá khứ.
- *Thực bán* phụ thuộc FBO cung cấp dữ liệu hoá đơn. Không có API thì tạm nhập file Excel xuất từ FAST.

## 4. Content Hierarchy

### Hub
1. Ô bộ phận kèm số việc chờ — mục đích chính của trang là chọn nơi làm việc
2. Lối vào Tổng quan điều hành (nếu có quyền) — lãnh đạo vào số liệu nhanh nhất
3. Việc cần làm của tôi — đơn chờ duyệt, phiếu được giao
4. Thông báo gần đây — thông tin phụ

### Hồ sơ đại lý
1. Mã, tên, trạng thái đồng bộ, nhân viên phụ trách
2. Công nợ / hạn mức và sản lượng kỳ này
3. Tab chi tiết

### Dashboard Kinh doanh
1. Hàng số chính — trả lời "kỳ này thế nào"
2. Biểu đồ Thực bán so với Chỉ tiêu và Cùng kỳ — trả lời "đang đi đúng hướng không"
3. Đại lý cần chú ý và top đại lý — chỗ có thể hành động
4. Đơn hàng, công nợ, thị trường

### Báo cáo ghé thăm (Check-in)
1. Bộ lọc: khoảng ngày, nhân viên, đơn vị, loại điểm. Nút Xuất Excel
2. Bảng check-in theo cột của mẫu Excel cự ly di chuyển, thêm Tên đại lý và Ghi chú; cờ nghi vấn; ảnh khi chọn dòng
3. Tổng số lượt và tổng km theo bộ lọc
4. Bản đồ các điểm của một nhân viên trong một ngày, nối theo thứ tự giờ

### Hôm nay (app điện thoại)
1. Nút Check-in — việc chính khi đi thị trường
2. Điểm cần thăm tiếp theo
3. Chỉ tiêu tháng của tôi
4. Số check-in chờ gửi

## 5. User Flows

### Đăng nhập và vào việc
1. Người dùng đăng nhập → tới Hub.
   - Lần đầu → đổi mật khẩu trước.
   - Chưa đồng ý chia sẻ vị trí → trang đồng ý; Không đồng ý vẫn vào web, không hỏi lại trong phiên.
2. Hub hiện ô bộ phận được phép và số việc chờ.
3. Bấm ô → tới trang đích theo vai trò.
   - Từ link thông báo → bỏ qua Hub, tới thẳng đối tượng.

### Đề xuất đại lý mới
1. Nhân viên đề xuất đại lý mới trên app tại chỗ: tên, số điện thoại, địa chỉ, toạ độ, ảnh.
   - App mất mạng → lưu trên máy, có mạng mới gửi.
2. Hệ thống kiểm tra trùng số điện thoại, mã số thuế với danh mục.
3. Quản trị đơn vị duyệt đề xuất → hệ thống cấp mã theo dải `DL` và tạo khách hàng trên FAST đúng mã đó (đồng bộ 2 chiều).
   - FAST không cho ghi qua API → kế toán tạo tay trên FAST, lần đồng bộ sau tự ghép theo mã.
4. Đại lý mới hiện trong danh mục với toạ độ và ảnh từ đề xuất.

### Check-in và báo cáo ghé thăm
1. App: bấm Check-in → máy ảnh trong app mở, khung ngắm hiện giờ và vị trí → chụp → chọn Đại lý, Khách hàng (gợi ý điểm gần nhất) hoặc Điểm khác (tự đặt tên).
   - Cách thứ hai: bấm **Đại lý gần tôi** → danh sách đại lý mình phụ trách, gần nhất lên đầu, có số mét → bấm một đại lý → máy ảnh mở với đại lý đã chọn sẵn.
   - Từ lượt check-in đầu ngày, app ghi hành trình 5 giây một lần cho tới khi bấm Kết thúc ngày hoặc tới giờ tự dừng.
2. Nhân viên nhập Ghi chú (bắt buộc nếu không tại đại lý) → lưu trên máy → gửi khi có mạng.
   - Đại lý, khách hàng ngoài bán kính → bắt nhập lý do, gắn cờ, vẫn ghi nhận.
   - Đại lý chưa có toạ độ → so tên phố trong địa chỉ lúc chụp với địa chỉ trong danh mục, khác phố thì gắn cờ; lần check-in đầu tạo đề xuất toạ độ, Quản trị đơn vị duyệt ở Quản trị › Duyệt toạ độ.
   - Gõ tên tay đúng tên một đại lý mình phụ trách → máy chủ tự gắn đại lý.
3. Máy chủ lấy địa chỉ và tính km từ điểm check-in trước trong cùng ngày, theo đường đi thực tế và theo GPS.
4. Nhân viên xem lịch sử của mình trên app; quản lý xem nhân viên mình quản lý ở Báo cáo ghé thăm.
5. Lọc theo ngày, nhân viên, đơn vị → xuất Excel → kế toán đơn vị dùng để tính công.

### Giao chỉ tiêu và theo dõi
1. Người có quyền tạo chỉ tiêu theo kỳ (tháng/vụ) tại `/kinh-doanh/chi-tieu`: nhập tay hoặc Excel.
2. Phân bổ Miền → Vùng → Nhân viên.
   - Tổng cấp con khác cấp cha → cảnh báo chênh lệch.
3. Dashboard và app hiện % hoàn thành.
4. Quản trị hệ thống thấy đơn vị dưới chỉ tiêu trong "Cần chú ý" → bấm vào → Dashboard đã lọc vùng đó → danh sách đại lý lâu chưa ghé thăm.

## 6. Naming Conventions

| Khái niệm | Nhãn trên giao diện | Ghi chú |
|---|---|---|
| Không gian làm việc cấp Hub | **Bộ phận** | Chỉ 2: Kinh doanh, Quản trị |
| Trao đổi giữa CBNV và quản trị | **Hỗ trợ**, mỗi lần gửi là một **Yêu cầu** | Loại: Hỏi đáp, Báo lỗi, Góp ý. Không gọi là "ticket" |
| Quản trị chuyển yêu cầu cho cấp trên | **Chuyển lên** | |
| Ba vai trò | **Quản trị hệ thống**, **Quản trị đơn vị**, **Cán bộ nhân viên** | Chức danh là thông tin hồ sơ, không phải vai trò |
| Miền/Vùng/Khu vực trong cơ cấu | **Đơn vị** | Không gọi là "bộ phận" |
| Bên mua và nhận hoá đơn, có mã FAST | **Đại lý** | Có trường Loại: Cấp 1, Cấp 2, Tổ chức |
| Mã KH trên FAST | **Mã đại lý** | Một mã duy nhất |
| Mã ở DMS cũ | **Mã cũ** | Chỉ để tra cứu |
| Nông dân, HTX, hộ không có mã FAST | **Khách hàng** | Không dùng từ này cho đại lý |
| Giao dịch bán | **Đơn hàng** | Không viết tắt là "đơn" trong nhãn |
| Ghi nhận có mặt tại một điểm | **Check-in** | Điểm là Đại lý, Khách hàng hoặc Điểm khác |
| Nơi check-in không phải đại lý hay khách hàng | **Điểm khác** | Nhân viên tự đặt tên điểm |
| Việc đã làm hoặc lý do tại điểm | **Ghi chú** | Bắt buộc nếu không check-in tại đại lý |
| Quãng đường từ điểm check-in trước theo đường thật | **Khoảng cách (km)** | Theo mẫu Excel cự ly di chuyển |
| Độ dài vết GPS từ điểm trước | **Khoảng cách theo GPS (km)** | |
| Trang check-in trên web | **Báo cáo ghé thăm** | Đường dẫn vẫn là `/kinh-doanh/check-in` |
| Yêu cầu của khách cần xử lý | **Phiếu** | Để tham khảo, chưa làm trong đợt này (quyết định 28) |
| Chuỗi tin với một khách | **Hội thoại** | |
| Mục tiêu được giao | **Chỉ tiêu** | Luôn là con số kế hoạch |
| Thước đo hiển thị | **Chỉ số** | Không gọi là "KPI" trên giao diện |
| Hoá đơn FAST trừ hàng trả lại | **Thực bán** | |
| Khối lượng | **Sản lượng** | Đơn vị kg/tấn |
| Mùa vụ làm kỳ báo cáo | **Vụ** | |
| Đại lý có ít nhất một check-in trong kỳ | **Đã ghé thăm** | Tỉ lệ trên tổng đại lý gọi là **Độ phủ** |

## 7. Component Reuse Map

| Component | Dùng ở | Khác biệt |
|---|---|---|
| `AppShell` (compound) | Mọi trang sau Hub | Menu theo bộ phận truyền qua `children`; màu chung theo `BRAND.md` |
| `HubLayout` | Hub | Không có menu trái |
| `AppFooter` | Mọi trang web | Dạng đầy đủ ở Đăng nhập và Hub, dạng gọn trong bộ phận. Xem `BRAND.md` §5 |
| `ExecutiveShell` | `/tong-quan` | Thanh trên + nút về Hub, không menu trái |
| `DataTable` (compound) | Mọi danh sách | Cột, bộ lọc, thao tác theo trang |
| `FormSheet` / `FormPage` | Form ngắn / form dài | Hai variant tường minh |
| `DealerProfile` | Kinh doanh, Quản trị | Tab theo quyền và lối vào |
| `CustomerProfile` | Kinh doanh | |
| `DashboardGrid`, `MetricTile`, `ChartCard`, `DashboardFilters` | 3 dashboard và Báo cáo | Khối theo vai trò; mỗi khối một `<Suspense>` |
| `SyncBadge` | Đại lý, Kết nối | Trạng thái đồng bộ từ FAST |
| `MapView` / `MapPicker` | Check-in, Hồ sơ đại lý | Tải bằng `next/dynamic` |
| `SupportButton` | Mọi trang web của Cán bộ nhân viên (Hub và các bộ phận) | Không hiện với người có quyền xử lý; không có trên trang đăng nhập |
| `SupportThread` (compound) | Khung của nút nổi, trang Quản trị › Hỗ trợ, màn hình Hỗ trợ trên app | Thu thành 1 cột dưới 1024px |

## 8. Content Growth Plan

| Nội dung | Tốc độ tăng | Cách xử lý |
|---|---|---|
| Check-in, Yêu cầu hỗ trợ | Liên tục | Phân trang phía máy chủ, mặc định lọc kỳ gần nhất, có tìm kiếm |
| Ảnh check-in (~90–180 GB/năm) | Liên tục | Nén trên máy; chính sách lưu ảnh gốc theo thời hạn cần chốt |
| Tin trao đổi trong yêu cầu | Liên tục | Tải dần khi cuộn; tự xoá sau 18 tháng như check-in |
| Số liệu dashboard | Liên tục | Bảng tổng hợp theo ngày, không tính trực tiếp từ dữ liệu gốc |
| Nhật ký hệ thống, nhật ký đồng bộ | Liên tục, nhanh | Chia bảng theo tháng; giữ ngắn hạn phần nội dung request |
| Đại lý, Khách hàng | Vừa | Tìm không dấu, lọc đơn vị, phạm vi theo vai trò |
| Sản phẩm, Kho, Vai trò, Ca | Gần như cố định | Không cần xử lý đặc biệt |
| Bộ phận trên Hub | Có thể thêm | Hub đọc cấu hình, thêm bộ phận không phải sửa bố cục |
| Trang trong Kinh doanh | Có thể thêm | Thêm vào nhóm sẵn có; quá 5 trang một nhóm thì tách nhóm |

## 9. URL Strategy

- Mẫu: `/{bo-phan}/{tai-nguyen}/{dinh-danh}`; tiếng Việt không dấu, chữ thường, nối bằng `-`.
- Trang tạo mới: `/tao-moi` (từ khoá dành riêng, mã không được trùng).
- Định danh: Yêu cầu hỗ trợ (và Đơn hàng, Phiếu ở đợt sau) dùng **mã** (`[ma]`) vì mã không đổi và dễ đọc qua điện thoại. Đại lý, Khách hàng, Tài khoản dùng **`[id]`** vì mã đại lý có thể đổi nếu phải dùng phương án dự phòng.
- Tham số truy vấn: `?q=` tìm kiếm · `?trang=` · `?sap-xep=` · `?tab=` · dashboard: `?ky=2026-11` hoặc `?ky=vu-dong-xuan-2026`, `?don-vi=`, `?nhom=`, `?nguon=dat-hang|thuc-ban`.
- Mọi trạng thái lọc nằm trên URL để gửi link và tải lại đúng trạng thái.
- API đánh số phiên bản qua đường dẫn (`/api/v1`); thay đổi phá vỡ tương thích → `/api/v2`.
