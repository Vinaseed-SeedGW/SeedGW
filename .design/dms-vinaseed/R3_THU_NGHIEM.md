# R3. Thử app check-in trên điện thoại thật

Cập nhật: 12/11/2026. Liên quan: [CHECK_IN_PLAN.md](CHECK_IN_PLAN.md), task R3 và R4 trong [TASKS.md](TASKS.md).

## 1. App thử đã có gì

Code nằm ở `apps/mobile`. Đây là bản thử để đo trên máy thật. Đăng nhập, tab, gửi dữ liệu lên máy chủ làm ở M1, M3, M12.

| Phần | Cách làm | File |
|---|---|---|
| Máy ảnh trong app | Mở máy ảnh ngay trong app, không chọn được ảnh có sẵn. Khung ngắm hiện giờ, ngày, toạ độ, sai số. Sai số trên 50 m thì báo "Đang chờ định vị chính xác" | `src/components/watermark-camera.tsx` |
| In thông tin lên ảnh | Ảnh thu về cạnh dài 1600 px, ghép với dải thông tin rồi lưu thành một JPEG chất lượng 70%. Màn xem lại báo dung lượng ảnh | `src/components/watermark-strip.tsx` |
| Ghi hành trình chạy nền | 5 giây một lần, chỉ khi đã đi thêm 10 m, độ chính xác High. Android hiện thông báo cố định "DMS đang ghi hành trình". Tự dừng lúc 20:00 | `src/sync/background-tracking.ts` |
| Lưu trên máy | SQLite: điểm GPS, ảnh, phiên ghi, lỗi chạy nền. Tắt mạng vẫn ghi | `src/sync/track-db.ts` |
| Màn theo dõi | Số điểm GPS (bao nhiêu điểm khi app ở nền), điểm gần nhất, km theo GPS đã lọc, điểm sai số kém, điểm giả lập, số đoạn đứt, ảnh đã chụp | `src/components/tracking-panel.tsx` |
| Xuất dữ liệu | Nút "Xuất vết GPS hôm nay" gửi file CSV qua Gmail, Zalo để phân tích ở R4 | `exportDayCsv` |
| Đồng ý ghi vị trí | Lần đầu bấm ghi, app hỏi đồng ý (Nghị định 13/2023), rồi hướng dẫn chọn quyền vị trí Luôn cho phép | `src/components/use-tracking.ts` |

Chụp ảnh check-in đầu tiên trong ngày sẽ tự bật ghi hành trình, đúng như kế hoạch.

Chưa có trong bản thử: địa chỉ trên ảnh (V3), giờ máy chủ (M2), tên nhân viên (M1), font UTM Neo Sans Intel (M1), gửi dữ liệu lên máy chủ (M3, M12).

Đã kiểm tra trên máy tính: kiểm tra kiểu, lint, đóng gói được bản Android và iOS, quyền trong cấu hình đúng (máy ảnh, vị trí, vị trí nền, dịch vụ nền Android; đã chặn quyền ghi âm). **Chưa chạy trên điện thoại thật.**

## 2. Cách cài lên điện thoại

Ghi vị trí chạy nền không chạy được trong Expo Go, phải có bản build riêng của app.

### Android (làm được ngay)

Máy tính này chưa có Android Studio, nên dùng dịch vụ build trên mạng của Expo (EAS). Gói miễn phí đủ cho giai đoạn thử.

1. Người dùng tạo tài khoản tại expo.dev (miễn phí). Nên dùng email công việc của Vinaseed.
2. Người dùng tự đăng nhập trong terminal, Claude không nhập mật khẩu thay:
   ```
   npx eas-cli login
   ```
3. Claude chạy `eas init` và `eas build --platform android --profile thu-nghiem`. Khoảng 15 đến 30 phút sau có đường link tải file APK.
4. Mở link trên điện thoại Android, cài file APK. Android sẽ hỏi cho phép cài từ nguồn ngoài, chọn cho phép.

### iPhone (chờ tài khoản Apple)

Cài app tự build lên iPhone cần tài khoản Apple Developer (99 USD một năm). Nên dùng tài khoản đứng tên Vinaseed, cần số D-U-N-S, mất 1 đến 3 tuần. Có tài khoản thì đăng ký iPhone thử rồi build như Android.

Trong lúc chờ: thử riêng phần máy ảnh trên iPhone bằng Expo Go. Ghi hành trình chạy nền thì không thử được theo cách này.

## 3. Kịch bản thử

Ghi kết quả vào bảng ở mục 4. Trước khi bắt đầu một ngày thử, sạc đầy pin và ghi lại % pin.

| Mã | Việc | Cách làm |
|---|---|---|
| A | Máy ảnh trong nhà | Chụp 3 ảnh trong văn phòng. Xem lại ảnh: đọc rõ giờ, toạ độ không, sai số bao nhiêu m |
| B | Máy ảnh ngoài nắng | Chụp 3 ảnh ngoài trời lúc 11 đến 14 giờ. Mở ảnh xem dải chữ có rõ không |
| C | Ghi 8 giờ | Bấm Bắt đầu ghi lúc vào ca, đi thị trường như bình thường, app ở nền, màn hình tắt. Cuối ngày ghi % pin còn lại, số điểm GPS, số đoạn đứt |
| D | Tắt mạng | Bật chế độ máy bay khoảng 30 phút khi đang di chuyển (GPS vẫn chạy). Số điểm GPS phải tiếp tục tăng |
| E | Tắt app hẳn | Vuốt tắt app khỏi danh sách đa nhiệm khi đang ghi. Android: thông báo cố định còn hay mất, điểm còn tăng không |
| F | Giả lập vị trí (Android) | Bật Tuỳ chọn nhà phát triển, chọn một ứng dụng giả lập vị trí, chụp một ảnh. Màn xem lại phải báo "Vị trí đến từ ứng dụng giả lập" |
| G | Tự dừng | Để app ghi qua 20:00. Lần mở app sau đó phải báo Đã dừng |
| H | Đo km (R4) | Đi các tuyến Hà Nội ở CHECK_IN_PLAN §11, chụp đồng hồ xe ở mỗi lần dừng, cuối buổi bấm Xuất vết GPS hôm nay và gửi file |

## 4. Bảng kết quả

| Mục | Android (tên máy: ...) | iPhone (tên máy: ...) |
|---|---|---|
| Sai số GPS trong nhà (m) | | |
| Sai số GPS ngoài trời (m) | | |
| Dung lượng ảnh (KB) | | |
| Dải chữ đọc rõ ngoài nắng | | |
| % pin đầu ngày, cuối ngày, số giờ ghi | | |
| Số điểm GPS, số điểm khi app ở nền | | |
| Số đoạn đứt, đoạn dài nhất (phút) | | |
| Tắt mạng 30 phút: điểm vẫn tăng | | |
| Vuốt tắt app: còn ghi không | | |
| Phát hiện vị trí giả lập | | không áp dụng |
| Tự dừng lúc 20:00 | | |
| Lỗi khi chạy nền | | |

Ngưỡng đạt: hao pin không quá 25% trong 8 giờ ghi; không có đoạn đứt khi đang di chuyển với quyền Luôn cho phép; ảnh đọc rõ ngoài nắng. Vượt ngưỡng pin thì thử giảm độ chính xác hoặc tăng khoảng cách lọc lên 20 m.

### Kết quả ngày 12/11/2026 (iPhone 11, đi xe máy trong nội thành Hà Nội)

| Mục | Kết quả |
|---|---|
| Thời gian ghi | 4 phiên, tổng 2 giờ 42 phút |
| Số điểm GPS | 2.759, trong đó 2.599 điểm (94%) khi app ở nền |
| Sai số GPS | thường 14 m; 5 điểm trên 50 m, gồm lúc qua hầm Kim Liên (133 m trong 10 giây) |
| Đoạn đứt | không có đoạn nào trên 5 phút khi đang di chuyển |
| Vị trí giả lập | không có |
| Km theo đồng hồ xe | 36 km (37.025 đến 37.061, đồng hồ chỉ hiện số nguyên nên thực tế từ 35 đến 37 km) |
| Km GPS chưa lọc | 37,91 km, cao hơn đồng hồ khoảng 5% |
| Km GPS chỉ bỏ điểm sai số lớn (cách app thử đang dùng) | 37,80 km |
| Km GPS sau khi gộp chỗ dừng | **36,97 km, lệch 2,7% so với 36 km, nằm trong khoảng đồng hồ cho phép** |
| Km giả do đứng yên | khoảng 0,94 km trên 15 chỗ dừng, lớn nhất 198 m trong 18 phút đứng ở khu Hồ Tây |

Kết luận: ghi nền trên iPhone ổn định, hình dạng vết khớp đường phố, km sau khi gộp chỗ dừng đạt ngưỡng lệch 5%. Lần đo R4 nên dùng đồng hồ hành trình (trip) có số lẻ 0,1 km và chụp đồng hồ ở từng chặng để so chính xác hơn.

## 5. Nội dung giải trình quyền vị trí chạy nền

Google Play và Apple đều duyệt kỹ quyền vị trí chạy nền. Google yêu cầu nộp video ngắn quay màn hình đồng ý và lúc app đang ghi.

### Google Play (Permissions Declaration, mục Location permissions)

> DMS Vinaseed is an internal app for Vinaseed sales staff. After the first customer check-in of the workday, the app records the staff member's location in the background until the staff member taps "End day" or until 20:00. The recorded route is used only to calculate the road distance travelled between consecutive check-ins, which appears in the visit report used by the company's accountants for travel allowances. A persistent notification is shown the whole time location is recorded. Users see a consent screen explaining this before any location is recorded. The app does not record location outside working hours and does not share it with third parties.

### Apple (App Review notes)

> This is an internal business app distributed to Vinaseed employees only. Background location ("Always") is used during the workday, starting at the first check-in and ending when the user taps "End day" or at 20:00, to calculate the road distance between customer visits for travel reimbursement. The blue location indicator is shown while recording. A consent screen is shown before the first recording. A demo account and a video of the flow are provided.

Bản tiếng Việt cho nhân viên đọc nằm ở màn đồng ý trong app và trong câu hỏi quyền của hệ điều hành (`app.json`).

## 6. Việc cần người dùng làm

1. Tạo tài khoản expo.dev và đăng nhập `npx eas-cli login` trong terminal, báo Claude để build Android.
2. Chuẩn bị 1 máy Android để thử (máy của người đi đo km là tốt nhất).
3. Khởi động thủ tục tài khoản Apple Developer đứng tên Vinaseed, kèm 1 iPhone để thử.
