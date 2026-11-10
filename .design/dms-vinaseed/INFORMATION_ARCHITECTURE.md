# Information Architecture: DMS Vinaseed

Ngày: 2026-11-09 · Dựa trên: DESIGN_BRIEF.md v3 · Task tương ứng: TASKS.md v3

Tài liệu này là **nguồn duy nhất** về cấu trúc trang, điều hướng, tên gọi và chỉ số dashboard. Brief và Tasks tham chiếu về đây.

## 0. Quyết định cấu trúc

| Câu hỏi | Quyết định |
|---|---|
| Sau đăng nhập đi đâu? | **Luôn qua Hub**, kể cả người chỉ có quyền 1 bộ phận. Ngoại lệ: bấm link từ thông báo/Mattermost thì tới thẳng trang đó (chưa đăng nhập → đăng nhập → tới trang đó). |
| Hub có mấy bộ phận? | **3**: Kinh doanh · CSKH · Quản trị. "Tổng quan điều hành" là lối vào riêng cho người có quyền, không phải bộ phận thứ 4. |
| Menu sâu mấy cấp? | **Tối đa 2 cấp** trong bộ phận: nhóm (chỉ là nhãn, không bấm được) → trang. Chi tiết của một đối tượng dùng **tab**, không thêm cấp menu. |
| Dashboard đặt ở đâu? | `/tong-quan` cho lãnh đạo; Dashboard riêng trong Kinh doanh và CSKH. Mỗi người chỉ thấy số trong phạm vi của mình. |
| "Số lượng hàng bán" tính thế nào? | **Hai chỉ số tách rõ**: *Đặt hàng* (đơn đã duyệt trên DMS) và *Thực bán* (hoá đơn trên FAST, trừ hàng trả lại). |
| Có chỉ tiêu kế hoạch không? | **Có**: giao theo kỳ × đơn vị hoặc nhân viên × nhóm sản phẩm; dashboard hiện % hoàn thành. |

### Việc chính theo tần suất và trang dùng nhiều nhất

| Vai trò | Việc thường xuyên nhất (giảm dần) | Trang dùng ~80% thời gian |
|---|---|---|
| Nhân viên kinh doanh | Vào/ra ca → check-in đại lý → tạo đơn → xem chỉ tiêu của mình | **Hôm nay** (app điện thoại) |
| ASM / quản lý vùng | Duyệt đơn → xem check-in và chấm công → xem số vùng | **Cần duyệt** |
| Sales Admin | Kiểm tra đơn → xử lý lỗi đồng bộ → đại lý mới | **Đơn hàng** |
| Nhân viên CSKH | Trả lời tin nhắn → cập nhật phiếu | **Hộp thư** |
| Trưởng nhóm CSKH | Phân công → theo dõi quá hạn → xem số | **Phiếu tiếp nhận** |
| Quản trị (IT) | Tài khoản → danh mục → kết nối | **Tài khoản** |
| Lãnh đạo | Xem chỉ số → xem chi tiết điểm bất thường | **Tổng quan điều hành** |

## 1. Site Map (web)

Trang có dấu `*` là bổ sung so với plan trước.

- Đăng nhập `/login`
  - Quên mật khẩu* `/quen-mat-khau`
  - Đổi mật khẩu lần đầu* `/doi-mat-khau`
- **Hub** `/hub`
- **Tổng quan điều hành*** `/tong-quan`
- Thông báo* `/thong-bao`
- Tài khoản của tôi* `/toi`
- Không có quyền* `/403`

- **Kinh doanh** `/kinh-doanh` (chuyển tới trang đích theo vai trò)
  - Tổng quan
    - Dashboard `/kinh-doanh/dashboard`
    - Cần duyệt* `/kinh-doanh/can-duyet` (tab: Đơn hàng · Đại lý mới · Đơn từ · Check-in nghi vấn)
  - Bán hàng
    - Đơn hàng `/kinh-doanh/don-hang`
      - Tạo đơn `/kinh-doanh/don-hang/tao-moi`
      - Chi tiết đơn `/kinh-doanh/don-hang/[ma]` (tab: Thông tin · Duyệt · FAST · Lịch sử)
    - Tồn kho* `/kinh-doanh/ton-kho`
    - Chỉ tiêu* `/kinh-doanh/chi-tieu`
  - Đối tác
    - Đại lý `/kinh-doanh/dai-ly`
      - Thêm đại lý `/kinh-doanh/dai-ly/tao-moi`
      - Hồ sơ đại lý `/kinh-doanh/dai-ly/[id]` (tab: Thông tin · Đơn hàng · Công nợ · Viếng thăm · Phản hồi)
    - Khách hàng `/kinh-doanh/khach-hang`
      - Hồ sơ khách hàng `/kinh-doanh/khach-hang/[id]`
  - Thị trường
    - Tuyến viếng thăm `/kinh-doanh/tuyen-vieng-tham`
    - Check-in `/kinh-doanh/check-in` (danh sách, bản đồ, ảnh, cờ nghi vấn)
    - Chấm công `/kinh-doanh/cham-cong` (tab: Bảng công · Đơn từ · Kỳ công)
  - Đối soát
    - Đồng bộ FAST `/kinh-doanh/dong-bo-fast` (tab: Đơn hàng · Đại lý · Yêu cầu cập nhật · Danh mục)
    - Báo cáo `/kinh-doanh/bao-cao`

- **CSKH** `/cskh` (chuyển tới Hộp thư)
  - Hộp thư `/cskh/hop-thu`, mở một hội thoại: `/cskh/hop-thu/[id]`
  - Phiếu tiếp nhận `/cskh/phieu`
    - Tạo phiếu `/cskh/phieu/tao-moi`
    - Chi tiết phiếu `/cskh/phieu/[ma]`
  - Khách hàng* `/cskh/khach-hang`, hồ sơ: `/cskh/khach-hang/[id]`
  - Mẫu trả lời `/cskh/mau-tra-loi`
  - Dashboard `/cskh/dashboard` (thay cho `/cskh/bao-cao`; số liệu bấm vào được, có xuất Excel)

- **Quản trị** `/quan-tri` (chuyển tới Tài khoản)
  - Người dùng
    - Tài khoản `/quan-tri/tai-khoan`, chi tiết: `/quan-tri/tai-khoan/[id]`
    - Vai trò và quyền `/quan-tri/vai-tro`
    - Cơ cấu tổ chức `/quan-tri/co-cau-to-chuc`
  - Danh mục
    - Sản phẩm `/quan-tri/san-pham`
    - Kho `/quan-tri/kho`
    - Đại lý `/quan-tri/dai-ly`, hồ sơ: `/quan-tri/dai-ly/[id]`
    - Bảng giá `/quan-tri/bang-gia`
  - Quy định
    - Quy trình duyệt `/quan-tri/quy-trinh-duyet`, chi tiết: `/quan-tri/quy-trinh-duyet/[donViId]`
    - Ca làm việc `/quan-tri/ca-lam-viec`
    - Lịch vụ* `/quan-tri/lich-vu` (Đông Xuân, Hè Thu, Vụ Mùa… dùng làm kỳ báo cáo)
    - Tham số `/quan-tri/tham-so`
  - Hệ thống
    - Kết nối `/quan-tri/ket-noi` (FAST · Zalo OA · Mattermost)
    - Nhật ký `/quan-tri/nhat-ky`

- **API (không có giao diện)**
  - Cho FAST/HRM: `/api/v1/*`, tài liệu: `/api/docs`
  - Cho app điện thoại: `/api/mobile/*`
  - Webhook: `/api/webhooks/zalo`, `/api/webhooks/mattermost`

### Site Map app điện thoại

- Đăng nhập / Đăng ký thiết bị
- Tab **Hôm nay**: nút Vào ca/Ra ca · điểm cần thăm · chỉ tiêu tháng của tôi · số check-in chờ gửi
- Tab **Tuyến**: đại lý hôm nay / gần tôi → Check-in đại lý → Check-out · Thêm đại lý
- Tab **Đơn hàng**: đơn của tôi · Tạo đơn nhanh (M8) · **Cần duyệt** (chỉ hiện với người có quyền duyệt)
- Tab **Công**: lịch sử check-in · bảng công · gửi đơn từ · xác nhận kỳ công
- Tab **Tôi**: hồ sơ, thiết bị, thông báo, đăng xuất

### Quy tắc "một hồ sơ, nhiều lối vào"

Trong plan trước, đại lý xuất hiện ở cả Kinh doanh và Quản trị mà không rõ quan hệ. Quy tắc mới:

| Đối tượng | Lối vào | Khác nhau ở |
|---|---|---|
| Đại lý | Kinh doanh (làm việc hằng ngày) · Quản trị (quản lý danh mục) | Quản trị có thêm: gộp trùng, gán nhân viên hàng loạt, nhập Excel, tab Đồng bộ FAST |
| Khách hàng | Kinh doanh · CSKH | CSKH mở mặc định tab Phản hồi; Kinh doanh mở mặc định tab Đơn hàng |

Dữ liệu chỉ có một bản; mọi lối vào dùng chung component `DealerProfile` / `CustomerProfile`. URL theo bộ phận đang đứng để menu trái luôn đúng ngữ cảnh. Quyền kiểm tra theo từng trang và từng thao tác, không chỉ theo bộ phận.

## 2. Navigation Model

- **Cấp 0 — Hub**: 3 ô bộ phận (ẩn ô không có quyền) + lối vào Tổng quan điều hành (nếu có quyền).
- **Điều hướng chính**: menu trái của từng bộ phận. Kinh doanh 12 trang chia 5 nhóm; CSKH 5 trang không chia nhóm; Quản trị 13 trang chia 4 nhóm. Nhóm là nhãn cố định, không thu gọn được, để người dùng luôn thấy đủ.
- **Điều hướng phụ**: tab trong trang chi tiết; tab cấp trang cho Cần duyệt, Chấm công, Đồng bộ FAST. Breadcrumb từ cấp bộ phận.
- **Điều hướng tiện ích** (thanh trên): chuyển bộ phận (quay về Hub hoặc sang bộ phận khác) · tìm kiếm Ctrl+K · chuông thông báo · tài khoản của tôi.
- **Hiển thị có điều kiện**: mục nào không có quyền thì ẩn hẳn. Badge số việc chờ trên Cần duyệt, Hộp thư, Đồng bộ FAST.
- **Web trên điện thoại/tablet**: dưới 1024px menu trái thành ngăn kéo. Hộp thư 3 cột thu thành 1 cột theo bước (danh sách → hội thoại → thông tin khách). Bảng dữ liệu ẩn bớt cột phụ.
- **App điện thoại**: 5 tab dưới cùng; không có menu trái, không có Hub (app chỉ phục vụ công việc ngoài thị trường).

### Trang đích khi bấm ô bộ phận

| Vai trò | Kinh doanh | CSKH | Quản trị |
|---|---|---|---|
| Nhân viên kinh doanh | Dashboard (số của tôi) | — | — |
| ASM | Cần duyệt | — | — |
| Sales Admin | Đơn hàng | — | — |
| Nhân viên / Trưởng nhóm CSKH | — | Hộp thư / Phiếu tiếp nhận | — |
| Quản trị hệ thống, Quản trị đơn vị | — | — | Tài khoản |
| Lãnh đạo | Dashboard | Dashboard | — |

## 3. Dashboard và chỉ số

### 3.1 Bộ lọc chung

Kỳ (tháng · quý · **vụ** · năm · tuỳ chọn) · đơn vị · nhóm sản phẩm/giống · nguồn số liệu (Đặt hàng / Thực bán). Bộ lọc nằm trên URL để gửi link được. Phạm vi dữ liệu tự áp theo vai trò ở phía máy chủ.

Mọi khối số hiện **"cập nhật lúc hh:mm"**. Mọi khối bấm được để đi tới danh sách đã lọc tương ứng.

### 3.2 Dashboard Kinh doanh `/kinh-doanh/dashboard`

| Khu vực | Nội dung |
|---|---|
| **Hàng số chính** | Sản lượng đặt hàng · Sản lượng thực bán · Doanh thu thực bán · % hoàn thành chỉ tiêu · **Số đại lý đặt mua** / tổng đại lý đang hoạt động |
| **Sản lượng** | Diễn biến theo tháng/vụ: Thực bán, Chỉ tiêu, Cùng kỳ · theo nhóm sản phẩm · top giống bán chạy và giống bán chậm |
| **Đại lý** | Top đại lý theo sản lượng · đại lý mới có đơn đầu tiên · **đại lý không đặt hàng quá N ngày** · độ phủ theo vùng |
| **Đơn hàng** | Số đơn theo trạng thái · đơn duyệt quá hạn · đơn có cảnh báo vượt công nợ/thiếu tồn · chênh lệch Đặt hàng và Thực bán |
| **Công nợ và tồn kho** | Tổng công nợ · đại lý vượt hạn mức · sản phẩm tồn thấp |
| **Thị trường** | Nhân viên đã vào ca hôm nay · tỉ lệ hoàn thành tuyến · số lượt viếng thăm · tỉ lệ viếng thăm có phát sinh đơn |

Theo vai trò: **Nhân viên** thấy số của mình và đại lý mình phụ trách, ẩn khối "Đơn duyệt quá hạn". **ASM** thấy vùng và có thêm bảng xếp hạng nhân viên. **Lãnh đạo** thấy toàn công ty và so sánh giữa các miền.

### 3.3 Tổng quan điều hành `/tong-quan`

Một màn hình, không cuộn trên màn 1440px: Thực bán so với chỉ tiêu · Doanh thu · Số đại lý đặt mua · Công nợ · Phiếu quá hạn · Nhân viên vào ca hôm nay; so sánh các miền; danh sách **"Cần chú ý"** (vùng dưới chỉ tiêu, đại lý vượt hạn mức, lỗi đồng bộ FAST kéo dài, phiếu khiếu nại mức cao).

### 3.4 Dashboard CSKH `/cskh/dashboard`

Phiếu mới · đang mở · quá hạn · thời gian phản hồi đầu · thời gian giải quyết · tỉ lệ đạt SLA · điểm hài lòng; theo loại và kênh; khiếu nại theo giống/lô; hiệu suất từng nhân viên; hạn mức tin Zalo ngoài khung đã dùng.

### 3.5 Định nghĩa chỉ số

| Chỉ số | Cách tính | Nguồn | Độ mới |
|---|---|---|---|
| Sản lượng đặt hàng | Tổng số lượng quy đổi ra kg/tấn của đơn **đã duyệt, chưa huỷ**, theo ngày duyệt | DMS | ≤ 15 phút |
| Sản lượng thực bán | Số lượng trên hoá đơn bán **trừ hàng trả lại**, theo ngày hoá đơn | FAST | Theo chu kỳ đồng bộ (dự kiến 15–60 phút) |
| Doanh thu thực bán | Tiền hàng sau chiết khấu, chưa VAT, trừ hàng trả lại | FAST | Như trên |
| % hoàn thành chỉ tiêu | Thực bán ÷ Chỉ tiêu của kỳ và phạm vi đang chọn | FAST + DMS | Như trên |
| Số đại lý đặt mua | Số đại lý **khác nhau** có ≥ 1 đơn đã duyệt trong kỳ | DMS | ≤ 15 phút |
| Độ phủ đại lý | Số đại lý đặt mua ÷ số đại lý đang hoạt động trong phạm vi | DMS | ≤ 15 phút |
| Đại lý không đặt hàng | Đại lý đang hoạt động, đơn đã duyệt gần nhất cách quá N ngày (N đặt ở Tham số) | DMS | ≤ 15 phút |
| Tỉ lệ hoàn thành tuyến | Điểm đã check-in ÷ điểm trong kế hoạch | DMS | ≤ 15 phút |

Quy tắc tính:
- Sản lượng luôn **quy đổi ra kg/tấn** qua bảng quy đổi ĐVT; không cộng trực tiếp "bao" với "kg". Sản phẩm thiếu quy đổi bị liệt kê riêng, không âm thầm bỏ qua.
- Số liệu gắn với **đơn vị và nhân viên tại thời điểm bán**, nên đổi vùng hay đổi người phụ trách không làm sai số quá khứ.
- *Thực bán* phụ thuộc FBO có cung cấp dữ liệu hoá đơn. Nếu không có API thì tạm dùng nhập file Excel xuất từ FAST.

## 4. Content Hierarchy

### Hub
1. Ô bộ phận kèm số việc chờ — mục đích chính của trang là chọn nơi làm việc
2. Lối vào Tổng quan điều hành (nếu có quyền) — lãnh đạo vào số liệu nhanh nhất
3. Việc cần làm của tôi — đơn chờ duyệt, phiếu được giao
4. Thông báo gần đây — thông tin phụ

### Cần duyệt
1. Danh sách theo hạn duyệt, mục sắp quá hạn lên đầu — thứ tự xử lý là thông tin quan trọng nhất
2. Cảnh báo trên từng dòng (vượt công nợ, thiếu tồn) — quyết định duyệt dựa vào đây
3. Duyệt nhanh / từ chối ngay trên dòng và duyệt hàng loạt — giảm số lần mở trang
4. Bộ lọc theo loại và đơn vị

### Đơn hàng (danh sách)
1. Mã đơn, đại lý, giá trị, trạng thái — đủ để nhận ra đơn
2. Trạng thái đồng bộ FAST — việc chính của Sales Admin
3. Bộ lọc nhanh theo trạng thái
4. Xuất Excel, thao tác hàng loạt

### Tạo đơn
1. Chọn đại lý — quyết định giá, công nợ, kho
2. Dòng sản phẩm kèm tồn khả dụng — nơi nhập liệu chính
3. Cảnh báo công nợ và tổng tiền, cố định ở cột phải — luôn thấy khi nhập
4. Lưu nháp / Gửi duyệt

### Hồ sơ đại lý
1. Mã, tên, trạng thái đồng bộ, nhân viên phụ trách
2. Công nợ / hạn mức và sản lượng kỳ này
3. Tab chi tiết

### Dashboard Kinh doanh
1. Hàng số chính — trả lời "kỳ này thế nào"
2. Biểu đồ Thực bán so với Chỉ tiêu và Cùng kỳ — trả lời "đang đi đúng hướng không"
3. Đại lý cần chú ý và top đại lý — chỗ có thể hành động
4. Đơn hàng, công nợ, thị trường

### Check-in
1. Danh sách/bản đồ trong ngày
2. Cờ nghi vấn cần xem
3. Ảnh và chi tiết khi chọn một lượt

### Chấm công — Bảng công
1. Lưới nhân viên × ngày
2. Ô bất thường (thiếu, muộn, chờ xác nhận) — nổi bật màu
3. Trạng thái kỳ công và hạn chốt
4. Xuất theo mẫu

### Đồng bộ FAST
1. Số lỗi và danh sách lỗi — chỉ việc lỗi mới cần người xử lý
2. Lý do lỗi và nút Gửi lại
3. Hàng chờ và đã đồng bộ

### Hộp thư
1. Khung hội thoại và ô trả lời
2. Danh sách hội thoại chưa xử lý
3. Thời hạn trả lời miễn phí và thông tin khách, phiếu, đơn gần nhất
4. Bộ đếm hạn mức tin ngoài khung

### Quy trình duyệt (cấu hình)
1. Chuỗi bước của đơn vị và nguồn (riêng / kế thừa từ đơn vị cha)
2. Điều kiện của từng bước
3. Xem trước với đơn giả định
4. Lịch sử phiên bản

### Hôm nay (app điện thoại)
1. Nút Vào ca / Ra ca — việc bắt buộc mỗi ngày
2. Điểm cần thăm tiếp theo
3. Chỉ tiêu tháng của tôi
4. Số check-in chờ gửi

## 5. User Flows

### Đăng nhập và vào việc
1. Người dùng đăng nhập → tới Hub.
   - Lần đầu → đổi mật khẩu trước.
2. Hub hiện ô bộ phận được phép và số việc chờ.
3. Bấm ô → tới trang đích theo vai trò.
   - Từ link thông báo → bỏ qua Hub, tới thẳng đối tượng.

### Tạo đơn → duyệt → FAST
1. Tạo đơn, chọn đại lý, nhập sản phẩm.
2. Hệ thống tính giá, hiện tồn khả dụng và hạn mức.
   - Thiếu tồn hoặc vượt hạn mức → **cảnh báo, vẫn gửi được**, đơn gắn cờ.
   - Sản phẩm ngừng kinh doanh → chặn.
3. Gửi duyệt → quy trình của đơn vị người tạo được áp dụng; có cờ thì có thể thêm bước.
4. Đơn vào Cần duyệt của người duyệt.
   - Từ chối / Trả lại sửa → về người tạo kèm lý do.
5. Duyệt xong bước cuối → vào hàng đợi FAST.
   - Đại lý chưa được FAST xác nhận → đơn chờ, hiện lý do ở Đồng bộ FAST.
6. FAST nhận → đơn có số chứng từ.
   - Lỗi → tab Lỗi của Đồng bộ FAST, Sales Admin sửa và Gửi lại; cảnh báo vào Mattermost.

### Thêm đại lý mới
1. Nhân viên thêm đại lý (web/app).
   - App mất mạng → lưu trên máy, có mạng mới gửi và được cấp mã.
2. Hệ thống kiểm tra trùng MST/SĐT, cấp mã.
3. Mục vào Cần duyệt › Đại lý mới (nếu bật duyệt).
4. Đẩy sang FAST → Đã xác nhận.
   - Mã đã tồn tại trên FAST hoặc lỗi → báo lỗi để xử lý tay, không ghi đè.

### Check-in và chấm công
1. App: Vào ca → GPS + ảnh → lưu trên máy → gửi khi có mạng.
2. Trong ngày: check-in đại lý.
   - Ngoài bán kính → bắt nhập lý do, gắn cờ, vẫn ghi nhận.
3. Hệ thống tổng hợp ngày công.
   - Thiếu/nghi vấn → nhân viên gửi đơn từ → vào Cần duyệt.
4. Cuối kỳ: nhân viên xác nhận trên app → quản lý chốt kỳ → xuất theo mẫu.

### Tin Zalo → phiếu → đóng
1. Khách nhắn OA → tin vào Hộp thư, tạo hoặc ghép khách và phiếu.
2. Phân công → nhân viên trả lời.
   - Ngoài thời hạn miễn phí → hỏi xác nhận, trừ hạn mức; không có quyền thì bị chặn.
3. Cần bộ phận khác → chuyển phiếu; báo vào Mattermost.
   - Quá SLA → đổi màu, báo Mattermost.
4. Đóng phiếu → gửi khảo sát nếu còn trong thời hạn.

### Giao chỉ tiêu và theo dõi
1. Người có quyền tạo chỉ tiêu theo kỳ (tháng/vụ) tại `/kinh-doanh/chi-tieu`: nhập tay hoặc Excel.
2. Phân bổ Miền → Vùng → Nhân viên.
   - Tổng cấp con khác cấp cha → cảnh báo chênh lệch.
3. Dashboard và app hiện % hoàn thành.
4. Lãnh đạo thấy vùng dưới chỉ tiêu trong "Cần chú ý" → bấm vào → Dashboard đã lọc vùng đó → danh sách đại lý không đặt hàng.

## 6. Naming Conventions

| Khái niệm | Nhãn trên giao diện | Ghi chú |
|---|---|---|
| Không gian làm việc cấp Hub | **Bộ phận** | Chỉ 3: Kinh doanh, CSKH, Quản trị |
| Miền/Vùng/Khu vực trong cơ cấu | **Đơn vị** | Không gọi là "bộ phận" |
| Bên mua và nhận hoá đơn, có mã FAST | **Đại lý** | Có trường Loại: Cấp 1, Cấp 2, Tổ chức |
| Mã KH trên FAST | **Mã đại lý** | Một mã duy nhất |
| Mã ở DMS cũ | **Mã cũ** | Chỉ để tra cứu |
| Nông dân, HTX, hộ không có mã FAST | **Khách hàng** | Không dùng từ này cho đại lý |
| Giao dịch bán | **Đơn hàng** | Không viết tắt là "đơn" trong nhãn |
| Giải trình, xin nghỉ, công tác | **Đơn từ** | |
| Vào làm / tan làm | **Vào ca / Ra ca** | |
| Ghé đại lý | **Check-in đại lý** | Phân biệt với Vào ca |
| Yêu cầu của khách cần xử lý | **Phiếu** | Thay "ticket" |
| Chuỗi tin với một khách | **Hội thoại** | |
| Mục tiêu được giao | **Chỉ tiêu** | Luôn là con số kế hoạch |
| Thước đo hiển thị | **Chỉ số** | Không gọi là "KPI" trên giao diện |
| Đơn đã duyệt tính vào số | **Đặt hàng** | |
| Hoá đơn FAST trừ hàng trả lại | **Thực bán** | |
| Khối lượng | **Sản lượng** | Đơn vị kg/tấn |
| Mùa vụ làm kỳ báo cáo | **Vụ** | |
| Hàng đợi cần phê duyệt | **Cần duyệt** | |
| Trạng thái sang FAST | **Đã chuyển FAST** | Lỗi: "Lỗi đồng bộ" |

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
| `CustomerProfile` | Kinh doanh, CSKH | Tab mặc định khác nhau |
| `ApprovalQueue` | Cần duyệt (web), Cần duyệt (app dùng cùng API) | Thao tác theo loại mục |
| `ApprovalTimeline` | Đơn hàng, Đại lý mới, Đơn từ | Dữ liệu từ động cơ duyệt chung |
| `DashboardGrid`, `MetricTile`, `ChartCard`, `DashboardFilters` | 3 dashboard và Báo cáo | Khối theo vai trò; mỗi khối một `<Suspense>` |
| `SyncBadge` | Đơn hàng, Đại lý, Đồng bộ FAST | Trạng thái chung |
| `MapView` / `MapPicker` | Check-in, Hồ sơ đại lý | Tải bằng `next/dynamic` |
| `Inbox` (compound) | Hộp thư | Thu thành 1 cột dưới 1024px |
| `WorkflowEditor` | Quy trình duyệt | Dùng cho đơn hàng, đại lý mới, đơn từ |

## 8. Content Growth Plan

| Nội dung | Tốc độ tăng | Cách xử lý |
|---|---|---|
| Đơn hàng, Phiếu, Check-in | Liên tục | Phân trang phía máy chủ, mặc định lọc kỳ gần nhất, có tìm kiếm |
| Ảnh check-in (~90–180 GB/năm) | Liên tục | Nén trên máy; chính sách lưu ảnh gốc theo thời hạn cần chốt |
| Tin nhắn, Hội thoại | Liên tục | Tải dần khi cuộn; hội thoại đã đóng lâu chuyển trạng thái lưu trữ, vẫn tìm được |
| Số liệu dashboard | Liên tục | Bảng tổng hợp theo ngày, không tính trực tiếp từ dữ liệu gốc |
| Nhật ký hệ thống, nhật ký đồng bộ | Liên tục, nhanh | Chia bảng theo tháng; giữ ngắn hạn phần nội dung request |
| Đại lý, Khách hàng | Vừa | Tìm không dấu, lọc đơn vị, phạm vi theo vai trò |
| Sản phẩm, Kho, Vai trò, Ca | Gần như cố định | Không cần xử lý đặc biệt |
| Bộ phận trên Hub | Có thể thêm | Hub đọc cấu hình, thêm bộ phận không phải sửa bố cục |
| Trang trong Kinh doanh | Có thể thêm | Thêm vào nhóm sẵn có; quá 5 trang một nhóm thì tách nhóm |

## 9. URL Strategy

- Mẫu: `/{bo-phan}/{tai-nguyen}/{dinh-danh}`; tiếng Việt không dấu, chữ thường, nối bằng `-`.
- Trang tạo mới: `/tao-moi` (từ khoá dành riêng, mã không được trùng).
- Định danh: Đơn hàng và Phiếu dùng **mã** (`[ma]`) vì mã không đổi và dễ đọc qua điện thoại. Đại lý, Khách hàng, Tài khoản dùng **`[id]`** vì mã đại lý có thể đổi nếu phải dùng phương án dự phòng.
- Tham số truy vấn: `?q=` tìm kiếm · `?trang=` · `?sap-xep=` · `?tab=` · dashboard: `?ky=2026-11` hoặc `?ky=vu-dong-xuan-2026`, `?don-vi=`, `?nhom=`, `?nguon=dat-hang|thuc-ban`.
- Mọi trạng thái lọc nằm trên URL để gửi link và tải lại đúng trạng thái.
- API đánh số phiên bản qua đường dẫn (`/api/v1`); thay đổi phá vỡ tương thích → `/api/v2`.
