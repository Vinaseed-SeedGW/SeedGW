# Build Tasks: DMS Vinaseed (Hub: Kinh doanh, Quản trị + Hỗ trợ + App check-in)

Dựa trên: DESIGN_BRIEF.md (quyết định 1 đến 30), INFORMATION_ARCHITECTURE.md, CHECK_IN_PLAN.md
Bản v5, 13/11/2026: bỏ đơn hàng (quyết định 27); 3 vai trò, bỏ CSKH, thêm Trao đổi, đại lý đồng bộ 2 chiều với FAST (quyết định 28).
Cập nhật 14/11/2026: Trao đổi chỉ còn giữa CBNV và quản trị, gộp thành một mục Hỗ trợ (quyết định 29). Bỏ bộ phận Trao đổi: nút nổi Hỗ trợ cho CBNV trên web, trang Quản trị › Hỗ trợ cho quản trị, màn hình Hỗ trợ trên app (quyết định 30).

**Bản v6, 16/11/2026: mốc demo 27/11/2026.** Bạn trình bày cho đồng nghiệp và Giám đốc Phòng ĐMST&CĐS. Giai đoạn 1 đổi thành "Chuẩn bị demo"; các việc không cần cho buổi demo dời sang giai đoạn 2 và 3; mốc hoàn thành chung giữ 19/3/2027.

Cập nhật 16/11 chiều: thêm G1a (nhập nhân viên thật, bạn gửi danh sách 16 đến 17/11) và M9a (bản iPhone qua TestFlight cho người xem demo); H0 Hỗ trợ bản demo dời sang giai đoạn 3 để đủ chỗ. Chuyến thử Hòa Bình trong ngày dùng làm dữ liệu chính cho bản đồ và báo cáo.

## Cách đọc

- Mỗi task là một phần làm xong là chạy được, kiểm tra được (database, máy chủ, giao diện, quyền).
- **Ước lượng tính theo buổi**: 1 buổi là một ngày làm việc của bạn với Claude, gồm cả lúc bạn thử và duyệt. Thời gian thực tế phụ thuộc nhiều vào việc thử ngoài thị trường và việc chờ IT, FAST, Apple.
- Tốc độ dùng để ước lượng lấy từ 11 đến 13/11/2026: phần máy chủ check-in (đăng nhập app, gửi dữ liệu, km, địa chỉ, báo cáo Excel) xong trong 1 buổi; danh mục đại lý A7 (nhập 15.819 đại lý, danh sách, hồ sơ, gán) xong trong 1 buổi.
- Lịch tính 5 buổi mỗi tuần, bắt đầu thứ Hai 16/11/2026, có dự phòng 20% cho sửa lỗi sau khi thử thật.
- Đường dẫn và tên gọi trên giao diện theo INFORMATION_ARCHITECTURE.md.

---

## Đã xong (tới 16/11/2026)

| Mã | Nội dung | Ghi chú |
|---|---|---|
| F1 | Đăng nhập, Hub | Hub còn 2 ô: Kinh doanh, Quản trị; nút nổi Hỗ trợ cho CBNV đã gắn vào khung trang (14/11) |
| F2 | Nhận diện thương hiệu, token, AppShell | |
| F3 | Phân quyền, phạm vi dữ liệu, 3 vai trò | Quản trị hệ thống, Quản trị đơn vị, Cán bộ nhân viên. Chức danh ghi ở hồ sơ tài khoản |
| F4 | Bảng dữ liệu dùng chung | |
| F5 | Form dùng chung, nhật ký thao tác, thông báo | |
| A1 | Cơ cấu tổ chức | Đã thêm 19 đơn vị từ DMS cũ, sửa tên và vị trí sau |
| A2 | Tài khoản CBNV, nhập Excel, thiết bị di động | Có ô Chức danh. Đã nhập 291 nhân viên thật vào máy chủ thử (G1a) |
| A3 | Vai trò và ma trận quyền | |
| A9 | Tham số hệ thống | Mốc lâu chưa ghé thăm theo cấp đại lý: cấp 1 14 ngày, cấp 2 30 ngày, cấp 3 45 ngày |
| A7 | Danh mục đại lý | 15.819 đại lý, mã FAST, 3 cấp, 34 tỉnh mới, gán và đổi đơn vị hàng loạt, chọn đại lý trên app. Còn A7b |
| R3 | App thử: máy ảnh có dấu vị trí, ghi hành trình nền, xuất Excel | Đã thử thật 12/11 trên iPhone 11, lệch 2,7% so với đồng hồ xe |
| V2 | Báo cáo ghé thăm `/kinh-doanh/check-in` | Bảng, ảnh, xuất Excel đúng mẫu. Còn V2b |
| M1, M3, M12, V1, V3 | Phần máy chủ và hàng đợi của app | Đăng nhập app, gửi check-in, ảnh, vết GPS, km theo GPS, địa chỉ Vietmap. Chưa thử trên điện thoại vì chưa có máy chủ công khai |
| F6 | Docker, file chạy máy chủ, CI/CD, sao lưu | Đã chạy thử trên máy phát triển. Dùng khi đưa lên máy chủ của IT |
| P1 | Máy chủ trên máy cá nhân, Cloudflare Tunnel, expo-updates, bản build Android | 14/11: máy chủ thử chạy bản production, 15.819 đại lý, tunnel chỉ mở API của app; APK Android trên EAS. Chưa build iOS. Ghi chú chuyển lên máy chủ IT: `deploy/CHUYEN_LEN_MAY_CHU_VINASEED.md` |

**Đã bỏ:** đơn hàng (A4 Sản phẩm, A5 Kho, A6 Bảng giá, A10 Quy trình duyệt, S2 đến S7, M8, số liệu Đặt hàng) theo quyết định 27; CSKH (C1 đến C9, R2 Zalo OA, D2 Dashboard CSKH) và các vai trò Quản lý vùng, Sales Admin, CSKH, Lãnh đạo theo quyết định 28.

---

## Giai đoạn 1: Chuẩn bị demo 27/11 (16/11 đến 27/11/2026)

Mục tiêu buổi demo: người xem thấy trọn một vòng làm việc thật, từ nhân viên check-in ngoài thị trường trên app tới quản lý xem báo cáo, bản đồ, dashboard trên web. Số liệu trên màn hình là dữ liệu của nhóm thử đi thật từ 17/11, không dựng dữ liệu giả.

| Ngày | Việc | Buổi |
|---|---|---|
| T2 16/11 | Kế hoạch demo, tài liệu chuyển máy chủ, phát APK cho nhóm thử | |
| T2 16/11 | **M2** Hoàn thiện màn check-in. Làm sớm 1 ngày | 1 |
| T2 16/11 | **G1a** Nhập nhân viên thật, ghép đại lý. Đã xong, sớm 2 ngày | 0,5 |
| T4 18/11 chiều đến T5 19/11 | **M6** App 4 tab | 1,5 |
| T2 16/11 | **M4** Toạ độ đại lý từ check-in, lý do khi check-in xa, Đại lý gần tôi. Làm sớm sau chuyến đi thử | 1 |
| T2 23/11 sáng | **M9a** Bản iPhone qua TestFlight cho người xem demo | 0,5 |
| T2 23/11 chiều đến T3 24/11 sáng | **V2b** Bản đồ hành trình trên web | 1 |
| T3 24/11 chiều đến T4 25/11 | **K0** Dashboard check-in bản đầu | 1,5 |
| T5 26/11 | **DM1** Tổng duyệt demo | 1 |
| T6 27/11 | **Demo** | |

- [x] **M2. Hoàn thiện màn check-in** (xong 16/11, sớm 1 ngày): giờ trên ảnh theo giờ máy chủ (đo lệch giờ mỗi lần gọi máy chủ, mất mạng dùng lần đo trước), font UTM Neo Sans Intel 400 và 700 trong app, nhắc không vuốt tắt app khi đang ghi và báo đoạn hành trình bị đứt khi app iOS bị tắt. Bỏ tên nhân viên trên ảnh theo yêu cầu 16/11 (lượt check-in đã gắn tài khoản).
  - Hộp thoại quyền của iOS hiện tiếng Việt cần build lại app (đã khai báo trong `app.json`), làm cùng lần build có lời đồng ý vị trí.
  - Thêm 17/11: lời đồng ý chia sẻ vị trí (câu chữ đã duyệt, phiên bản `2026-11-17`). Web hỏi ở `/dong-y-vi-tri` sau đăng nhập, Không đồng ý thì không hỏi lại trong phiên; app hỏi trước khi check-in, có nút Rút lại đồng ý (chuyển sang tab Tôi ở M6). Lưu ở bảng `user_consents`, ghi nhật ký.
- [x] **G1a. Nhập tài khoản nhân viên thật và ghép đại lý** (xong 16/11): file 316 tài khoản theo mẫu hệ thống cũ, bỏ 10 tài khoản test, khách và 15 tài khoản kế toán dùng chung, nhập 291 người vào máy chủ thử với vai trò Cán bộ nhân viên, mật khẩu tạm phải đổi lần đầu. Tạo 3 đơn vị con của SSC chưa có: Chi nhánh Lâm Hà `SS-LH`, Phòng Sản xuất `SS-SX`, Chi nhánh Campuchia `SS-CPC` (mã tạm). Ghép theo tên được 9.464 đại lý, còn 2.615 chờ gán (74 tên phụ trách cũ không có trong danh sách, 2 cặp trùng tên). Tài khoản mẫu giữ lại cho buổi demo.
  - Còn thiếu: chức danh, ngày vào làm, quản lý trực tiếp (file không có); vai trò Quản trị đơn vị gán tay khi cần.
- [ ] **M6. App 4 tab: Hôm nay, Tuyến, Lịch sử, Tôi** (2 buổi, kế hoạch duyệt 17/11): thanh tiêu đề xanh logo trắng cỡ M, thanh tab đáy có icon. Hôm nay: Check-in, Đại lý gần tôi, trạng thái ghi kèm Kết thúc ngày, số lượt và km hôm nay, chờ gửi, đại lý gần nhất chưa ghé. Lịch sử: toàn bộ check-in của tôi trong 18 tháng (ảnh 45 ngày), có mạng lấy máy chủ, mất mạng lấy trên máy, lượt chưa gửi gắn Chờ gửi; km từng chặng, tổng km, xuất Excel. Tôi: thông tin, Hỗ trợ tạm, quyền vị trí, rút lại đồng ý, đăng xuất, thông tin kỹ thuật, chân trang. Tuyến: đại lý tôi phụ trách, gần nhất lên đầu.
- [x] **M4. Toạ độ đại lý từ check-in** (làm 16/11, sớm 4 ngày): lần check-in đầu tại đại lý chưa có toạ độ thì đề xuất toạ độ, Quản trị đơn vị duyệt ở `/quan-tri/dai-ly/duyet-toa-do` (quyền `admin.dealer-location.approve`); check-in xa đại lý quá bán kính thì bắt nhập lý do, gắn cờ Xa đại lý.
  - Thêm sau chuyến đi thử 16/11: cách check-in thứ hai **Đại lý gần tôi** trên app; đại lý chưa có toạ độ thì so tên phố lúc chụp với địa chỉ danh mục, khác phố gắn cờ; gõ tên tay đúng tên đại lý mình phụ trách thì máy chủ tự gắn; app tự tìm lại đại lý khi mất mạng.
  - Chưa làm: ước tính toạ độ hàng loạt từ địa chỉ qua Vietmap (chờ duyệt dùng lượt gọi).
- [ ] **V2b. Bản đồ hành trình** (1 buổi): bản đồ một ngày của một nhân viên bằng `leaflet` (đã duyệt): vết đi, các điểm check-in có ảnh; lọc theo đơn vị. Job xoá dữ liệu quá hạn dời sang D5.
- [ ] **K0. Dashboard check-in bản đầu** (1,5 buổi): `/kinh-doanh/dashboard` theo IA §3, chỉ phần không cần FAST: lượt ghé thăm, độ phủ đại lý, **đại lý lâu chưa ghé thăm** theo mốc từng cấp (có danh sách), km di chuyển; lọc kỳ và đơn vị; phạm vi theo vai trò. Thực bán và chỉ tiêu thêm ở K4.
- [ ] **M9a. Bản iPhone qua TestFlight** (0,5 buổi): build iOS bản phát hành, đẩy lên App Store Connect, mời người xem demo làm **người thử nội bộ** (tối đa 100 người trong nhóm App Store Connect, không cần Apple duyệt, không cần bật Chế độ nhà phát triển, không cần UDID). Người thử cài app TestFlight rồi nhận lời mời qua email.
  - Cần: bạn đăng nhập Apple và nhập mã 2 lớp khi build; email Apple ID của người dùng iPhone trong buổi demo.
- [ ] **DM1. Tổng duyệt demo** (1 buổi): kịch bản và tài khoản demo; kiểm tra tunnel, máy chủ thử, dữ liệu nhóm thử; xử lý cảnh báo chứng chỉ trên `https://localhost`; quay sẵn video luồng app để dự phòng mất mạng; sửa lỗi nhóm thử báo.

**Cộng giai đoạn 1: 9 buổi** (P1, G1a, M4, M2 đã xong, còn 5,5).

### Kịch bản demo 27/11 (khoảng 20 phút)

1. **Bài toán** (2 phút): quản lý thị trường hiện nay rời rạc; DMS mới gom check-in, đại lý, báo cáo vào một chỗ.
2. **Web, đăng nhập và Hub** (2 phút): 3 vai trò, mỗi người chỉ thấy dữ liệu trong phạm vi của mình.
3. **Danh mục đại lý** (3 phút): 15.819 đại lý từ DMS cũ, tìm không dấu, 3 cấp, 34 tỉnh mới, gán nhân viên phụ trách.
4. **App check-in** (5 phút, làm trực tiếp): đăng nhập, chọn đại lý, chụp ảnh có giờ và địa chỉ, ghi hành trình, lịch sử và km, xuất Excel. Mất mạng vẫn check-in được.
5. **Web, báo cáo và bản đồ** (4 phút): lượt check-in vừa làm hiện trên web trong 1 phút; bản đồ hành trình; xuất Excel đúng mẫu.
6. **Dashboard** (2 phút): lượt ghé thăm, độ phủ, đại lý lâu chưa ghé thăm, km.
7. **Hỗ trợ** (30 giây): chỉ nút nổi Hỗ trợ trên web và trang Quản trị › Hỗ trợ; phần gửi và trả lời làm ở giai đoạn 3.
8. **Lộ trình** (1 phút): FAST 2 chiều, chỉ tiêu, phát hành app, lên máy chủ IT, dùng thật từ 1/3/2027.

## Giai đoạn 2: Hoàn thiện check-in và thị trường (30/11 đến 14/12/2026)

- [ ] **R4. Máy chủ tìm đường** (1,5 buổi): OSRM bản đồ Việt Nam chạy bằng Docker, khớp vết GPS vào đường; đo trên 3 tuyến có đồng hồ hành trình 0,1 km.
  - **Xong khi**: km theo đường đi lệch đồng hồ xe không quá 5% trên 3 tuyến.
- [ ] **V1b. Khoảng cách theo đường đi** (1 buổi): điền cột Khoảng cách (km) trong báo cáo và Excel; đoạn mất vết nối bằng đường ngắn nhất, ghi "ước tính".
- [ ] **M5. Cờ nghi vấn** (0,5 buổi): thêm tốc độ di chuyển phi lý giữa hai lượt, máy đã root hoặc jailbreak. Không chặn check-in.
- [ ] **A9b. Tham số check-in** (0,5 buổi): giờ tự dừng ghi hành trình, khoảng lọc điểm GPS, bán kính gộp chỗ dừng đưa vào trang Tham số.
- [ ] **A7b. Hoàn thiện danh mục đại lý** (0,5 buổi): gộp đại lý trùng số điện thoại hoặc mã số thuế, chọn toạ độ trên bản đồ, sửa nhanh 2.578 số điện thoại sai dạng. Danh sách lâu chưa ghé thăm đã làm ở K0.
- [ ] **S1. Khách hàng nông dân, hợp tác xã** (1,5 buổi): danh sách, hồ sơ, tạo, sửa; số điện thoại, cây trồng, diện tích, đại lý mua thường xuyên. Check-in loại Khách hàng chọn từ danh sách.
- [ ] **F3b. Năm vai trò** (1 buổi, quyết định 31): thêm Lãnh đạo đơn vị (Trưởng đơn vị) và Quản lý; ô "Có cấp Quản lý" trong cài đặt đơn vị; ô Quản lý trực tiếp trên tài khoản, nhập Excel; Quản lý chỉ thấy NVKD của mình.
- [ ] **A10b. Phê duyệt Tuyến và Chỉ tiêu** (1,5 buổi): luồng NVKD, Quản lý (nếu đơn vị bật), Lãnh đạo đơn vị; duyệt hoặc trả lại kèm lý do, gửi lại; mục Cần duyệt trên web và app; nhật ký mọi bước.
- [ ] **S8. Tuyến theo tuần hoặc theo ngày** (2,5 buổi, thay bản 2 buổi cũ): Quản trị đơn vị chọn kiểu tuyến cho đơn vị; NVKD đăng ký trên app (chọn đại lý, sắp thứ tự, nút sắp theo đường gần nhất), gửi duyệt qua A10b; hạn nộp ở Tham số, nộp muộn gắn nhãn; tuyến đã duyệt hiện ở tab Tuyến và Hôm nay, đánh dấu điểm đã ghé; nút Chỉ đường mở Google Maps theo thứ tự (khoảng 10 điểm mỗi đường dẫn, dài hơn chia đoạn; đại lý chưa có toạ độ dùng địa chỉ). Check-in ngoài tuyến không bị chặn.
- [ ] **K3a. Chỉ tiêu tháng tự đăng ký** (1 buổi): NVKD tạo chỉ tiêu tháng (lượt ghé thăm, số đại lý được ghé, Thực bán kg), gửi duyệt qua A10b; % hoàn thành hiện ở tab Hôm nay (thay M11 ở giai đoạn 5, Thực bán có % khi nối FAST).
- [ ] **M10. Đề xuất đại lý mới trên app** (1 buổi): nhân viên đề xuất tại chỗ (tên, điện thoại, địa chỉ, toạ độ, ảnh); Quản trị đơn vị duyệt; sau khi nối FAST thì đẩy sang FAST ở S10.
- [ ] **M7. Thông báo đẩy** (1 buổi): kế hoạch tuyến mới, toạ độ đại lý đã duyệt, nhắc chưa check-in; dùng lại cho Hỗ trợ ở giai đoạn 3. Cần duyệt thư viện `expo-notifications`.
- [ ] **Sửa lỗi sau demo và đợt thử** (1,5 buổi).

**Cộng giai đoạn 2: 17 buổi** (thêm F3b, A10b, K3a và 0,5 buổi cho S8 theo quyết định 31; lịch các giai đoạn sau dời khoảng 1,5 tuần, xem lại ở bản kế hoạch v7).

## Giai đoạn 3: Hỗ trợ: yêu cầu gửi quản trị (15/12 đến 25/12/2026)

Thay cho CSKH, chỉ trao đổi giữa CBNV và quản trị, không nhắn tin giữa nhân viên với nhau. Không còn là bộ phận trên Hub (quyết định 30). Không phụ thuộc bên ngoài nên làm trước FAST. Chi tiết ở mục "Kế hoạch module Hỗ trợ" phía dưới. 

- [ ] **T1. Nền dữ liệu và cập nhật tức thì** (1,5 buổi)
- [ ] **T2. Hỗ trợ trên web** (2 buổi): nhân viên gửi yêu cầu qua nút nổi, Quản trị đơn vị trả lời ở `/quan-tri/ho-tro`, chuyển lên Quản trị hệ thống (phần H0 cũ), thêm ảnh đính kèm, lọc, trạng thái.
- [ ] **T3. Màn hình Hỗ trợ trên app** (2 buổi)
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
- [ ] **K4. Dashboard Kinh doanh** (1 buổi): thêm Thực bán, so chỉ tiêu, so cùng kỳ vào dashboard bản đầu K0.
- [ ] **K5. Báo cáo Kinh doanh** (1,5 buổi): bảng số theo đại lý, nhân viên, đơn vị, kỳ; xuất Excel theo phạm vi.
- [ ] **K6. Tổng quan điều hành** (1 buổi): dành cho Quản trị hệ thống và người được cấp quyền.
- [x] ~~**M11. Chỉ tiêu của tôi trên app**~~ gộp vào K3a (17/11).

**Cộng giai đoạn 5: 7 buổi.**

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

- [ ] **G2. Nghiệm thu theo kịch bản** (15/2 đến 26/2): Thị trường (check-in 3 loại điểm, mất mạng, ngoài bán kính, km, báo cáo Excel), Hỗ trợ (gửi yêu cầu bằng nút nổi trên web và màn hình Hỗ trợ trên app, Quản trị đơn vị nhận và chuyển lên Quản trị hệ thống), Quản trị (tài khoản, 3 vai trò, thiết bị, đại lý), FAST (đại lý 2 chiều, công nợ, đối soát Thực bán), Dashboard (phạm vi từng vai trò).
- [ ] **G3. Đào tạo và tài liệu** (tuần 22/2): hướng dẫn theo 3 vai trò, tài liệu vận hành cho IT.
- [ ] **G4. Đưa vào dùng theo 3 đợt**: đợt 1 một đơn vị thí điểm từ 1/3; đợt 2 khoảng nửa số đơn vị từ 8/3; đợt 3 toàn bộ 300 đến 400 người từ 15/3/2027.

---

## Kế hoạch module Hỗ trợ (giai đoạn 3)

Mục tiêu: CBNV hỏi đáp, báo lỗi, góp ý với Quản trị đơn vị và Quản trị hệ thống ngay trong DMS, có người nhận, có trạng thái, thay cho nhắn rời rạc qua Zalo. Không có nhắn tin giữa nhân viên với nhau.

**Đã chốt 14/11/2026 (quyết định 29):**
1. Gộp Tin nhắn và Báo lỗi thành một mục **Hỗ trợ**. Mỗi lần gửi là một **yêu cầu** có loại (Hỏi đáp, Báo lỗi, Góp ý), trạng thái và phần trao đổi bên trong.
2. Người nhận đầu tiên luôn là Quản trị đơn vị của người gửi. Quản trị đơn vị bấm **Chuyển lên** khi cần Quản trị hệ thống. Đơn vị chưa có Quản trị đơn vị thì gửi thẳng Quản trị hệ thống.
3. Hộp chung của đơn vị: mọi Quản trị đơn vị của đơn vị đó (và đơn vị cha) đều thấy và trả lời được; ai bấm **Nhận xử lý** thì ghi tên người đó.
4. Nội dung và ảnh đính kèm lưu 18 tháng như check-in, rồi tự xoá.

**Chia theo vai trò (quyết định 30, 14/11/2026):**
- Web, Cán bộ nhân viên: **nút nổi Hỗ trợ** ở góc dưới bên phải mọi trang (Hub và các bộ phận). Bấm vào mở khung bên phải: yêu cầu của tôi, tạo yêu cầu, trao đổi trong từng yêu cầu. Tự gắn trang đang mở. Nút có số đỏ khi quản trị trả lời. Đã gắn nút vào khung trang ngày 14/11, khung tạm hiện cách liên hệ Phòng ĐMST&CĐS.
- Web, Quản trị đơn vị và Quản trị hệ thống: trang đầy đủ **Quản trị › Hỗ trợ** `/quan-tri/ho-tro` để tiếp nhận, xử lý, **Chuyển lên** Quản trị hệ thống. Quản trị đơn vị vào Quản trị thì mở thẳng trang này. Không hiện nút nổi.
- App: **màn hình Hỗ trợ riêng**, mở từ đầu tab Tôi; tab Tôi có số đỏ khi có trả lời; khi gửi dữ liệu lỗi có nút "Báo lỗi này".

**Quyền** (đổi 14/11/2026): `support.request.create` Gửi Yêu cầu hỗ trợ (Cán bộ nhân viên; người gửi chỉ thấy yêu cầu của mình), `support.request.manage` Xử lý Yêu cầu hỗ trợ (Quản trị đơn vị trong đơn vị và đơn vị con, Quản trị hệ thống toàn công ty).

**Mã yêu cầu**: `HT-yyyy-nnnnn`, ví dụ `HT-2026-00012`.

**Trạng thái**: Mới, Đang xử lý, Chờ người gửi, Đã xong. Người gửi bấm **Mở lại** trong 7 ngày nếu chưa ổn; sau 7 ngày ở Đã xong thì tự đóng.

| Mã | Nội dung | Xong khi |
|---|---|---|
| T1 | Bảng yêu cầu, tin trao đổi trong yêu cầu, tệp đính kèm (MinIO), lịch sử trạng thái và người nhận. Cập nhật tức thì trên web bằng SSE, app nhận qua thông báo đẩy (M7). Đánh dấu đã xem | Trả lời ở web, app người gửi thấy trong 1 phút |
| T2 | Web. Nhân viên, trong khung của nút nổi: danh sách yêu cầu của tôi, tạo yêu cầu (loại, tiêu đề, mô tả, mức độ nếu là Báo lỗi: chặn công việc, ảnh hưởng, nhẹ; ảnh chụp màn hình). Quản trị, ở `/quan-tri/ho-tro`: hộp chung theo đơn vị, lọc theo trạng thái, loại, mức độ; Nhận xử lý, Chuyển lên, đổi trạng thái. Trao đổi ngay trong yêu cầu. Số chưa đọc trên nút nổi, số chờ xử lý trên menu Quản trị | Tạo, nhận, chuyển lên, đóng một yêu cầu chạy trên 1440 và 375 px |
| T3 | App, màn hình Hỗ trợ mở từ tab Tôi: yêu cầu của tôi, tạo yêu cầu, chụp ảnh màn hình đính kèm, tự gắn phiên bản app, loại máy, màn hình đang dùng; soạn lúc mất mạng thì gửi sau; nút **Báo lỗi này** khi gửi dữ liệu lỗi | Bật chế độ máy bay tạo 1 yêu cầu và 2 tin, có mạng thì gửi đủ, không trùng |
| T4 | Thời hạn phản hồi đầu và xử lý theo mức độ (ở Tham số), nhắc Quản trị đơn vị khi sắp quá hạn, báo Mattermost khi Báo lỗi mức chặn công việc quá hạn; thống kê theo đơn vị, loại, mức độ, thời gian xử lý | Yêu cầu quá hạn hiện ở Hub và thống kê |
| T5 | Tự xoá nội dung và ảnh sau 18 tháng, chỉ nhận ảnh, PDF, Excel, Word dưới 10 MB, nhật ký mọi thao tác nhận, chuyển, đổi trạng thái | Gửi tệp .exe bị từ chối; nhật ký ghi đủ người và giờ |

---

## Tóm tắt thời gian

| Giai đoạn | Thời gian | Buổi làm | Kết quả |
|---|---|---|---|
| 1. Chuẩn bị demo | 16/11 đến 27/11/2026 | 9 | **Demo 27/11**: app check-in Android và iPhone, nhân viên thật, báo cáo, bản đồ, dashboard check-in |
| 2. Hoàn thiện check-in và thị trường | 30/11 đến 14/12/2026 | 11 | Km theo đường đi, cờ nghi vấn, khách hàng, tuyến, đề xuất đại lý mới, thông báo |
| 3. Hỗ trợ | 15/12 đến 25/12/2026 | 7 + 2 dự phòng | Hỗ trợ đầy đủ trên web và app |
| 4. FAST | 28/12/2026 đến 12/1/2027 | 10 | Đại lý 2 chiều, nút Đồng bộ FAST, công nợ, Thực bán |
| 5. Dashboard và chỉ tiêu | 13/1 đến 22/1/2027 | 7 | Thực bán và chỉ tiêu trên dashboard, báo cáo, Tổng quan điều hành |
| 6. Hoàn thiện | 25/1 đến 5/2/2027 | 9 | Hiệu năng, bảo mật, phát hành app, lên máy chủ IT |
| 7. Nghiệm thu và đưa vào dùng | 15/2 đến 19/3/2027 | | 3 đợt, toàn bộ người dùng |
| **Tổng** | **16/11/2026 đến 19/3/2027, khoảng 18 tuần** | **53 buổi + 2 dự phòng** | |

**Dự kiến hoàn thành toàn bộ: 19/3/2027**, theo dõi sau khi dùng thật thêm 2 tuần tới 2/4/2027. Bản v6 kéo V2b, dashboard check-in, nhập nhân viên và TestFlight lên trước demo, dời R4, V1b, M5, A9b, H0 ra sau; giữ nguyên mốc, 2 buổi dự phòng ở giai đoạn 3.

**Mốc có thể dùng sớm:** check-in và báo cáo ghé thăm đủ dùng cho một đơn vị khoảng 30 người từ khoảng 14/12/2026, nếu đưa lên máy chủ của IT sớm (F7 làm trước) và phát hành app bằng TestFlight hoặc file APK. Máy cá nhân chỉ đủ cho 2 đến 3 tài khoản thử.

**Đường găng tới demo:** nhóm thử đi thật từ 17/11 (có dữ liệu cho báo cáo, bản đồ, dashboard) → máy cá nhân và tunnel chạy ổn định tới 27/11 → tổng duyệt 26/11.

**Đường găng cả dự án:** nhóm thử trên máy cá nhân (P1) → FAST gửi tài liệu API (R1) → đại lý 2 chiều (S10) và Thực bán (K2) → dashboard (K4) → máy chủ IT và phát hành app (F7, M9) → nghiệm thu. Chậm ở FAST thì đổi chỗ giai đoạn 4 và 5; chậm ở Apple thì đợt đầu dùng Android trước.

## Việc cần người ngoài làm, hạn chót

| Ai | Việc | Hạn |
|---|---|---|
| Bạn | Chọn 2 đến 3 người thử, cài APK, bắt đầu đi thật | 17/11/2026 |
| Bạn | Chốt thời gian, phòng, máy chiếu, mạng cho buổi demo; ai có mặt | 24/11/2026 |
| Bạn | ~~Danh sách nhân viên~~ đã gửi 16/11, đã nhập | Xong |
| Bạn | Địa chỉ cố định cho máy chủ thử: Vinaseed đã có `vinaseed.com.vn` nhưng tunnel có tên cần tên miền nằm trên Cloudflare. Chọn: giữ tunnel tạm tới demo, mua một tên miền riêng cho đợt thử, hay nhờ IT (để sau demo) | 18/11/2026 |
| Bạn | Email Apple ID của người dùng iPhone trong buổi demo, có mặt để đăng nhập Apple khi build TestFlight | 20/11/2026 |
| FAST và Kế toán | Tài liệu API đọc và ghi khách hàng, đọc công nợ, hoá đơn bán; chốt dải mã `DL` cho đại lý tạo từ DMS | 11/12/2026 |
| IT | Bot Mattermost và kênh nhận thông báo | 18/12/2026 |
| Lãnh đạo Kinh doanh | Lịch vụ, cách giao chỉ tiêu, mẫu chỉ tiêu đang dùng | 8/1/2027 |
| Kế toán | Số liệu bán năm trước để so cùng kỳ | 8/1/2027 |
| IT Vinaseed | Máy chủ Ubuntu, tên miền con, mở cổng 80 và 443, thư mục sao lưu (`deploy/README.md`) | 22/1/2027 |
| Pháp chế, Hành chính | Hình thức phát hành app iOS cho 300 đến 400 người, tài khoản Google Play | 15/1/2027 |

## Rủi ro chính

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| Lịch tới demo chỉ còn 8 buổi | Không kịp đủ việc | Thứ tự cắt khi chậm: phần lọc kỳ của K0 trước, rồi M4. M2, M6, V2b, K0 là phần chính của buổi demo |
| Dữ liệu thật ít vì chỉ 2 đến 3 người đi 8 ngày | Dashboard và bản đồ thưa | Nhóm thử đi nhiều điểm mỗi ngày, có thể thêm người thử; nói rõ khi demo đây là dữ liệu đợt thử |
| Mạng phòng họp chập chờn, tunnel đổi địa chỉ đúng ngày demo | Check-in trực tiếp không lên web | App vẫn check-in khi mất mạng rồi gửi sau; không khởi động lại máy từ 26/11; quay sẵn video luồng app ở DM1 |
| Trình duyệt cảnh báo chứng chỉ khi mở `https://localhost` trước người xem | Mất điểm khi trình bày | Xử lý ở DM1: bạn cài chứng chỉ gốc của máy chủ thử vào máy trình chiếu, hoặc mở sẵn trang trước giờ demo |
| FAST không cho ghi khách hàng qua API | Không đẩy được đại lý mới sang FAST | Đề xuất đại lý mới vẫn duyệt trên DMS, kế toán tạo tay trên FAST, đồng bộ về tự ghép theo mã |
| FAST không có API đọc | Chậm công nợ, Thực bán | Dùng file Excel xuất từ FAST, nhập theo lịch |
| Máy cá nhân tắt hoặc chậm trong đợt thử | App không gửi được dữ liệu | App lưu trên máy và gửi lại sau, không mất check-in; đưa lên máy chủ IT sớm nếu cần mở rộng |
| Apple duyệt app lâu hoặc từ chối quyền vị trí nền | Chậm phát hành iOS | Nộp sớm từ 25/1, đã có lời giải trình trong R3_THU_NGHIEM.md; Android đi trước |
| Pin hao khi ghi hành trình cả ngày | Nhân viên tắt app | Đo trong đợt thử, chỉnh khoảng lọc điểm ở Tham số |

## Rà soát

- [ ] Rà thiết kế đối chiếu DESIGN_BRIEF và IA: sau giai đoạn 1 (app và báo cáo), sau T2 (Hỗ trợ trên web), sau K4 (Dashboard), trước G2.
- [ ] Rà code cho mỗi thay đổi có Server Action, API cho app hoặc webhook.
