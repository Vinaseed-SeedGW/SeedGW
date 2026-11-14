# Build Tasks: DMS Vinaseed (Hub: Kinh doanh, Trao đổi, Quản trị + App check-in)

Dựa trên: DESIGN_BRIEF.md (quyết định 1 đến 29), INFORMATION_ARCHITECTURE.md, CHECK_IN_PLAN.md
Bản v5, 13/11/2026: bỏ đơn hàng (quyết định 27); 3 vai trò, bỏ CSKH, thêm Trao đổi, đại lý đồng bộ 2 chiều với FAST (quyết định 28).
Cập nhật 14/11/2026: Trao đổi chỉ còn giữa CBNV và quản trị, gộp thành một mục Hỗ trợ (quyết định 29).

## Cách đọc

- Mỗi task là một phần làm xong là chạy được, kiểm tra được (database, máy chủ, giao diện, quyền).
- **Ước lượng tính theo buổi**: 1 buổi là một ngày làm việc của bạn với Claude, gồm cả lúc bạn thử và duyệt. Thời gian thực tế phụ thuộc nhiều vào việc thử ngoài thị trường và việc chờ IT, FAST, Apple.
- Tốc độ dùng để ước lượng lấy từ 11 đến 13/11/2026: phần máy chủ check-in (đăng nhập app, gửi dữ liệu, km, địa chỉ, báo cáo Excel) xong trong 1 buổi; danh mục đại lý A7 (nhập 15.819 đại lý, danh sách, hồ sơ, gán) xong trong 1 buổi.
- Lịch tính 5 buổi mỗi tuần, bắt đầu thứ Hai 16/11/2026, có dự phòng 20% cho sửa lỗi sau khi thử thật.
- Đường dẫn và tên gọi trên giao diện theo INFORMATION_ARCHITECTURE.md.

---

## Đã xong (tới 13/11/2026)

| Mã | Nội dung | Ghi chú |
|---|---|---|
| F1 | Đăng nhập, Hub | Hub còn 3 ô: Kinh doanh, Trao đổi, Quản trị |
| F2 | Nhận diện thương hiệu, token, AppShell | |
| F3 | Phân quyền, phạm vi dữ liệu, 3 vai trò | Quản trị hệ thống, Quản trị đơn vị, Cán bộ nhân viên. Chức danh ghi ở hồ sơ tài khoản |
| F4 | Bảng dữ liệu dùng chung | |
| F5 | Form dùng chung, nhật ký thao tác, thông báo | |
| A1 | Cơ cấu tổ chức | Đã thêm 19 đơn vị từ DMS cũ, sửa tên và vị trí sau |
| A2 | Tài khoản CBNV, nhập Excel, thiết bị di động | Có ô Chức danh. Chưa nhập danh sách nhân viên thật |
| A3 | Vai trò và ma trận quyền | |
| A9 | Tham số hệ thống | Mốc lâu chưa ghé thăm theo cấp đại lý: cấp 1 14 ngày, cấp 2 30 ngày, cấp 3 45 ngày |
| A7 | Danh mục đại lý | 15.819 đại lý, mã FAST, 3 cấp, 34 tỉnh mới, gán và đổi đơn vị hàng loạt, chọn đại lý trên app. Còn A7b |
| R3 | App thử: máy ảnh có dấu vị trí, ghi hành trình nền, xuất Excel | Đã thử thật 12/11 trên iPhone 11, lệch 2,7% so với đồng hồ xe |
| V2 | Báo cáo ghé thăm `/kinh-doanh/check-in` | Bảng, ảnh, xuất Excel đúng mẫu. Còn V2b |
| M1, M3, M12, V1, V3 | Phần máy chủ và hàng đợi của app | Đăng nhập app, gửi check-in, ảnh, vết GPS, km theo GPS, địa chỉ Vietmap. Chưa thử trên điện thoại vì chưa có máy chủ công khai |
| F6 | Docker, file chạy máy chủ, CI/CD, sao lưu | Đã chạy thử trên máy phát triển. Dùng khi đưa lên máy chủ của IT |

**Đã bỏ:** đơn hàng (A4 Sản phẩm, A5 Kho, A6 Bảng giá, A10 Quy trình duyệt, S2 đến S7, M8, số liệu Đặt hàng) theo quyết định 27; CSKH (C1 đến C9, R2 Zalo OA, D2 Dashboard CSKH) và các vai trò Quản lý vùng, Sales Admin, CSKH, Lãnh đạo theo quyết định 28.

---

## Giai đoạn 1: Check-in chạy thử thật với 2 đến 3 tài khoản (16/11 đến 27/11/2026)

Mục tiêu: nhóm thử dùng app mỗi ngày, dữ liệu lên máy chủ trên máy cá nhân, quản lý xem báo cáo trên web.

- [ ] **P1. Máy chủ trên máy cá nhân và bản build app** (1 buổi): chạy máy chủ trên máy cá nhân, mở ra Internet bằng Cloudflare Tunnel để điện thoại đi 4G gửi được; đặt `EXPO_PUBLIC_API_URL`; thêm `expo-updates` (đã duyệt) để sửa lỗi không cần build lại; build iOS và Android một lần.
  - **Xong khi**: 2 đến 3 người cài app, đăng nhập bằng tài khoản thật, check-in ngoài đường hiện trên web trong 1 phút.
  - Cần: duyệt tải `cloudflared` của Cloudflare; muốn địa chỉ cố định thì thêm một tên miền trên Cloudflare; UDID iPhone của người thử.
- [ ] **G1a. Nhập tài khoản nhân viên thật và ghép đại lý** (0,5 buổi): nhập danh sách bằng Excel ở trang Tài khoản (có cột Chức danh, vai trò mặc định Cán bộ nhân viên), bấm Ghép nhân viên theo tên cho 12.087 đại lý đang chờ gán.
- [ ] **M2. Hoàn thiện màn check-in** (1 buổi): giờ trên ảnh theo giờ máy chủ, tên nhân viên trên ảnh, font và màu theo BRAND, cảnh báo khi vuốt tắt app, câu hỏi quyền tiếng Việt còn sót.
- [ ] **M5. Cờ nghi vấn** (0,5 buổi): thêm tốc độ di chuyển phi lý giữa hai lượt, máy đã root hoặc jailbreak. Không chặn check-in.
- [ ] **A9b. Tham số check-in** (0,5 buổi): giờ tự dừng ghi hành trình, khoảng lọc điểm GPS, bán kính gộp chỗ dừng đưa vào trang Tham số.
- [ ] **M6. App 4 tab: Hôm nay, Tuyến, Lịch sử, Tôi** (1,5 buổi): lịch sử check-in của tôi, km từng chặng và tổng km, chân trang ở tab Tôi. Tab Trao đổi thêm ở giai đoạn 3.
- [ ] **R4. Máy chủ tìm đường** (1,5 buổi): OSRM bản đồ Việt Nam chạy bằng Docker, khớp vết GPS vào đường; đo trên 3 tuyến có đồng hồ hành trình 0,1 km.
  - **Xong khi**: km theo đường đi lệch đồng hồ xe không quá 5% trên 3 tuyến.
- [ ] **V1b. Khoảng cách theo đường đi** (1 buổi): điền cột Khoảng cách (km) trong báo cáo và Excel; đoạn mất vết nối bằng đường ngắn nhất, ghi "ước tính".
- [ ] **M4. Toạ độ đại lý từ check-in** (1 buổi): lần check-in đầu tại đại lý chưa có toạ độ thì đề xuất toạ độ, Quản trị đơn vị duyệt; check-in xa đại lý quá bán kính thì bắt nhập lý do, gắn cờ.
- [ ] **V2b. Bản đồ hành trình, lọc đơn vị, xoá dữ liệu quá hạn** (1 buổi): bản đồ một ngày của một nhân viên bằng `leaflet` (đã duyệt), lọc theo đơn vị, job hằng đêm xoá điểm GPS quá 45 ngày, dòng check-in quá 18 tháng.

**Cộng giai đoạn 1: 9,5 buổi.** Nhóm thử chạy song song 2 tuần, khoảng 23/11 đến 4/12/2026.

## Giai đoạn 2: Thị trường: đại lý, khách hàng, tuyến (30/11 đến 11/12/2026)

- [ ] **A7b. Hoàn thiện danh mục đại lý** (1 buổi): gộp đại lý trùng số điện thoại hoặc mã số thuế, chọn toạ độ trên bản đồ, sửa nhanh 2.578 số điện thoại sai dạng; danh sách **đại lý lâu chưa ghé thăm** theo mốc từng cấp.
- [ ] **S1. Khách hàng nông dân, hợp tác xã** (1,5 buổi): danh sách, hồ sơ, tạo, sửa; số điện thoại, cây trồng, diện tích, đại lý mua thường xuyên. Check-in loại Khách hàng chọn từ danh sách.
- [ ] **S8. Tuyến và kế hoạch viếng thăm** (2 buổi): gán đại lý vào tuyến theo ngày trong tuần; Quản trị đơn vị lập kế hoạch tuần; app tab Tuyến hiện "Hôm nay cần thăm" và đại lý gần tôi.
- [ ] **M10. Đề xuất đại lý mới trên app** (1 buổi): nhân viên đề xuất tại chỗ (tên, điện thoại, địa chỉ, toạ độ, ảnh); Quản trị đơn vị duyệt; sau khi nối FAST thì đẩy sang FAST ở S10.
- [ ] **M7. Thông báo đẩy** (1 buổi): kế hoạch tuyến mới, toạ độ đại lý đã duyệt, nhắc chưa check-in; dùng lại cho yêu cầu hỗ trợ ở giai đoạn 3.
- [ ] **Sửa lỗi sau đợt thử** (1,5 buổi).

**Cộng giai đoạn 2: 8 buổi.**

## Giai đoạn 3: Trao đổi: yêu cầu hỗ trợ gửi quản trị (14/12 đến 25/12/2026)

Bộ phận mới thay cho CSKH, chỉ trao đổi giữa CBNV và quản trị, không nhắn tin giữa nhân viên với nhau. Không phụ thuộc bên ngoài nên làm trước FAST. Chi tiết ở mục "Kế hoạch module Trao đổi" phía dưới.

- [ ] **T1. Nền dữ liệu và cập nhật tức thì** (1,5 buổi)
- [ ] **T2. Hỗ trợ trên web `/trao-doi/ho-tro`** (2 buổi)
- [ ] **T3. Hỗ trợ trên app, tab Trao đổi** (2 buổi)
- [ ] **T4. Thời hạn xử lý, nhắc, thống kê** (1 buổi)
- [ ] **T5. Lưu trữ 18 tháng, giới hạn tệp, nhật ký** (0,5 buổi)
- [ ] **Dự phòng** (2 buổi): dùng cho FAST nếu chậm, nếu không thì sửa lỗi sau đợt thử.

**Cộng giai đoạn 3: 7 buổi và 2 buổi dự phòng.**

## Giai đoạn 4: FAST: đại lý 2 chiều, công nợ, Thực bán (28/12/2026 đến 12/1/2027)

Phụ thuộc FAST gửi tài liệu API đọc và ghi khách hàng trước 11/12. Chậm thì làm giai đoạn 5 trước.

- [ ] **R1. Thử API FAST** (2 buổi): đọc danh mục khách hàng, công nợ và hạn mức, hoá đơn bán và hàng trả lại; **ghi** khách hàng mới với mã do DMS cấp (dải `DL`) và cập nhật thông tin liên hệ. Không có API thì dùng file Excel.
- [ ] **F8. Worker chạy nền** (1 buổi): chuyển tính km, lấy địa chỉ, đồng bộ FAST sang hàng đợi BullMQ có thử lại, chống gửi trùng và nhật ký. Cần trước khi quá 30 người dùng.
- [ ] **A8. Kết nối** (1 buổi): trang `/quan-tri/ket-noi` cấu hình FAST và Mattermost, trạng thái kết nối.
- [ ] **S10. Đồng bộ đại lý 2 chiều với FAST** (3 buổi):
  - FAST sang DMS: theo chu kỳ ở Tham số và nút **Đồng bộ FAST** ở Quản trị, Đại lý; đại lý mới bên FAST tự vào DMS, chờ gán nhân viên.
  - DMS sang FAST: đại lý mới đã duyệt (M10) được cấp mã theo dải `DL` rồi tạo bên FAST đúng mã đó; sửa tên, điện thoại, địa chỉ trên DMS thì gửi yêu cầu cập nhật sang FAST, không ghi đè cục bộ trường FAST làm gốc.
  - Trang **Đồng bộ FAST** trong Quản trị, Đại lý: lần đồng bộ gần nhất, dòng lỗi, nút gửi lại; lỗi kéo dài báo vào Mattermost.
  - **Xong khi**: tạo đại lý mới trên app, duyệt, 10 phút sau có trên FAST đúng mã; đại lý kế toán tạo trên FAST hiện trong DMS sau một chu kỳ.
- [ ] **S11. Công nợ và hạn mức từ FAST** (1 buổi): hiện ở hồ sơ đại lý và app; đại lý vượt ngưỡng ở Tham số vào mục Cần chú ý.
- [ ] **K2. Doanh số Thực bán từ FAST** (2 buổi): hoá đơn bán và hàng trả lại theo chu kỳ, quy ra kg, gắn đại lý và nhân viên phụ trách.

**Cộng giai đoạn 4: 10 buổi.**

## Giai đoạn 5: Dashboard và chỉ tiêu (13/1 đến 22/1/2027)

Chỉ số theo INFORMATION_ARCHITECTURE §3: lượt ghé thăm, độ phủ đại lý, đại lý lâu chưa ghé thăm theo cấp, km, Thực bán.

- [ ] **K1. Nền số liệu** (1,5 buổi): bảng tổng hợp theo ngày, gắn đơn vị và nhân viên lúc phát sinh, công thức có test.
- [ ] **K3. Chỉ tiêu và Lịch vụ** (1,5 buổi): khai báo vụ; giao chỉ tiêu theo kỳ cho đơn vị, nhân viên: Thực bán, số lượt ghé thăm, độ phủ.
- [ ] **K4. Dashboard Kinh doanh** (2 buổi).
- [ ] **K5. Báo cáo Kinh doanh** (1,5 buổi): bảng số theo đại lý, nhân viên, đơn vị, kỳ; xuất Excel theo phạm vi.
- [ ] **K6. Tổng quan điều hành** (1 buổi): dành cho Quản trị hệ thống và người được cấp quyền.
- [ ] **M11. Chỉ tiêu của tôi trên app** (0,5 buổi).

**Cộng giai đoạn 5: 8 buổi.**

## Giai đoạn 6: Hoàn thiện (25/1 đến 5/2/2027)

- [ ] **D3. Hub hoàn chỉnh** (1 buổi): số việc chờ thật (tin chưa đọc, báo lỗi chờ xử lý, toạ độ chờ duyệt), tìm kiếm toàn cục Ctrl+K.
- [ ] **D4. Trung tâm thông báo** (1 buổi).
- [ ] **D5. Hiệu năng** (1,5 buổi): chia bảng điểm GPS theo tháng (khoảng 800.000 điểm mỗi ngày với 300 người), chỉ mục, thử tải API app.
- [ ] **D6. Bảo mật** (1 buổi): rà OWASP, thử truy cập chéo phạm vi trên mọi trang `[id]`, giới hạn tần suất đăng nhập, header bảo mật.
- [ ] **D7. Truy cập và nhiều cỡ màn hình** (1 buổi).
- [ ] **F9. Ghi lỗi Sentry** (0,5 buổi): cần duyệt thư viện và tài khoản Sentry.
- [ ] **M9. Phát hành app** (1,5 buổi, chờ duyệt 1 đến 2 tuần): iOS qua App Store không công khai hoặc Apple Business Manager, Android qua Google Play hoặc file APK; trang hướng dẫn cài có mã QR.
- [ ] **F7. Đưa lên máy chủ của IT, G1 dữ liệu thật** (1,5 buổi): chạy theo `deploy/README.md`, chuyển dữ liệu từ máy cá nhân, đổi khoá Vietmap, trỏ tên miền.

**Cộng giai đoạn 6: 9 buổi.** Nghỉ Tết Đinh Mùi: dự kiến 6/2 đến 14/2/2027.

## Giai đoạn 7: Nghiệm thu, đào tạo, đưa vào dùng (15/2 đến 19/3/2027)

- [ ] **G2. Nghiệm thu theo kịch bản** (15/2 đến 26/2): Thị trường (check-in 3 loại điểm, mất mạng, ngoài bán kính, km, báo cáo Excel), Trao đổi (gửi yêu cầu hỗ trợ trên app, Quản trị đơn vị nhận và chuyển lên Quản trị hệ thống), Quản trị (tài khoản, 3 vai trò, thiết bị, đại lý), FAST (đại lý 2 chiều, công nợ, đối soát Thực bán), Dashboard (phạm vi từng vai trò).
- [ ] **G3. Đào tạo và tài liệu** (tuần 22/2): hướng dẫn theo 3 vai trò, tài liệu vận hành cho IT.
- [ ] **G4. Đưa vào dùng theo 3 đợt**: đợt 1 một đơn vị thí điểm từ 1/3; đợt 2 khoảng nửa số đơn vị từ 8/3; đợt 3 toàn bộ 300 đến 400 người từ 15/3/2027.

---

## Kế hoạch module Trao đổi (giai đoạn 3)

Mục tiêu: CBNV hỏi đáp, báo lỗi, góp ý với Quản trị đơn vị và Quản trị hệ thống ngay trong DMS, có người nhận, có trạng thái, thay cho nhắn rời rạc qua Zalo. Không có nhắn tin giữa nhân viên với nhau.

**Đã chốt 14/11/2026 (quyết định 29):**
1. Gộp Tin nhắn và Báo lỗi thành một mục **Hỗ trợ**. Mỗi lần gửi là một **yêu cầu** có loại (Hỏi đáp, Báo lỗi, Góp ý), trạng thái và phần trao đổi bên trong.
2. Người nhận đầu tiên luôn là Quản trị đơn vị của người gửi. Quản trị đơn vị bấm **Chuyển lên** khi cần Quản trị hệ thống. Đơn vị chưa có Quản trị đơn vị thì gửi thẳng Quản trị hệ thống.
3. Hộp chung của đơn vị: mọi Quản trị đơn vị của đơn vị đó (và đơn vị cha) đều thấy và trả lời được; ai bấm **Nhận xử lý** thì ghi tên người đó.
4. Nội dung và ảnh đính kèm lưu 18 tháng như check-in, rồi tự xoá.

**Quyền** (đổi 14/11/2026): `support.request.create` Gửi Yêu cầu hỗ trợ (Cán bộ nhân viên; người gửi chỉ thấy yêu cầu của mình), `support.request.manage` Xử lý Yêu cầu hỗ trợ (Quản trị đơn vị trong đơn vị và đơn vị con, Quản trị hệ thống toàn công ty).

**Mã yêu cầu**: `HT-yyyy-nnnnn`, ví dụ `HT-2026-00012`.

**Trạng thái**: Mới, Đang xử lý, Chờ người gửi, Đã xong. Người gửi bấm **Mở lại** trong 7 ngày nếu chưa ổn; sau 7 ngày ở Đã xong thì tự đóng.

| Mã | Nội dung | Xong khi |
|---|---|---|
| T1 | Bảng yêu cầu, tin trao đổi trong yêu cầu, tệp đính kèm (MinIO), lịch sử trạng thái và người nhận. Cập nhật tức thì trên web bằng SSE, app nhận qua thông báo đẩy (M7). Đánh dấu đã xem | Trả lời ở web, app người gửi thấy trong 1 phút |
| T2 | Web `/trao-doi/ho-tro`. Nhân viên: danh sách yêu cầu của tôi, tạo yêu cầu (loại, tiêu đề, mô tả, mức độ nếu là Báo lỗi: chặn công việc, ảnh hưởng, nhẹ; ảnh chụp màn hình). Quản trị: hộp chung theo đơn vị, lọc theo trạng thái, loại, mức độ; Nhận xử lý, Chuyển lên, đổi trạng thái. Trao đổi ngay trong yêu cầu. Biểu tượng Hỗ trợ có số chưa đọc trên thanh trên | Tạo, nhận, chuyển lên, đóng một yêu cầu chạy trên 1440 và 375 px |
| T3 | App tab Trao đổi: yêu cầu của tôi, tạo yêu cầu, chụp ảnh màn hình đính kèm, tự gắn phiên bản app, loại máy, màn hình đang dùng; soạn lúc mất mạng thì gửi sau; nút **Báo lỗi** nhanh ở tab Tôi | Bật chế độ máy bay tạo 1 yêu cầu và 2 tin, có mạng thì gửi đủ, không trùng |
| T4 | Thời hạn phản hồi đầu và xử lý theo mức độ (ở Tham số), nhắc Quản trị đơn vị khi sắp quá hạn, báo Mattermost khi Báo lỗi mức chặn công việc quá hạn; thống kê theo đơn vị, loại, mức độ, thời gian xử lý | Yêu cầu quá hạn hiện ở Hub và thống kê |
| T5 | Tự xoá nội dung và ảnh sau 18 tháng, chỉ nhận ảnh, PDF, Excel, Word dưới 10 MB, nhật ký mọi thao tác nhận, chuyển, đổi trạng thái | Gửi tệp .exe bị từ chối; nhật ký ghi đủ người và giờ |

---

## Tóm tắt thời gian

| Giai đoạn | Thời gian | Buổi làm | Kết quả |
|---|---|---|---|
| 1. Check-in chạy thử thật | 16/11 đến 27/11/2026 | 9,5 | 2 đến 3 tài khoản dùng app thật, km theo đường đi, toạ độ đại lý |
| 2. Thị trường | 30/11 đến 11/12/2026 | 8 | Khách hàng, tuyến, đề xuất đại lý mới, thông báo |
| 3. Trao đổi | 14/12 đến 25/12/2026 | 7 + 2 dự phòng | Yêu cầu hỗ trợ (hỏi đáp, báo lỗi, góp ý) gửi quản trị, trên web và app |
| 4. FAST | 28/12/2026 đến 12/1/2027 | 10 | Đại lý 2 chiều, nút Đồng bộ FAST, công nợ, Thực bán |
| 5. Dashboard và chỉ tiêu | 13/1 đến 22/1/2027 | 8 | Dashboard, báo cáo, chỉ tiêu, Tổng quan điều hành |
| 6. Hoàn thiện | 25/1 đến 5/2/2027 | 9 | Hiệu năng, bảo mật, phát hành app, lên máy chủ IT |
| 7. Nghiệm thu và đưa vào dùng | 15/2 đến 19/3/2027 | | 3 đợt, toàn bộ người dùng |
| **Tổng** | **16/11/2026 đến 19/3/2027, khoảng 18 tuần** | **51,5 buổi + 2 dự phòng** | |

**Dự kiến hoàn thành toàn bộ: 19/3/2027**, theo dõi sau khi dùng thật thêm 2 tuần tới 2/4/2027. Gộp Trao đổi (quyết định 29) bớt 2 buổi; giữ nguyên mốc, 2 buổi này để dự phòng cho FAST.

**Mốc có thể dùng sớm:** check-in và báo cáo ghé thăm đủ dùng cho một đơn vị khoảng 30 người từ khoảng 14/12/2026, nếu đưa lên máy chủ của IT sớm (F7 làm trước) và phát hành app bằng TestFlight hoặc file APK. Máy cá nhân chỉ đủ cho 2 đến 3 tài khoản thử.

**Đường găng:** nhóm thử trên máy cá nhân (P1) → FAST gửi tài liệu API (R1) → đại lý 2 chiều (S10) và Thực bán (K2) → dashboard (K4) → máy chủ IT và phát hành app (F7, M9) → nghiệm thu. Chậm ở FAST thì đổi chỗ giai đoạn 4 và 5; chậm ở Apple thì đợt đầu dùng Android trước.

## Việc cần người ngoài làm, hạn chót

| Ai | Việc | Hạn |
|---|---|---|
| Bạn | Danh sách nhân viên (mã, họ tên, đơn vị, chức danh) | 20/11/2026 |
| Bạn | Quyết định có mua tên miền riêng trên Cloudflare cho địa chỉ cố định (đã duyệt và tải `cloudflared` 2026.10.7 ngày 14/11) | 18/11/2026 |
| Nhóm thử | 2 đến 3 người, UDID iPhone của người dùng iPhone | 20/11/2026 |
| FAST và Kế toán | Tài liệu API đọc và ghi khách hàng, đọc công nợ, hoá đơn bán; chốt dải mã `DL` cho đại lý tạo từ DMS | 11/12/2026 |
| IT | Bot Mattermost và kênh nhận thông báo | 18/12/2026 |
| Lãnh đạo Kinh doanh | Lịch vụ, cách giao chỉ tiêu, mẫu chỉ tiêu đang dùng | 8/1/2027 |
| Kế toán | Số liệu bán năm trước để so cùng kỳ | 8/1/2027 |
| IT Vinaseed | Máy chủ Ubuntu, tên miền con, mở cổng 80 và 443, thư mục sao lưu (`deploy/README.md`) | 22/1/2027 |
| Pháp chế, Hành chính | Hình thức phát hành app iOS cho 300 đến 400 người, tài khoản Google Play | 15/1/2027 |

## Rủi ro chính

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| FAST không cho ghi khách hàng qua API | Không đẩy được đại lý mới sang FAST | Đề xuất đại lý mới vẫn duyệt trên DMS, kế toán tạo tay trên FAST, đồng bộ về tự ghép theo mã |
| FAST không có API đọc | Chậm công nợ, Thực bán | Dùng file Excel xuất từ FAST, nhập theo lịch |
| Máy cá nhân tắt hoặc chậm trong đợt thử | App không gửi được dữ liệu | App lưu trên máy và gửi lại sau, không mất check-in; đưa lên máy chủ IT sớm nếu cần mở rộng |
| Apple duyệt app lâu hoặc từ chối quyền vị trí nền | Chậm phát hành iOS | Nộp sớm từ 25/1, đã có lời giải trình trong R3_THU_NGHIEM.md; Android đi trước |
| Pin hao khi ghi hành trình cả ngày | Nhân viên tắt app | Đo trong đợt thử, chỉnh khoảng lọc điểm ở Tham số |

## Rà soát

- [ ] Rà thiết kế đối chiếu DESIGN_BRIEF và IA: sau giai đoạn 1 (app và báo cáo), sau T2 (Hỗ trợ trên web), sau K4 (Dashboard), trước G2.
- [ ] Rà code cho mỗi thay đổi có Server Action, API cho app hoặc webhook.
