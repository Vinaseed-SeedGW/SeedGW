# Build Tasks: DMS Vinaseed (Hub + Kinh doanh + CSKH + Quản trị + App check-in)

Dựa trên: DESIGN_BRIEF.md (quyết định 1 đến 27), INFORMATION_ARCHITECTURE.md, CHECK_IN_PLAN.md
Bản v4, 13/11/2026: **bỏ phần đơn hàng** (quyết định 27), chia lại task theo giai đoạn mới, ước lượng lại thời gian theo tốc độ làm thực tế.

## Cách đọc

- Mỗi task là một phần làm xong là chạy được, kiểm tra được (database, máy chủ, giao diện, quyền).
- **Ước lượng tính theo buổi**: 1 buổi là một ngày làm việc của bạn với Claude, gồm cả lúc bạn thử và duyệt. Claude viết code; thời gian thực tế phụ thuộc nhiều vào việc thử ngoài thị trường và việc chờ IT, FAST, Zalo, Apple.
- Tốc độ dùng để ước lượng lấy từ 11 đến 13/11/2026: phần máy chủ check-in (đăng nhập app, gửi dữ liệu, km, địa chỉ, báo cáo Excel) xong trong 1 buổi; danh mục đại lý A7 (nhập 15.819 đại lý, danh sách, hồ sơ, gán) xong trong 1 buổi.
- Lịch tính 5 buổi mỗi tuần, bắt đầu thứ Hai 16/11/2026, có dự phòng 20% cho sửa lỗi sau khi thử thật.
- Đường dẫn và tên gọi trên giao diện theo INFORMATION_ARCHITECTURE.md.

---

## Đã xong (tới 13/11/2026)

| Mã | Nội dung | Ghi chú |
|---|---|---|
| F1 | Đăng nhập, Hub 3 bộ phận | |
| F2 | Nhận diện thương hiệu, token, AppShell | |
| F3 | Phân quyền theo vai trò, phạm vi dữ liệu | |
| F4 | Bảng dữ liệu dùng chung | |
| F5 | Form dùng chung, nhật ký thao tác, thông báo | |
| A1 | Cơ cấu tổ chức | Đã thêm 19 đơn vị từ DMS cũ, sửa tên và vị trí sau |
| A2 | Tài khoản CBNV, nhập Excel, thiết bị di động | Chưa nhập danh sách nhân viên thật |
| A3 | Vai trò và ma trận quyền | |
| A9 | Tham số hệ thống | Đã sửa nhãn theo quyết định 27 |
| A7 | Danh mục đại lý | 15.819 đại lý, mã FAST, 3 cấp, 34 tỉnh mới, gán và đổi đơn vị hàng loạt, chọn đại lý trên app. Phần còn lại ở A7b |
| R3 | App thử: máy ảnh có dấu vị trí, ghi hành trình nền, xuất Excel | Đã thử thật 12/11 trên iPhone 11, lệch 2,7% so với đồng hồ xe |
| V2 | Báo cáo ghé thăm `/kinh-doanh/check-in` | Bảng, ảnh, xuất Excel đúng mẫu. Còn bản đồ, lọc đơn vị, job xoá dữ liệu: V2b |
| M1, M3, M12, V1, V3 | Phần máy chủ và hàng đợi của app | Đăng nhập app, gửi check-in, ảnh, vết GPS, km theo GPS, địa chỉ Vietmap. Chưa thử trên điện thoại vì chưa có máy chủ công khai |
| F6 | Docker, file chạy máy chủ thử, CI/CD, sao lưu | Đã chạy thử trên máy phát triển. Chờ máy chủ ở F7 |

**Đã bỏ (quyết định 27, 13/11/2026):** A4 Sản phẩm, A5 Kho và tồn kho, A6 Bảng giá, A10 Quy trình duyệt (đã xoá code và bảng), S2 đến S7 Đơn hàng và đồng bộ đơn sang FAST, S10 đẩy đại lý mới sang FAST, M8 Tạo đơn trên app, phần Đặt hàng trong dashboard. Làm lại khi có quyết định làm đơn hàng.

---

## Giai đoạn 1: Check-in chạy thử thật với 3 đến 5 người (16/11 đến 27/11/2026)

Mục tiêu: nhóm thử dùng app mỗi ngày, dữ liệu lên máy chủ, quản lý xem báo cáo trên web.

- [ ] **P1. Máy chủ cho nhóm thử và bản build app** (1 buổi): dựng máy chủ thử (máy IT cấp, hoặc tạm laptop qua Cloudflare Tunnel với tên miền cố định), đặt `EXPO_PUBLIC_API_URL`, thêm `expo-updates` để sửa lỗi không cần build lại, build iOS và Android một lần.
  - **Xong khi**: 3 đến 5 người cài app, đăng nhập bằng tài khoản thật, check-in hiện trên web trong 1 phút.
  - Cần: chốt cách đặt máy chủ, tên miền, duyệt `expo-updates`, UDID iPhone của nhóm thử.
- [ ] **G1a. Nhập tài khoản nhân viên thật và ghép đại lý** (0,5 buổi): nhập danh sách nhân viên bằng Excel ở trang Tài khoản, bấm Ghép nhân viên theo tên cho 12.087 đại lý đang chờ gán.
  - Cần: file danh sách nhân viên (mã, họ tên, đơn vị, vai trò).
- [ ] **M2. Hoàn thiện màn check-in** (1 buổi): giờ trên ảnh lấy theo giờ máy chủ đã đồng bộ, tên nhân viên trên ảnh, font và màu theo BRAND, cảnh báo khi vuốt tắt app, câu hỏi quyền tiếng Việt còn sót.
- [ ] **M5. Cờ nghi vấn** (0,5 buổi): đã có giả lập vị trí, sai số lớn, lệch giờ; thêm tốc độ di chuyển phi lý giữa hai lượt, máy đã root hoặc jailbreak. Không chặn check-in.
- [ ] **A9b. Tham số check-in** (0,5 buổi): giờ tự dừng ghi hành trình, khoảng lọc điểm GPS, bán kính gộp chỗ dừng đưa vào trang Tham số.
- [ ] **M6. App 4 tab: Hôm nay, Tuyến, Lịch sử, Tôi** (1,5 buổi): lịch sử check-in của tôi theo ngày, km từng chặng và tổng km, chân trang ở tab Tôi.
- [ ] **R4. Máy chủ tìm đường** (1,5 buổi): OSRM bản đồ Việt Nam chạy bằng Docker, khớp vết GPS vào đường; đo trên 3 tuyến Hà Nội có đồng hồ hành trình 0,1 km.
  - **Xong khi**: km theo đường đi lệch đồng hồ xe không quá 5% trên 3 tuyến.
- [ ] **V1b. Khoảng cách theo đường đi** (1 buổi): điền cột Khoảng cách (km) trong báo cáo và Excel; đoạn mất vết thì nối bằng đường ngắn nhất, ghi "ước tính".
- [ ] **M4. Toạ độ đại lý từ check-in** (1 buổi): lần check-in đầu tại đại lý chưa có toạ độ thì đề xuất toạ độ, quản lý vùng duyệt; check-in cách đại lý quá bán kính thì bắt nhập lý do và gắn cờ.
- [ ] **V2b. Bản đồ hành trình, lọc đơn vị, xoá dữ liệu quá hạn** (1 buổi): bản đồ một ngày của một nhân viên, lọc theo đơn vị, job hằng đêm xoá điểm GPS quá 45 ngày, dòng check-in quá 18 tháng.
  - Cần: duyệt thư viện bản đồ `leaflet`.

**Cộng giai đoạn 1: 9,5 buổi.** Nhóm thử chạy song song 2 tuần, từ khoảng 23/11 đến 4/12/2026.

## Giai đoạn 2: Thị trường: đại lý, khách hàng, tuyến (30/11 đến 11/12/2026)

- [ ] **A7b. Hoàn thiện danh mục đại lý** (1 buổi): gộp đại lý trùng số điện thoại hoặc mã số thuế, chọn toạ độ trên bản đồ, sửa nhanh 2.578 số điện thoại sai dạng.
- [ ] **S1. Khách hàng nông dân, hợp tác xã** (1,5 buổi): danh sách, hồ sơ, tạo, sửa; số điện thoại, cây trồng, diện tích, đại lý mua thường xuyên; một hồ sơ, hai lối vào Kinh doanh và CSKH. Check-in loại Khách hàng chọn từ danh sách.
- [ ] **S8. Tuyến và kế hoạch viếng thăm** (2 buổi): gán đại lý vào tuyến theo ngày trong tuần; quản lý vùng lập kế hoạch tuần; app tab Tuyến hiện "Hôm nay cần thăm" và đại lý gần tôi.
- [ ] **M10. Đề xuất đại lý mới trên app** (1 buổi): nhân viên đề xuất tại chỗ (tên, điện thoại, địa chỉ, toạ độ, ảnh); Sales Admin tạo trên FAST; đồng bộ về thì tự ghép theo mã FAST.
- [ ] **M7. Thông báo đẩy** (1 buổi): kế hoạch tuyến mới, toạ độ đại lý đã duyệt, nhắc chưa check-in.
- [ ] **Sửa lỗi sau đợt thử của nhóm 3 đến 5 người** (1,5 buổi).

**Cộng giai đoạn 2: 8 buổi.**

## Giai đoạn 3: FAST chỉ đọc (14/12 đến 25/12/2026)

Phụ thuộc FAST gửi tài liệu API trước 11/12. Nếu chậm thì làm giai đoạn 4 trước, đổi chỗ hai giai đoạn.

- [ ] **R1. Thử API FAST đọc dữ liệu** (1,5 buổi): danh mục khách hàng, công nợ và hạn mức, hoá đơn bán và hàng trả lại. Không có API thì dùng file Excel xuất từ FAST.
- [ ] **F8. Worker chạy nền** (1 buổi): chuyển tính km, lấy địa chỉ, đồng bộ FAST sang hàng đợi BullMQ có thử lại và nhật ký. Cần trước khi quá 30 người dùng.
- [ ] **A8. Kết nối** (1 buổi): trang `/quan-tri/ket-noi` cấu hình FAST, Zalo OA, Mattermost, xem trạng thái và lỗi đồng bộ gần nhất.
- [ ] **S11. Đồng bộ đại lý và công nợ từ FAST** (1,5 buổi): đại lý mới bên FAST tự vào DMS chờ gán nhân viên; công nợ, hạn mức hiện ở hồ sơ đại lý và app.
- [ ] **K2. Doanh số Thực bán từ FAST** (2 buổi): hoá đơn bán và hàng trả lại vào DMS theo chu kỳ, quy ra kg, gắn đại lý và nhân viên phụ trách.

**Cộng giai đoạn 3: 7 buổi.**

## Giai đoạn 4: Chăm sóc khách hàng (28/12/2026 đến 15/1/2027)

Phụ thuộc Khối Marketing cấp quyền Zalo OA trước 18/12.

- [ ] **R2. Thử Zalo OA** (1 buổi): nhận và gửi một tin nhắn qua máy chủ thử.
- [ ] **C1. Phiếu tiếp nhận** (1 buổi): hotline, trực tiếp, email; loại, mức ưu tiên, ảnh, gắn đại lý hoặc khách hàng.
- [ ] **C2. Nhận tin Zalo vào hệ thống** (2 buổi): webhook, chống trùng, tự tạo hội thoại, khách hàng, phiếu.
- [ ] **C3. Hộp thư hợp nhất** (2 buổi): 3 cột, cập nhật ngay bằng SSE.
- [ ] **C4. Trả lời qua Zalo, hạn mức gói Nâng cao** (2 buổi).
- [ ] **C5. Phân công, SLA, chuyển tiếp** (2 buổi).
- [ ] **C6. Mattermost** (1 buổi): báo phiếu mức cao, quá SLA, lỗi đồng bộ FAST; lệnh tra cứu phiếu.
- [ ] **C7. Mẫu trả lời** (0,5 buổi).
- [ ] **C8. Liên kết CSKH với Kinh doanh** (0,5 buổi): tab Phản hồi trong hồ sơ đại lý, khách hàng; khiếu nại theo lô.
- [ ] **C9. Khảo sát hài lòng** (0,5 buổi).

**Cộng giai đoạn 4: 12,5 buổi.**

## Giai đoạn 5: Dashboard và chỉ tiêu (18/1 đến 29/1/2027)

Chỉ số theo INFORMATION_ARCHITECTURE §3: tính từ check-in, đại lý và Thực bán, không còn Đặt hàng.

- [ ] **K1. Nền số liệu** (1,5 buổi): bảng tổng hợp theo ngày cho lượt ghé thăm, độ phủ, km, Thực bán; gắn đơn vị, nhân viên lúc phát sinh; công thức có test.
- [ ] **K3. Chỉ tiêu và Lịch vụ** (1,5 buổi): khai báo vụ; giao chỉ tiêu theo kỳ cho đơn vị, nhân viên: Thực bán và số lượt ghé thăm, độ phủ.
- [ ] **K4. Dashboard Kinh doanh** (2 buổi).
- [ ] **K5. Báo cáo Kinh doanh** (1,5 buổi): bảng số theo đại lý, nhân viên, đơn vị, kỳ; xuất Excel theo phạm vi.
- [ ] **K6. Tổng quan điều hành** (1 buổi).
- [ ] **D2. Dashboard CSKH** (1 buổi).
- [ ] **M11. Chỉ tiêu của tôi trên app** (0,5 buổi).

**Cộng giai đoạn 5: 9 buổi.**

## Giai đoạn 6: Hoàn thiện (1/2 đến 5/2 và 15/2 đến 19/2/2027)

- [ ] **D3. Hub hoàn chỉnh** (1 buổi): số việc chờ thật, tìm kiếm toàn cục Ctrl+K.
- [ ] **D4. Trung tâm thông báo** (1 buổi).
- [ ] **D5. Hiệu năng** (1,5 buổi): chia bảng điểm GPS theo tháng (khoảng 800.000 điểm mỗi ngày với 300 người), chỉ mục, thử tải API app.
- [ ] **D6. Bảo mật** (1 buổi): rà OWASP, thử truy cập chéo phạm vi trên mọi trang `[id]`, giới hạn tần suất đăng nhập, header bảo mật.
- [ ] **D7. Truy cập và giao diện nhiều cỡ màn hình** (1 buổi).
- [ ] **F9. Ghi lỗi Sentry** (0,5 buổi): cần duyệt thư viện và tài khoản Sentry.
- [ ] **M9. Phát hành app** (1,5 buổi + 1 đến 2 tuần chờ duyệt): iOS qua App Store không công khai hoặc Apple Business Manager, Android qua Google Play hoặc file APK; trang hướng dẫn cài có mã QR.
- [ ] **G1. Dữ liệu thật** (1,5 buổi): nhập lại đại lý từ FAST, tài khoản, cơ cấu tổ chức chốt, toạ độ đại lý từ đợt thử.

**Cộng giai đoạn 6: 9 buổi.** Nghỉ Tết Đinh Mùi: dự kiến 6/2 đến 14/2/2027.

## Giai đoạn 7: Nghiệm thu, đào tạo, đưa vào dùng (22/2 đến 26/3/2027)

- [ ] **G2. Nghiệm thu theo kịch bản** (22/2 đến 5/3): Thị trường (check-in 3 loại điểm, mất mạng, ngoài bán kính, km, báo cáo Excel), CSKH (Zalo, phiếu, Mattermost, khảo sát), Quản trị (tài khoản, quyền, thiết bị, đại lý), Dashboard (đối soát Thực bán với báo cáo FAST, phạm vi từng vai trò).
- [ ] **G3. Đào tạo và tài liệu** (song song tuần 1/3): hướng dẫn theo vai trò, tài liệu vận hành cho IT.
- [ ] **G4. Đưa vào dùng theo 3 đợt**: đợt 1 một đơn vị thí điểm từ 8/3; đợt 2 khoảng nửa số đơn vị từ 15/3; đợt 3 toàn bộ 300 đến 400 người từ 22/3/2027. Mỗi đợt theo dõi lỗi và có kế hoạch quay lại.

---

## Tóm tắt thời gian

| Giai đoạn | Thời gian | Buổi làm | Kết quả |
|---|---|---|---|
| 1. Check-in chạy thử thật | 16/11 đến 27/11/2026 | 9,5 | 3 đến 5 người dùng app thật, km theo đường đi, toạ độ đại lý |
| 2. Thị trường | 30/11 đến 11/12/2026 | 8 | Khách hàng, tuyến, đề xuất đại lý mới, thông báo |
| 3. FAST chỉ đọc | 14/12 đến 25/12/2026 | 7 | Công nợ, Thực bán, worker nền |
| 4. CSKH | 28/12/2026 đến 15/1/2027 | 12,5 | Hộp thư Zalo, phiếu, SLA, Mattermost |
| 5. Dashboard và chỉ tiêu | 18/1 đến 29/1/2027 | 9 | 3 dashboard, báo cáo, chỉ tiêu |
| 6. Hoàn thiện | 1/2 đến 19/2/2027 (nghỉ Tết giữa chừng) | 9 | Hiệu năng, bảo mật, phát hành app |
| 7. Nghiệm thu và đưa vào dùng | 22/2 đến 26/3/2027 | | 3 đợt, toàn bộ người dùng |
| **Tổng** | **16/11/2026 đến 26/3/2027, khoảng 19 tuần** | **55 buổi** | |

**Dự kiến hoàn thành toàn bộ: 26/3/2027**, theo dõi sau khi dùng thật thêm 2 tuần tới 9/4/2027.

**Mốc có thể dùng sớm:** check-in và báo cáo ghé thăm đủ dùng cho một đơn vị (khoảng 30 người) từ khoảng 14/12/2026, nếu máy chủ của IT xong trước 4/12 và app phát hành bằng TestFlight hoặc file APK.

**Đường găng:** máy chủ và tên miền (F7) → nhóm thử (P1) → FAST gửi tài liệu API (R1) → Thực bán (K2) → dashboard (K4) → phát hành app (M9) → nghiệm thu. Chậm ở FAST thì đổi chỗ giai đoạn 3 và 4; chậm ở Apple thì đợt đầu dùng Android trước.

## Việc cần người ngoài làm, hạn chót

| Ai | Việc | Hạn |
|---|---|---|
| Bạn | Danh sách nhân viên (mã, họ tên, đơn vị, vai trò) | 20/11/2026 |
| Bạn | Duyệt thư viện: `expo-updates`, `leaflet`; quyết định Face ID (`expo-local-authentication`) | 20/11/2026 |
| IT Vinaseed | Máy chủ Ubuntu, tên miền con, mở cổng 80 và 443, thư mục sao lưu (xem `deploy/README.md`); hoặc đồng ý dùng tạm laptop qua Cloudflare Tunnel | 20/11/2026 |
| Nhóm thử | 3 đến 5 người, UDID iPhone của người dùng iPhone | 20/11/2026 |
| FAST và Kế toán | Tài liệu API đọc khách hàng, công nợ, hoá đơn bán; hoặc mẫu file Excel xuất định kỳ | 11/12/2026 |
| Khối Marketing | Ứng dụng Zalo for Developers, quyền OA, App ID và Secret | 18/12/2026 |
| IT | Bot Mattermost và kênh nhận thông báo | 18/12/2026 |
| Lãnh đạo Kinh doanh | Lịch vụ, cách giao chỉ tiêu, mẫu chỉ tiêu đang dùng | 8/1/2027 |
| Kế toán | Số liệu bán năm trước để so cùng kỳ | 15/1/2027 |
| Pháp chế, Hành chính | Hình thức phát hành app iOS cho 300 đến 400 người (App Store không công khai hoặc Apple Business Manager), tài khoản Google Play | 15/1/2027 |

## Rủi ro chính

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| FAST không có API đọc | Chậm Thực bán và công nợ | Dùng file Excel xuất từ FAST, nhập theo lịch |
| Zalo duyệt quyền chậm | Chậm giai đoạn 4 | Làm phiếu tiếp nhận, Mattermost trước; Zalo nối sau |
| Apple duyệt app lâu hoặc từ chối quyền vị trí nền | Chậm phát hành iOS | Nộp sớm từ 1/2, đã có lời giải trình trong R3_THU_NGHIEM.md; Android đi trước |
| Pin hao khi ghi hành trình cả ngày | Nhân viên tắt app | Đo trong đợt thử, chỉnh khoảng lọc điểm ở Tham số |
| Máy phát triển thiếu RAM | Chậm làm việc | Đã giới hạn WSL 6 GB, tránh build nhiều thứ cùng lúc |

## Rà soát

- [ ] Rà thiết kế đối chiếu DESIGN_BRIEF và IA: sau giai đoạn 1 (app và báo cáo), sau C3 (Hộp thư), sau K4 (Dashboard), trước G2.
- [ ] Rà code cho mỗi thay đổi có Server Action, API cho app hoặc webhook.
