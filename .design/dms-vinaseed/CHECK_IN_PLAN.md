# Kế hoạch phần Check-in và Báo cáo ghé thăm

Ngày: 11/11/2026. Căn cứ: yêu cầu người dùng ngày 11/11/2026, DESIGN_BRIEF §9 mục 20 và 21, mẫu `Bao-cao-cu-ly-di-chuyen.xlsx`.

## 1. Yêu cầu đã chốt

1. Check-in chỉ có trên app điện thoại. Web chỉ có Báo cáo ghé thăm và quãng đường di chuyển.
2. Mỗi check-in ghi: điểm (đại lý, khách hàng hoặc điểm khác), thời gian, địa chỉ, ghi chú, ảnh, km từ điểm trước.
3. **Ảnh bắt buộc**, chụp bằng máy ảnh mở ngay trong app khi bấm Check-in. Khung ngắm luôn hiện vị trí và thời gian, và hai thông tin này được in lên ảnh.
4. **Km theo đường đi thực tế**. App lấy vị trí khoảng 5 giây một lần trong lúc nhân viên đi thị trường.
5. Báo cáo xuất Excel theo mẫu đính kèm, thêm 2 cột **Tên đại lý** và **Ghi chú**.
6. Nhân viên thấy dữ liệu của mình. Quản lý thấy nhân viên mình quản lý.

## 2. Số liệu để tính quy mô

Mẫu Excel ngày 11/11/2026 có 547 lượt check-in của 86 nhân viên, trung bình 5,4 lượt mỗi người mỗi ngày, nhiều nhất 19 lượt. Ước tính khi chạy hết: **300 nhân viên thị trường, 26 ngày làm mỗi tháng**.

| Đại lượng | Ước tính |
|---|---|
| Lượt check-in mỗi tháng | 300 x 5,4 x 26 = khoảng **42.000** |
| Ảnh mỗi tháng (khoảng 300 KB mỗi ảnh sau nén) | khoảng **12,6 GB** |
| Điểm GPS mỗi người mỗi ngày (5 giây một điểm, khoảng 3 giờ di chuyển, đứng yên không ghi) | khoảng 2.200 |
| Điểm GPS mỗi tháng | khoảng **17 triệu** dòng, khoảng 2 GB |

## 3. Cách tính đường đi hiệu quả

### 3.1 Không gọi API bản đồ 5 giây một lần

Gọi API bản đồ mỗi 5 giây từ điện thoại vừa tốn tiền, vừa tốn pin và 3G, vừa hỏng khi mất sóng. Cách làm đề xuất tách ba việc:

1. **App chỉ ghi vị trí**: 5 giây lấy một điểm, chỉ giữ khi đã đi được ít nhất 10 m (đứng yên trong đại lý không sinh điểm). Điểm lưu vào SQLite trên máy.
2. **App gửi theo lô**: khoảng 60 giây gửi một lần mọi điểm đang chờ (khi có mạng). Mất mạng thì giữ lại, có mạng gửi bù. Máy chủ nhận khoảng 5 lượt mỗi giây thay vì 60 lượt nếu gửi 5 giây một lần.
3. **Máy chủ tính km một lần cho mỗi chặng**: khi nhận check-in mới, máy chủ lấy vết GPS từ check-in trước tới check-in này, lọc điểm sai, rồi tính:
   - **Khoảng cách theo GPS (km)**: cộng độ dài các đoạn giữa các điểm GPS đã lọc. Không tốn phí.
   - **Khoảng cách (km)**: đưa vết GPS vào dịch vụ khớp đường (map matching) để bám vào đường thật, rồi lấy độ dài đường đã khớp. Đây là số km dùng chính thức.

### 3.2 So sánh nơi tính khớp đường

Mỗi tháng khoảng 17 triệu điểm, mỗi lần gọi khớp đường nhận tối đa khoảng 100 điểm, nên cần khoảng **170.000 lượt gọi mỗi tháng**.

| Phương án | Chi phí ước tính mỗi tháng | Ưu | Nhược |
|---|---|---|---|
| **Máy chủ tìm đường tự dựng** (OSRM hoặc Valhalla, bản đồ OpenStreetMap Việt Nam), đặt trên máy chủ nội bộ | 0 đ theo lượt. Chỉ tốn máy chủ, ước tính 4 đến 8 GB RAM, cần đo ở R4 | Không giới hạn lượt, không lộ dữ liệu vị trí nhân viên ra ngoài | Đường làng nhỏ có thể thiếu trên OpenStreetMap, phải tự cập nhật bản đồ hàng tháng |
| Google Roads API (Snap to Roads) | 5.000 lượt đầu miễn phí, sau đó 10 USD mỗi 1.000 lượt, từ 100.000 lượt là 8 USD: khoảng **1.500 USD** | Dữ liệu đường tốt | Đắt nhất, dữ liệu vị trí gửi ra nước ngoài |
| Vietmap (có API khớp đường) | Chưa công bố giá khớp đường, phải hỏi Vietmap. Giá chung 50 đ mỗi lượt cho tới 500.000 lượt | Bản đồ Việt Nam, cập nhật địa giới mới | Chưa rõ giá, phụ thuộc bên ngoài |

**Đề xuất: tự dựng máy chủ tìm đường**, có sẵn đường lui sang Vietmap. Code tách riêng một lớp tính khoảng cách đường (`RoadDistanceProvider`), nên đổi nhà cung cấp không phải sửa báo cáo. R4 sẽ đo độ lệch trên vết thật trước khi chốt.

### 3.3 Khi vết GPS bị thiếu

Vết có thể đứt khi nhân viên tắt định vị, máy hết pin, hoặc iPhone chỉ cho phép định vị "Khi dùng app". Quy tắc:

- Đoạn đứt trên 5 phút hoặc trên 2 km: nối đoạn đó bằng đường ngắn nhất giữa hai đầu đoạn (máy chủ tìm đường, không tốn phí).
- Cả chặng không có vết: tính đường ngắn nhất giữa hai điểm check-in.
- Báo cáo đánh dấu dòng có phần ước tính để quản lý biết.

### 3.4 Lọc điểm sai trước khi tính

- Bỏ điểm có độ chính xác kém hơn 50 m.
- Bỏ điểm tạo tốc độ phi lý so với điểm trước (trên 150 km/h).
- **Gộp chỗ dừng** (chốt 13/11/2026 sau lần thử thật): chuỗi điểm nằm trong bán kính 40 m quanh điểm đầu và kéo dài từ 1 phút trở lên được thay bằng một điểm ở giữa. Khi đứng yên, iPhone báo vị trí nhảy qua lại giữa các chỗ cách nhau khoảng 20 m, mỗi lần vượt ngưỡng 10 m nên sinh điểm mới. Cách lọc theo tốc độ và sai số chỉ bỏ được một nửa số km giả này.
- Điểm do ứng dụng giả lập vị trí (Android báo được) vẫn lưu nhưng gắn cờ nghi vấn, không chặn.

### 3.5 Bắt đầu và dừng ghi hành trình

- **Bắt đầu**: tự động ở lượt check-in đầu tiên trong ngày. Lượt đầu ngày có km bằng 0, giống mẫu Excel hiện tại.
- **Dừng**: nhân viên bấm "Kết thúc ngày" trên app, hoặc tự dừng ở giờ cấu hình trong Tham số (mặc định 20:00). Vết sau lượt check-in cuối ngày không dùng để tính km.
- Trong lúc ghi, Android hiện thông báo cố định "DMS đang ghi hành trình" (Android bắt buộc). Lần đầu dùng, app hiện màn đồng ý cho ghi vị trí trong giờ làm việc, vì vị trí là dữ liệu cá nhân (Nghị định 13/2023).

### 3.6 Địa chỉ của điểm check-in

Cột **Địa chỉ** cần đổi toạ độ ra địa chỉ (reverse geocoding), khoảng 42.000 lượt mỗi tháng. Bản đồ OpenStreetMap thiếu nhiều địa chỉ ở Việt Nam và chưa cập nhật tên tỉnh, xã sau sáp nhập, nên **dùng nhà cung cấp Việt Nam**:

| Nhà cung cấp | Giá | Chi phí ước tính mỗi tháng |
|---|---|---|
| Vietmap | 50 đ mỗi lượt cho tới 500.000 lượt | khoảng **2,1 triệu đ** |
| Goong | 1,5 USD mỗi 1.000 lượt dưới 100.000 lượt | khoảng **63 USD** |
| Google | 5 USD mỗi 1.000 lượt, 10.000 lượt đầu miễn phí | khoảng 160 USD |

Máy chủ gọi một lần cho mỗi check-in và lưu lại. Khoá API nằm trên máy chủ, không nằm trong app. Gọi lỗi thì thử lại qua worker, báo cáo vẫn có toạ độ.

Ngoại lệ cho bản thử R3 (chốt 13/11/2026): app gọi thẳng Vietmap để in địa chỉ lên ảnh lúc chụp, chỉ hỏi lại khi đã đi quá 25 m. Mất mạng thì ảnh in "Địa chỉ chưa lấy được" và lúc xuất Excel app hỏi lại. Địa chỉ dạng "33 Hàng Đào, Phường Hoàn Kiếm, Thành phố Hà Nội", theo đơn vị hành chính 2 cấp mới; số nhà khớp được xa chỗ chụp hơn 100 m thì ghi chữ "Gần" phía trước.

### 3.7 Giai đoạn thử, chưa tốn phí (bổ sung 12/11/2026)

Trong R3, R4 và lúc chạy thử với vài nhân viên, dùng các nguồn miễn phí sau. Khi chạy thật mới chuyển sang tài khoản trả phí, chỉ đổi cấu hình trong `.env`, không sửa code.

| Việc | Nguồn miễn phí để thử | Giới hạn |
|---|---|---|
| Khớp vết vào đường, đường ngắn nhất | OSRM tự chạy bằng Docker trên máy phát triển, bản đồ OpenStreetMap Việt Nam | Không giới hạn lượt, máy phát triển cần còn trống khoảng 4 GB RAM |
| Địa chỉ, và so sánh km với khớp đường | Vietmap: đăng ký là có **60.000 lượt miễn phí**, không cần thẻ | Đủ cho R4 (50 toạ độ) và vài tuần chạy thử với 5 đến 10 người |
| Địa chỉ (để so với Vietmap) | Goong: tặng **100 USD** một lần khi đăng ký | Tối đa 30.000 lượt mỗi tháng, 5 lượt mỗi giây |

Không dùng máy chủ OSRM công cộng (`router.project-osrm.org`) và Nominatim công cộng: chỉ dành cho demo, cấm dùng nhiều và dùng cho mục đích thương mại, có thể bị chặn bất cứ lúc nào.

## 4. Máy ảnh trong app

- Bấm **Check-in** là mở ngay máy ảnh của app (`expo-camera`), không mở ứng dụng máy ảnh của điện thoại, không cho chọn ảnh có sẵn.
- Khung ngắm luôn hiện một dải thông tin ở dưới: **giờ phút giây, ngày** (theo giờ máy chủ đã đồng bộ, không theo giờ máy), **toạ độ và sai số**, **địa chỉ** (khi có mạng), tên nhân viên. Sai số trên 50 m thì dải chuyển màu cảnh báo và ghi "Đang chờ định vị chính xác".
- Bấm chụp: app ghép ảnh với dải thông tin thành một ảnh JPEG duy nhất, thông tin được in hẳn lên ảnh. Ảnh được thu về cạnh dài 1600 px, chất lượng 70%, khoảng 300 KB.
- Mất mạng: dải hiện toạ độ và giờ, chưa có địa chỉ. Ảnh vẫn chụp và lưu được.
- **Thư viện cần thêm vào app** (cần bạn duyệt): `expo-camera`, `expo-location`, `expo-task-manager`, `expo-image-manipulator` (đều của Expo, đã có trong định hướng công nghệ), và `react-native-view-shot` (nhỏ, dùng để ghép ảnh với dải thông tin).

## 5. Luồng trên app

1. Bấm **Check-in** → máy ảnh mở → chụp.
2. Chọn điểm:
   - **Đại lý**: app gợi ý đại lý gần nhất, tìm được theo tên hoặc mã.
   - **Khách hàng**: tìm theo tên hoặc số điện thoại.
   - **Điểm khác**: tự đặt tên điểm.
3. Nhập **Ghi chú**: bắt buộc nếu không check-in tại đại lý (lý do, việc đã làm), không bắt buộc nếu tại đại lý.
4. Bấm Lưu → lưu trên máy → gửi khi có mạng. Đại lý hoặc khách hàng ở xa toạ độ đã lưu thì vẫn ghi nhận, có cờ.
5. Tab Lịch sử: các lượt trong ngày, ghi chú, km từng chặng, tổng km.

## 6. Báo cáo ghé thăm trên web

Trang `/kinh-doanh/check-in`, có bảng, bộ lọc, xem ảnh, bản đồ hành trình một ngày của một nhân viên, và nút **Xuất Excel**.

**File Excel theo mẫu**: tiêu đề "BÁO CÁO CỰ LY DI CHUYỂN" gộp ô ở dòng 3, dòng 5 là tiêu đề cột, chữ Times New Roman 11, có viền, cột km định dạng 3 chữ số thập phân.

| Cột | Nội dung |
|---|---|
| STT | |
| Tên đơn vị | Đơn vị của nhân viên tại thời điểm check-in |
| Mã nhân viên | |
| Tên nhân viên | |
| Ngày | Ngày theo giờ Việt Nam, định dạng d/mm/yyyy |
| Thời gian checkin | Giờ:phút theo giờ Việt Nam |
| Địa chỉ | Từ mục 3.6 |
| Khách hàng | Tên khách hàng khi check-in tại khách hàng |
| **Tên đại lý** (mới) | Tên đại lý khi check-in tại đại lý |
| **Ghi chú** (mới) | Ghi chú nhân viên nhập. Với lượt không tại đại lý, đây là lý do bắt buộc |
| Khoảng cách (km) | Theo đường đi thực tế (mục 3.1, 3.3) |
| Khoảng cách theo GPS (km) | Độ dài vết GPS đã lọc |

Thứ tự dòng giữ như mẫu: theo đơn vị, theo nhân viên, giờ mới nhất ở trên. Trong mẫu cũ, cột Thời gian checkin đang lệch giờ (ghi giờ quốc tế như giờ Việt Nam). File mới dùng giờ Việt Nam.

## 7. Dữ liệu

| Bảng | Nội dung chính |
|---|---|
| `CheckIn` | `clientId` (chống trùng), nhân viên, đơn vị lúc check-in, loại điểm, đại lý hoặc khách hàng hoặc tên điểm khác, toạ độ, sai số, giờ trên máy, giờ máy chủ nhận, địa chỉ, ghi chú, ảnh, cờ nghi vấn, `roadDistanceKm`, `gpsDistanceKm`, `isDistanceEstimated` |
| `TrackPoint` | nhân viên, giờ trên máy, toạ độ, sai số, tốc độ, cờ giả lập. Chia bảng theo tháng, xoá sau 45 ngày, vì km đã lưu trên `CheckIn` |
| `TrackSession` | một ngày đi thị trường: bắt đầu, kết thúc, lý do dừng |

### Thời gian lưu (chốt 12/11/2026)

| Dữ liệu | Giữ | Sau thời hạn |
|---|---|---|
| Dòng check-in (mọi cột trong file Excel, kể cả km) | **18 tháng** | Xoá dòng. File Excel xuất được trong 18 tháng gần nhất |
| Ảnh check-in | **45 ngày** | Xoá ảnh trên MinIO bằng quy tắc tự hết hạn. Báo cáo vẫn còn dòng, chỗ ảnh ghi "Ảnh đã hết thời gian lưu" |
| Điểm GPS thô (vết hành trình) | **45 ngày**, cùng thời hạn với ảnh (Claude đề xuất, đổi được) | Xoá bảng tháng cũ. Bản đồ hành trình chỉ xem được trong 45 ngày, km đã tính vẫn giữ 18 tháng |

Ảnh giữ 45 ngày nên kho ảnh chỉ cần khoảng 19 GB, thay vì tăng thêm 12,6 GB mỗi tháng. Quản lý cần xem ảnh hoặc tranh chấp km trong vòng 45 ngày. Một job worker chạy mỗi đêm xoá dữ liệu quá hạn và ghi số dòng đã xoá vào log.

## 8. Rủi ro và cách kiểm soát

| Rủi ro | Cách kiểm soát |
|---|---|
| Ghi vị trí liên tục làm hao pin | Chỉ ghi khi đã di chuyển 10 m, không dùng chế độ chính xác cao nhất, đo pin thật ở R3 |
| iPhone chỉ cho định vị "Khi dùng app", vết bị đứt | Hướng dẫn chọn "Luôn luôn" và kiểm tra quyền mỗi lần mở app. Đoạn đứt nối theo mục 3.3 và đánh dấu |
| Apple và Google xét duyệt quyền vị trí chạy nền | Viết lý do rõ ràng bằng tiếng Việt, quay video minh hoạ cho bản xét duyệt. Bắt đầu sớm ở R3 |
| Đường làng thiếu trên OpenStreetMap | R4 so km tính ra với đồng hồ xe trên vài tuyến thật; lệch nhiều thì chuyển sang Vietmap |
| Nhiều dữ liệu điểm GPS | Gửi theo lô, chia bảng theo tháng, xoá điểm cũ, chỉ giữ km đã tính |

## 9. Việc cần bạn quyết hoặc cung cấp

1. Duyệt các thư viện ở mục 4.
2. Chọn nhà cung cấp địa chỉ: Vietmap hay Goong. Đăng ký tài khoản đứng tên Vinaseed và gửi khoá API cho tôi qua file `.env` trên máy chủ, không gửi trong chat.
3. Máy chủ nội bộ cho dịch vụ tìm đường: khoảng 4 CPU, 8 GB RAM, 50 GB ổ đĩa (số chính xác đo ở R4). Làm cùng IT Vinaseed trong F7.
4. ~~Thời gian lưu~~: đã chốt 12/11/2026, dòng check-in 18 tháng, ảnh 45 ngày, điểm GPS 45 ngày (mục 7).
5. Giờ tự dừng ghi hành trình (đề xuất 20:00).
6. Một nhân viên thử nghiệm có xe máy để đo km thật trong R3, R4.

## 10. Nguồn giá

- Google Maps Platform pricing: https://developers.google.com/maps/billing-and-pricing/pricing
- Goong pricing: https://goong.io/pricing-plans/
- Vietmap Maps API: https://maps.vietmap.vn, https://maps.vietmap.vn/docs/map-api/overview/ (60.000 lượt miễn phí) và https://maps.vietmap.vn/docs/map-api/console/request-to-transaction/
- Chính sách máy chủ OSRM demo: https://github.com/Project-OSRM/osrm-backend/wiki/API%20Usage%20Policy
- Expo Location (chạy nền): https://docs.expo.dev/versions/latest/sdk/location/

Giá tra ngày 11/11/2026, cần kiểm tra lại khi ký hợp đồng.

## 11. Tuyến đo km thử ở nội thành Hà Nội (bổ sung 12/11/2026)

Người đo: người dùng tự đi bằng xe máy, dùng bản app thử của R3. Mỗi tuyến dài 5 đến 10 km để sai số 0,1 km của đồng hồ xe không đáng kể (5% của 5 km là 0,25 km). Mỗi tuyến có 2 đến 3 lần dừng để check-in, như đang ghé đại lý.

| Tuyến | Đi qua | Kiểm tra điều gì |
|---|---|---|
| 1. Đường lớn | Xuất phát và về tại trụ sở, ghé Hồ Gươm và Quảng trường Ba Đình | Trường hợp dễ: đường rộng, ít nhà cao. Km phải lệch rất ít |
| 2. Phố cổ | Vòng quanh khu phố cổ: Hồ Gươm, Hàng Đào, chợ Đồng Xuân, về Hồ Gươm | Phố một chiều, phố hẹp, nhà sát nhau làm GPS nhảy, đi chậm và dừng nhiều |
| 3. Ngõ nhỏ | Ngõ trong khu Kim Liên, Phương Mai, Khương Thượng | Ngõ ngách thay cho đường làng: đường có thể thiếu trên bản đồ, nhiều chỗ rẽ |
| 4. Dưới cầu cạn (nếu có thời gian) | Đường Khuất Duy Tiến hoặc Nguyễn Xiển, dưới Vành đai 3 trên cao | Xe máy đi đường dưới, hệ thống không được khớp nhầm lên đường trên cao |

Cách đo:

1. Trước khi đi, đưa đồng hồ hành trình (trip) của xe về 0. Xe không có trip thì dùng số tổng.
2. Mở app, bấm Bắt đầu ghi, rồi để app chạy nền và tắt màn hình. Điện thoại để trong túi hoặc trên giá đều được, ghi lại cách để.
3. Mỗi lần dừng: dùng máy ảnh trong app chụp **mặt đồng hồ xe**. Ảnh có sẵn giờ và toạ độ, nên không phải ghi tay số km từng chặng.
4. Về tới nơi: chụp đồng hồ lần cuối, bấm Kết thúc ngày, bấm Xuất vết GPS và gửi file cho Claude.
5. Claude tính km từng chặng bằng máy chủ tìm đường, so với số trên ảnh đồng hồ và ghi kết quả vào báo cáo R4.

Giới hạn: nội thành Hà Nội không có đường làng, là chỗ bản đồ OpenStreetMap dễ thiếu nhất. Khi có dịp, nên đo thêm một tuyến ở vùng có đại lý ngoài nội thành, ví dụ Gia Lâm hoặc Đông Anh, trước khi chốt bản đồ miễn phí.
