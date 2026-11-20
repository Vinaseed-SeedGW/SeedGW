# Việc cần anh/chị và các bộ phận thực hiện

Tài liệu này liệt kê mọi việc Claude **không thể làm thay** trong dự án SeedGW: tạo tài khoản, ký và thanh toán, nhập mật khẩu hoặc khoá bí mật, làm việc với đối tác, chốt quy định nghiệp vụ.

Mỗi việc gồm: vì sao cần, cần chuẩn bị gì, làm từng bước thế nào, xong thì báo lại gì. Việc liên quan đến bộ phận khác có sẵn nội dung để gửi.

Kiểm tra quy định của Apple, Google, Mattermost ngày 10/11/2026. Các bên này có thể đổi giao diện và phí, nên lấy màn hình lúc đăng ký làm chuẩn. Nguồn ở cuối tài liệu.

## Quy tắc chung

1. **Không gửi mật khẩu, khoá API, token, số thẻ cho Claude trong chat.** Khi đến bước cần dùng, anh/chị tự dán vào file `.env` trên máy hoặc kho bí mật của máy chủ. Claude chỉ cần biết tên biến.
2. **Không gửi khoá bí mật qua Zalo, Mattermost hay email thường.** Dùng trình quản lý mật khẩu của công ty, hoặc đưa trực tiếp.
3. **Mọi tài khoản đứng tên công ty** phải dùng email công việc dùng chung, ví dụ `seedgw-admin@vinaseed.com.vn`, không dùng email cá nhân. Nhờ IT tạo hộp thư này trước. Nhân sự nghỉ việc sẽ không làm mất tài khoản.
4. **Dữ liệu thật** (nhân viên, khách hàng) chỉ nạp khi đã có máy chủ staging, không nạp vào máy phát triển này.

## Bảng tổng hợp

| #   | Việc                                   | Người làm chính             | Ưu tiên                 | Nếu chưa làm thì                         |
| --- | -------------------------------------- | --------------------------- | ----------------------- | ---------------------------------------- |
| 1   | Lưu mã nguồn lên kho riêng             | Anh/chị                     | Làm ngay                | Hỏng máy là mất toàn bộ mã nguồn         |
| 2   | Lấy số D-U-N-S                         | Pháp chế, Hành chính        | Làm ngay                | Không mở được tài khoản Apple và Google  |
| 3   | Tài khoản Apple Developer              | Người có thẩm quyền ký      | Sau việc 2              | Không thử và không phát hành được iOS    |
| 4   | Tài khoản Google Play và Expo          | Anh/chị, Hành chính         | Sau việc 2              | Không phát hành được Android             |
| 5   | Làm việc với FAST và Kế toán           | Anh/chị, Kế toán            | Làm ngay, quan trọng nhất | Tắc toàn bộ đơn hàng, sản phẩm, tồn kho  |
| 6   | Chuẩn bị máy chủ và domain             | IT Vinaseed                 | Trong 2 tuần            | Không có staging, không làm được Zalo    |
| 7   | Chốt các quyết định đang chờ           | Anh/chị, Lãnh đạo           | Trong 1 tuần            | Claude phải đoán hoặc làm lại            |
| 8   | Thiết bị thử app                       | Anh/chị                     | Trong 2 tuần            | Không làm được R3 và app                 |
| 9   | Tạo app Zalo và cấp quyền OA           | Khối Marketing và PTSP      | Sau khi có domain       | Không làm được Hộp thư CSKH              |
| 10  | Cấu hình Mattermost                    | Quản trị Mattermost, IT     | Trước giai đoạn CSKH    | Không có cảnh báo qua Mattermost         |
| 11  | Xác nhận logo                          | Khối Marketing và PTSP      | Trước khi làm app       | Chưa chốt được icon app                  |
| 12  | Quy định ca và chấm công               | Nhân sự                     | Trước A11               | Không làm được chấm công                 |
| 13  | Quy trình duyệt, giá, tham số bán hàng | Kinh doanh các vùng         | Trước A6, A10           | Không cấu hình được duyệt đơn            |
| 14  | Quy định CSKH                          | Trưởng nhóm CSKH            | Trước giai đoạn CSKH    | Không cấu hình được SLA và phiếu         |
| 15  | Lịch vụ và chỉ tiêu                    | Lãnh đạo Kinh doanh         | Trước K3                | Không có % hoàn thành chỉ tiêu           |
| 16  | Dữ liệu thật để chuyển đổi             | Nhân sự, Kế toán, Kinh doanh | Trước go-live           | Không go-live được                       |
| 17  | Người thử nghiệm, đào tạo, nghiệm thu  | Anh/chị, các bộ phận        | Giai đoạn cuối          | Không có biên bản nghiệm thu             |

**Dự trù chi phí đã biết**

| Khoản                      | Mức                                                                   |
| -------------------------- | --------------------------------------------------------------------- |
| Số D-U-N-S                 | Miễn phí. Từ chối dịch vụ tính phí                                    |
| Apple Developer Program    | 99 USD một năm, Apple hiển thị theo tiền địa phương lúc đăng ký       |
| Google Play Console        | Thường là 25 USD một lần. Xem số chính xác ở màn đăng ký              |
| Zalo OA gói Nâng cao       | 99.000 đ một tháng, đang dùng                                         |
| Kho mã nguồn riêng         | GitHub có gói miễn phí cho kho riêng. CI có thể phát sinh nếu chạy nhiều |
| API của FAST               | **Chưa biết**, phải hỏi FAST                                          |
| Máy chủ, domain, chứng chỉ | Theo IT. Có thể dùng hạ tầng sẵn có                                   |

---

## Việc 1. Lưu mã nguồn lên kho riêng

**Vì sao:** Repo chưa có remote. Toàn bộ mã nguồn chỉ nằm trên máy này. Task F6 (CI/CD) cũng cần kho này.

**Cần chuẩn bị**

- Hỏi IT: công ty có GitLab nội bộ không, có cho phép lưu mã nguồn trên GitHub không. Kho có chứa font bản quyền và tài liệu nội bộ, nên cần được phép.
- Email công việc dùng chung để tạo tài khoản.

**Các bước với GitHub**

1. Vào `https://github.com/signup`, tạo tài khoản bằng email công việc, bật xác thực hai lớp.
2. Nên tạo tổ chức: bấm dấu `+` góc trên bên phải, chọn **New organization**, chọn gói Free, đặt tên ví dụ `vinaseed-seedgw`.
3. Bấm dấu `+`, chọn **New repository**:
   - Owner: tổ chức vừa tạo.
   - Repository name: `seedgw`.
   - Chọn **Private**. Bắt buộc.
   - **Không** tích README, .gitignore, license.
4. Bấm **Create repository**, sao chép địa chỉ dạng `https://github.com/<ten-to-chuc>/seedgw.git`.
5. Mở Terminal tại thư mục dự án, chạy lần lượt (thay địa chỉ thật):

```bash
git remote add origin https://github.com/<ten-to-chuc>/seedgw.git
```

```bash
git push -u origin main
```

6. Lần đầu sẽ hiện cửa sổ đăng nhập GitHub, anh/chị tự đăng nhập.
7. Tải lại trang GitHub và kiểm tra: có các thư mục `apps`, `packages`, `docs`. **Không được có file `.env`.** Nếu thấy `.env`, báo ngay và đổi toàn bộ mật khẩu trong đó.

**Nếu cần sao lưu tạm trong lúc chờ IT trả lời** (thay `D:\sao-luu` bằng ổ ngoài):

```bash
git bundle create "D:\sao-luu\seedgw.bundle" --all
```

**Xong thì báo Claude:** "Đã có remote". Từ đó Claude có thể đẩy mã lên khi anh/chị đồng ý.

---

## Việc 2. Lấy số D-U-N-S

**Vì sao:** Apple và Google đều bắt buộc số này với tài khoản tổ chức. Google cảnh báo có thể mất đến 30 ngày.

**Người làm:** Pháp chế hoặc Hành chính.

**Cần chuẩn bị**

- Giấy chứng nhận đăng ký doanh nghiệp.
- Tên pháp nhân **tiếng Anh** đúng như trên giấy tờ. Không dùng tên thương hiệu, tên chi nhánh.
- Địa chỉ trụ sở, địa chỉ nhận thư, số điện thoại công ty.
- Người liên hệ: họ tên, chức danh, email công việc, số điện thoại.
- Số lượng nhân viên, loại hình kinh doanh (D&B có thể gọi hỏi).

**Các bước**

1. Vào công cụ tra cứu của Apple: `https://developer.apple.com/enroll/duns-lookup/`. Công ty lớn có thể đã có sẵn số.
2. Nhập tên pháp nhân, địa chỉ, thông tin liên hệ, bấm tìm.
3. Nếu **đã có số**: ghi lại, đối chiếu tên và địa chỉ. Sai thì gửi yêu cầu sửa cho D&B kèm giấy đăng ký doanh nghiệp.
4. Nếu **chưa có**: chọn gửi thông tin cho D&B để cấp miễn phí.
5. Chờ. Apple ghi tối đa 5 ngày làm việc để D&B cấp số. Quá 2 tuần thì gửi email cho D&B qua `https://support.dnb.com/?CUST=APPLEDEV`.
6. Có số rồi, chờ thêm tối đa 2 ngày làm việc để dữ liệu sang Apple.

**Lưu ý quan trọng**

- Tên và địa chỉ trên D&B phải **khớp** với hồ sơ thanh toán Google ở việc 4.
- Thông báo "not listed as a legal entity" nghĩa là D&B chưa xác nhận pháp nhân. Gửi email cho D&B kèm giấy tờ.

**Kết quả:** Số D-U-N-S gồm 9 chữ số, lưu trong hồ sơ công ty.

---

## Việc 3. Tài khoản Apple Developer

**Vì sao:** Dự án bắt buộc có iOS. Không có tài khoản này thì không cài được bản thử lên iPhone và không phát hành được.

**Người làm:** Người có thẩm quyền ký thay công ty (chủ sở hữu, ban điều hành), hoặc nhân viên được người có thẩm quyền uỷ quyền. Nên chuẩn bị giấy uỷ quyền.

**Cần chuẩn bị**

- Số D-U-N-S ở việc 2.
- Tài khoản Apple dùng email `@vinaseed.com.vn`, **họ tên thật** theo giấy tờ, bật xác thực hai lớp. Nên dùng một iPhone công ty để nhận mã xác thực.
- Website công ty hoạt động công khai, cùng tên miền với email.
- Số điện thoại công việc.
- Thẻ có thanh toán quốc tế để trả 99 USD mỗi năm.

**Các bước**

1. Vào `https://developer.apple.com/programs/enroll/`, chọn **Start Your Enrollment**, đăng nhập.
2. Chọn loại **Company / Organization**. Không chọn Individual.
3. Nhập tên pháp nhân, D-U-N-S, website, thông tin người đăng ký.
4. Xác nhận có thẩm quyền ràng buộc pháp lý cho công ty.
5. Apple có thể gọi hoặc gửi email để xác minh. Luôn để ý điện thoại và hộp thư.
6. Sau khi được duyệt, thanh toán và đọc, chấp nhận thoả thuận.
7. Bật gia hạn tự động. Hết hạn thì app có thể bị gỡ khỏi App Store.

**Sau này, khi làm M9** (chưa cần làm ngay)

- Vào App Store Connect, tạo **App Store Connect API Key** để hệ thống build dùng. Anh/chị tự nhập khoá vào Expo.
- Chuẩn bị trang **chính sách quyền riêng tư** công khai, do Pháp chế duyệt.
- Chuẩn bị **tài khoản demo** cho Apple kiểm duyệt và mô tả lý do dùng vị trí, camera.
- Hình thức đề xuất: **Unlisted App**. App vẫn phải qua kiểm duyệt, không xuất hiện khi tìm kiếm, chỉ ai có link mới cài được. Ghi rõ mục đích vào Review Notes và gửi form yêu cầu của Apple. App đã có đăng nhập nên người ngoài có link cũng không dùng được.

**Xong thì báo Claude:** "Apple đã duyệt", kèm Team ID (không phải thông tin bí mật).

---

## Việc 4. Tài khoản Google Play và Expo

### 4.1. Google Play Console

**Cần chuẩn bị**

- Số D-U-N-S.
- Tài khoản Google dùng email công việc dùng chung.
- Hồ sơ thanh toán Google loại **doanh nghiệp**, tên và địa chỉ **khớp D&B**.
- Website công ty, số điện thoại công ty.
- Email và số điện thoại liên hệ. Các số này phải còn dùng được suốt đời tài khoản vì Google có thể gửi mã xác minh.
- Thẻ thanh toán quốc tế.

**Các bước**

1. Vào `https://play.google.com/console/signup`.
2. Chọn tài khoản cho **tổ chức** (Organization).
3. Nhập D-U-N-S, tạo hoặc liên kết hồ sơ thanh toán.
4. Đặt tên nhà phát triển, ví dụ tên công ty.
5. Xác minh email, điện thoại bằng mã một lần.
6. Trả phí đăng ký và chờ xác minh tổ chức.

**Cách phát hành đề xuất cho 300 đến 400 nhân viên:** dùng **Closed testing**.

- Danh sách email chứa tối đa 2.000 người, hoặc dùng Google Group không giới hạn.
- Nhân viên cần có tài khoản Google, bấm link tham gia rồi cài từ Play Store.
- Vì vậy **cần thu thập email Google của nhân viên** dùng Android trước đợt thí điểm.
- Không nên lấy file APK làm cách chính: Google đang mở rộng xác minh nhà phát triển ra toàn cầu từ năm 2027, kể cả app cài ngoài Play.

### 4.2. Tài khoản Expo

**Vì sao:** Dùng để build app Android và iOS.

1. Vào `https://expo.dev/signup`, tạo tài khoản bằng email công việc dùng chung, bật xác thực hai lớp.
2. Tạo Organization tên `vinaseed`.
3. Khi đến R3, Claude sẽ báo lệnh cần chạy. Anh/chị tự đăng nhập ở Terminal.

**Xong thì báo Claude:** "Đã có Google Play và Expo", kèm tên organization Expo.

---

## Việc 5. Làm việc với FAST và Kế toán

**Vì sao:** Đây là điểm chặn lớn nhất. Sản phẩm, kho, tồn kho, công nợ, đơn hàng, số liệu Thực bán đều phụ thuộc FAST. Task R1, A4, A5, A7, S5, S10, S11, K2.

**Người tham gia:** Anh/chị, Kế toán trưởng hoặc người được giao, đầu mối kỹ thuật FAST.

### Bước 1. Gửi yêu cầu cho FAST

Điền chỗ trống rồi gửi:

> Kính gửi FAST,
>
> Công ty [tên pháp nhân] đang dùng FAST Business Online và đang xây dựng phần mềm nội bộ SeedGW. Chúng tôi cần kết nối SeedGW với FBO hai chiều, đề nghị FAST cho biết và cung cấp:
>
> **A. Khả năng tích hợp**
>
> 1. FBO có API không? Có tài liệu API không? Xin gửi tài liệu.
> 2. Có API nhận đơn bán hoặc chứng từ từ hệ thống ngoài không?
> 3. Có API tạo khách hàng **với mã do hệ thống ngoài truyền vào** không? Có cho phép cấu hình dải mã không?
> 4. Có API đọc danh mục vật tư, đơn vị tính và quy đổi, kho, tồn kho theo kho không?
> 5. Có API đọc công nợ hiện tại và hạn mức theo khách hàng không?
> 6. Có API đọc **hoá đơn bán và hàng trả lại** theo ngày không?
> 7. FBO có gọi được webhook hoặc API của hệ thống ngoài không (ví dụ báo đơn đã giao)?
>
> **B. Kỹ thuật**
>
> 8. Cách xác thực (API key, OAuth, ký HMAC), thời hạn token.
> 9. Giới hạn số lần gọi, kích thước dữ liệu, phân trang.
> 10. Có môi trường test tách khỏi dữ liệu thật không? Xin cấp tài khoản test.
> 11. FBO có gửi từ địa chỉ IP cố định không? (để giới hạn truy cập)
> 12. Danh sách trường bắt buộc của chứng từ bán hàng (mã khách, mã vật tư, mã kho, đơn vị tính, đơn giá, chiết khấu, VAT, ngày chứng từ, mã nhân viên bán). Xin mẫu dữ liệu.
> 13. Mã lỗi và cách xử lý khi gửi trùng chứng từ.
>
> **C. Thương mại**
>
> 14. Chi phí mở API (một lần, hằng năm), thời gian triển khai.
> 15. Đầu mối kỹ thuật: họ tên, email, điện thoại.
>
> Xin đề nghị một buổi họp trực tuyến khoảng 60 phút trong tuần này.

### Bước 2. Làm việc với Kế toán

Hỏi và chốt, ghi vào biên bản:

1. Định dạng mã khách hàng hiện tại trên FAST (tiền tố, độ dài, ví dụ).
2. Số tự tăng của FAST có đang bật không.
3. **Dải mã riêng cho khách tạo từ SeedGW.** Đề xuất `DL` + 5 chữ số, không gắn mã vùng vì đại lý có thể đổi vùng. Kế toán cam kết không dùng dải này khi tạo tay.
4. Trường nào FAST làm gốc: tên pháp lý, mã số thuế, địa chỉ xuất hoá đơn, công nợ, hạn mức.
5. Khách mới có bắt buộc Sales Admin duyệt trước khi sang FAST không (khuyến nghị: bật).
6. Tồn kho cảnh báo theo kho của chi nhánh phụ trách vùng hay tổng các kho.

### Bước 3. Xuất dữ liệu mẫu

Nhờ Kế toán xuất Excel danh sách khách hàng, có **cả mã hệ thống cũ và mã FAST**, kèm tên, mã số thuế, số điện thoại. Mục đích: đánh giá trùng lặp và thiếu ánh xạ. File có dữ liệu khách hàng nên lưu ở thư mục nội bộ có giới hạn người xem.

### Bước 4. Ký biên bản

Biên bản do FAST và Kế toán xác nhận, gồm: khả năng API từng luồng, chế độ từng luồng (SeedGW gọi FBO hay FBO gọi SeedGW), dải mã, trường bắt buộc, chi phí, đầu mối.

**Trường hợp FAST trả lời không có API**

| Thiếu gì                  | Phương án dự phòng                                      |
| ------------------------- | ------------------------------------------------------- |
| Tạo khách với mã truyền vào | Dùng cách B: đơn của khách mới chờ đến khi có mã FAST |
| Đọc hoá đơn, hàng trả lại | Nhập file Excel xuất từ FAST                            |
| Toàn bộ API               | Dừng lại và họp để quyết định lại phạm vi dự án         |

**Xong thì gửi Claude:** tài liệu API, biên bản, dữ liệu mẫu đã che thông tin nhạy cảm. Tài khoản test thì anh/chị tự nhập vào `.env`.

---

## Việc 6. Chuẩn bị máy chủ và domain

**Người làm:** IT Vinaseed. Gửi nguyên nội dung sau:

> Dự án SeedGW cần hạ tầng như sau. Đề nghị IT xác nhận khả năng và thời gian.
>
> **1. Máy chủ** (2 môi trường, staging có thể nhỏ hơn)
>
> - Production: 8 vCPU, 16 đến 32 GB RAM, SSD 1 TB, dành cho 300 đến 400 người dùng.
> - Volume lưu ảnh check-in tách riêng khỏi database. Dự kiến 90 đến 180 GB mỗi năm.
> - Hệ điều hành đề xuất Ubuntu Server LTS, có Docker và Docker Compose.
>
> **2. Domain và HTTPS**
>
> - Production, đề xuất: `seedgw.vinaseed.com.vn`.
> - Staging, đề xuất: `seedgw-staging.vinaseed.com.vn`.
> - Bản ghi DNS công khai và chứng chỉ TLS tự gia hạn.
>
> **3. Mạng**
>
> - Nginx reverse proxy đặt ở DMZ, chỉ mở cổng 443 (80 chuyển hướng về 443).
> - Chỉ cho phép từ Internet: trang web, `/api/mobile/*`, `/api/v1/*`, `/api/webhooks/zalo`.
> - PostgreSQL, Redis, MinIO, Mattermost chỉ nằm trong mạng nội bộ.
> - Nginx: `client_max_body_size` tối thiểu 20 MB, `proxy_read_timeout` tối thiểu 120 giây.
> - Cho phép máy chủ đi ra: FAST Business Online, Zalo API, Apple và Google push, Expo, GitHub hoặc Git nội bộ, Sentry.
>
> **4. Bảo mật**
>
> - Giới hạn tần suất truy cập và fail2ban chống dò mật khẩu.
> - Đăng nhập máy chủ bằng SSH key, tắt đăng nhập mật khẩu.
>
> **5. Sao lưu và giám sát**
>
> - PostgreSQL sao lưu hằng đêm và WAL. MinIO đồng bộ sang ổ hoặc máy khác.
> - Giám sát dung lượng đĩa, cảnh báo khi quá 80%.
> - Diễn tập khôi phục 1 lần trước go-live, mục tiêu dưới 1 giờ trên máy trắng.
>
> **6. Triển khai tự động**
>
> Máy chủ nằm trong mạng nội bộ nên CI bên ngoài có thể không vào được. Đề nghị IT chọn: (a) cài runner tự host trong mạng, hoặc (b) mở VPN cho CI.
>
> **7. Dịch vụ phụ trợ**
>
> - SMTP nội bộ để hệ thống gửi email, cho biết địa chỉ và tài khoản gửi.
> - Hộp thư dùng chung `seedgw-admin@vinaseed.com.vn`.
> - Đầu mối IT trực khi triển khai: họ tên, điện thoại.
>
> **Tiêu chí hoàn thành:** từ mạng 4G mở được `https://<domain>/api/health`.

**Lưu ý:** Trước khi có ứng dụng chạy, đường dẫn `/api/health` chưa có. IT chỉ cần xác nhận domain và HTTPS phản hồi. Claude sẽ hoàn thiện ở F6.

**Xong thì báo Claude:** domain, cách triển khai đã chọn, đầu mối IT. Khoá SSH và mật khẩu do IT tự đưa vào kho bí mật.

---

## Việc 7. Chốt các quyết định đang chờ

Mỗi mục đã có đề xuất. Chỉ cần trả lời "đồng ý" hoặc nêu thay đổi.

### 7.1. Tám vai trò

| Vai trò             | Phạm vi dữ liệu      | Làm được gì                                                  |
| ------------------- | -------------------- | ------------------------------------------------------------ |
| Quản trị hệ thống   | Toàn công ty         | Tất cả, gồm Đăng nhập thay                                   |
| Quản trị            | Toàn công ty         | Toàn bộ phần Quản trị, trừ Đăng nhập thay                    |
| Nhân viên kinh doanh | Của mình            | Đơn hàng, đại lý, khách hàng, tuyến, check-in, chấm công của mình |
| Quản lý vùng        | Đơn vị và cấp dưới   | Toàn bộ Kinh doanh gồm duyệt đơn, trừ Đồng bộ FAST           |
| Sales Admin         | Toàn công ty         | Toàn bộ Kinh doanh, **không** duyệt đơn                      |
| Nhân viên CSKH      | Đơn vị của mình      | Hộp thư, phiếu, khách hàng, mẫu trả lời                      |
| Trưởng nhóm CSKH    | Đơn vị và cấp dưới   | Toàn bộ CSKH gồm phân công và dashboard                      |
| Lãnh đạo            | Toàn công ty         | Tổng quan điều hành, dashboard Kinh doanh, dashboard CSKH    |

Cần trả lời:

1. Tám vai trò này có đủ không? Có thiếu Giám đốc miền, Kế toán, Nhân sự không?
2. Sales Admin có được xem toàn công ty không, hay chỉ theo vùng?
3. Lãnh đạo chỉ xem dashboard, hay được xem cả chi tiết đơn hàng?
4. Vai trò Quản trị đang gán được mọi vai trò nghiệp vụ, kể cả Lãnh đạo, chỉ không gán được Quản trị hệ thống. Có đồng ý không?

### 7.2. Cách đánh mã khách hàng

Đề xuất **cách C**: một mã duy nhất, SeedGW cấp theo dải riêng rồi đẩy sang FAST làm mã FAST. Chi tiết ở `DESIGN_BRIEF.md` mục 10. Phụ thuộc câu trả lời của FAST ở việc 5.

### 7.3. Quên mật khẩu và trang Tài khoản của tôi

Hai trang này có trong thiết kế nhưng chưa có task.

| Phương án                                     | Điều kiện                  | Nhận xét                                        |
| --------------------------------------------- | -------------------------- | ----------------------------------------------- |
| A. Chỉ quản trị đặt lại (đang có)             | Không                      | Đơn giản, nhưng dồn việc cho quản trị           |
| B. Tự đặt lại qua email                       | Nhân viên có email, có SMTP | Đề xuất nếu đa số nhân viên có email công ty   |
| C. Tự đặt lại qua SMS                         | Dịch vụ SMS, có chi phí    | Hợp với nhân viên thị trường, tốn thêm chi phí  |

Cần trả lời: chọn phương án nào, có làm trang Tài khoản của tôi không (đề xuất: có, gồm đổi mật khẩu).

### 7.4. Quy định bảo mật đã áp dụng

| Quy định                  | Đang đặt                                       |
| ------------------------- | ---------------------------------------------- |
| Khoá khi nhập sai         | Khoá 5 phút sau 10 lần sai trong 15 phút       |
| Mật khẩu                  | Ít nhất 8 ký tự, có chữ và số, không chứa mã NV |
| Đăng nhập thay            | Tối đa 30 phút, chỉ Quản trị hệ thống          |
| Nhập Excel                | Mỗi lần tối đa 1.000 dòng, còn lỗi thì không ghi |
| Phiên đăng nhập web       | 12 giờ                                         |

### 7.5. Ảnh check-in và dữ liệu cá nhân

1. Ảnh lưu bao lâu? Đề xuất 24 tháng, sau đó xoá ảnh và giữ lại bản ghi. Ước tính 90 đến 180 GB mỗi năm.
2. **Đề nghị Pháp chế xem xét:** app thu vị trí và ảnh chân dung nhân viên, nên cần căn cứ pháp lý, thông báo và đồng ý của nhân viên theo quy định bảo vệ dữ liệu cá nhân hiện hành. Đây cũng là nội dung trang chính sách quyền riêng tư mà Apple yêu cầu.

---

## Việc 8. Thiết bị thử app

**Cần có**

- 1 điện thoại Android, nên là máy tầm trung nhân viên hay dùng.
- 1 iPhone. Cài bản thử lên iPhone cần tài khoản Apple ở việc 3 đã duyệt. Android có thể làm trước.
- SIM có 4G để thử mất mạng và có mạng.
- Một người thử ngoài trời và trong nhà, tại một đại lý thật nếu được.

**Xong thì báo Claude:** "Đã có máy thử". Claude sẽ hướng dẫn cài từng bước.

---

## Việc 9. Tạo app Zalo và cấp quyền OA

**Người làm:** Admin OA thuộc Khối Marketing và PTSP.

**Điều kiện trước:** Đã có domain HTTPS ở việc 6.

**Lưu ý về nguồn:** Trang tài liệu chính thức của Zalo không đọc tự động được. Các bước dưới đây tổng hợp từ tài liệu tích hợp của bên thứ ba, cần đối chiếu tại `https://developers.zalo.me`.

**Các bước**

1. Admin đăng nhập `https://developers.zalo.me` bằng Zalo của admin OA.
2. Tạo ứng dụng mới, ví dụ `SeedGW`.
3. Liên kết OA Vinaseed với ứng dụng. **Kiểm tra trước:** một OA đang gắn với ứng dụng khác phải gỡ ra rồi mới gắn được ứng dụng mới. Nếu OA đang nối với chatbot hoặc phần mềm cũ, báo Claude trước khi gỡ.
4. Khai báo webhook: `https://<domain-staging>/api/webhooks/zalo`. Có thể cần xác thực tên miền.
5. Bật các sự kiện nhận tin nhắn của người dùng.
6. Xin các quyền API cho OA (gửi tin, đọc thông tin người quan tâm).
7. Cấp quyền cho ứng dụng truy cập OA.
8. Bàn giao **App ID** và **Secret Key** qua kênh bảo mật cho người giữ file `.env`.

**Cần hỏi Zalo hoặc xem chính sách gói Nâng cao**

1. Khung tương tác miễn phí kéo dài bao lâu?
2. 2.000 tin tư vấn ngoài khung tính theo tháng hay cả gói?
3. Giới hạn 5 tổng đài viên có áp dụng cho tin gửi qua API không?
4. API có trả về số hạn mức còn lại không?

**Cần thống nhất với Marketing:** tin truyền thông (4 tin mỗi khách mỗi tháng) vẫn do Marketing gửi trên OA Manager. SeedGW chỉ dùng tin tư vấn.

---

## Việc 10. Cấu hình Mattermost

**Người làm:** Quản trị viên Mattermost.

**Các bước**

1. Cho biết phiên bản và địa chỉ nội bộ của Mattermost.
2. Vào **System Console > Integrations > Bot Accounts**, đặt **Enable Bot Account Creation** thành true.
3. Vào **Product menu > Integrations > Bot Accounts**, chọn **Add Bot Account**, username `seedgw-bot`, vai trò Member.
4. Sao chép token ngay ở trang **Setup Successful**, đóng trang là không xem lại được. Lưu vào kho bí mật.
5. Mời bot vào team và các kênh nhận thông báo.
6. Bật webhook và slash command trong phần quản lý tích hợp của System Console.
7. Tạo thêm một **người dùng thường** tên `seedgw-integration`. Tài liệu Mattermost ghi slash command và outgoing webhook cần tài khoản người dùng, không dùng được bot.
8. Cho máy chủ SeedGW gọi được Mattermost và ngược lại trong mạng nội bộ.

**Cần chốt:** tên các kênh nhận thông báo (phiếu mức cao, phiếu quá hạn, lỗi đồng bộ FAST).

---

## Việc 11. Xác nhận logo

Gửi Khối Marketing và PTSP:

> Phần mềm SeedGW cần hai xác nhận về Brand Guideline:
>
> 1. Có được dùng biểu tượng đứng riêng (không kèm chữ) làm icon app điện thoại và favicon không? Trang 15 có dùng, nhưng trang 11 đến 13 không quy định.
> 2. Logo trên nền nâu: trang 11 hạt màu xanh, trang 15 toàn trắng. Bản nào đúng? (Hiện phần mềm chưa dùng nền nâu.)

---

## Việc 12. Quy định ca và chấm công

Gửi Nhân sự:

> Để xây dựng chấm công thay máy chấm công cho cán bộ kinh doanh, đề nghị cung cấp:
>
> 1. Danh sách ca: giờ vào, giờ ra, nghỉ trưa, số công mỗi ca.
> 2. Ngưỡng tính đi muộn, về sớm, có cho phép đi muộn trong bao nhiêu phút không.
> 3. Ngày làm việc trong tuần, có làm thứ Bảy không, gán theo đơn vị hay từng người.
> 4. Lịch nghỉ lễ năm 2027.
> 5. Công tác ngoài tuyến, quên check-in, nghỉ phép, làm thêm tính thế nào, ai duyệt.
> 6. Ký hiệu trên bảng công (X, P, L, CT...).
> 7. Ngày chốt công hằng tháng, ai xác nhận.
> 8. Mẫu bảng công đang dùng (file Excel).
> 9. Áp dụng cho những đối tượng nào.

---

## Việc 13. Quy trình duyệt, giá và tham số bán hàng

Gửi Kinh doanh các vùng và Sales Admin. Mỗi đơn vị điền một bảng:

| Bước | Tên bước | Người duyệt (chức danh hoặc tên) | Khi nào cần (mọi đơn, vượt công nợ, thiếu tồn, trên giá trị X) | Hạn duyệt (giờ) | Quá hạn thì chuyển cho ai |
| ---- | -------- | -------------------------------- | --------------------------------------------------------------- | --------------- | ------------------------- |
| 1    |          |                                  |                                                                 |                 |                           |
| 2    |          |                                  |                                                                 |                 |                           |

Cần thêm:

1. Bảng giá hiện hành theo vùng, kênh, thời gian (Excel).
2. Chính sách chiết khấu: theo %, số tiền, sản phẩm, đại lý, bậc số lượng.
3. Mỗi vùng được phục vụ từ kho nào.
4. Bán kính check-in hợp lệ (đề xuất 100 đến 200 m).
5. Ngưỡng cảnh báo công nợ (%).
6. Số ngày không đặt hàng thì coi là "đại lý không đặt hàng".
7. Danh sách tuyến và đại lý theo nhân viên phụ trách.

---

## Việc 14. Quy định CSKH

Gửi Trưởng nhóm CSKH:

1. Các loại phiếu và mức ưu tiên.
2. Thời gian phản hồi đầu và giải quyết cho từng mức ưu tiên (SLA).
3. Phân công thủ công hay tự động, theo ca, nhóm hay vùng.
4. Khi phiếu cần bộ phận khác, chuyển cho ai.
5. Mẫu câu trả lời thường dùng.
6. Giờ làm việc của nhóm CSKH.

---

## Việc 15. Lịch vụ và chỉ tiêu

Gửi Lãnh đạo Kinh doanh:

1. Danh sách vụ trong năm và thời gian từng vụ.
2. Giao chỉ tiêu theo tháng hay theo vụ, đến cấp nào (miền, vùng, nhân viên).
3. Chỉ tiêu theo sản lượng, doanh thu, hay cả hai, theo nhóm sản phẩm nào.
4. Ai được giao và sửa chỉ tiêu.
5. Mẫu chỉ tiêu đang dùng.
6. Cần so cùng kỳ bao nhiêu năm. Kế toán chuẩn bị số liệu bán các năm đó.

---

## Việc 16. Dữ liệu thật để chuyển đổi

Chuẩn bị dần, **chỉ nạp khi đã có staging**.

| Dữ liệu             | Người cung cấp | Định dạng                                                                                     |
| ------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| Cơ cấu tổ chức      | Nhân sự        | Excel: mã đơn vị, tên, mã đơn vị cha, mã NV trưởng đơn vị. Tối đa 4 cấp                        |
| Danh sách nhân viên | Nhân sự        | File mẫu tải tại trang Tài khoản > Nhập từ Excel: mã NV, họ tên, SĐT, email, mã đơn vị, chức danh, ngày vào làm, mã quản lý, mã vai trò |
| Khách hàng, đại lý  | Kế toán, Kinh doanh | Mã FAST, mã hệ thống cũ, toạ độ, nhân viên phụ trách                                          |
| Số liệu bán lịch sử | Kế toán        | Theo tháng, sản phẩm, đại lý                                                                  |

**Thứ tự bắt buộc:** tạo cây đơn vị trước, rồi mới nhập nhân viên, vì file nhân viên tham chiếu mã đơn vị.

**Khi nhập nhân viên:** hệ thống sinh mật khẩu tạm và chỉ cho tải một lần. Cần tải ngay, phát cho từng người, rồi xoá file. Nhân viên sẽ bị yêu cầu đổi mật khẩu ở lần đầu.

---

## Việc 17. Người thử nghiệm, đào tạo, nghiệm thu

1. Chọn **10 nhân viên thí điểm**, trong đó ít nhất 3 người dùng iPhone.
2. Mỗi bộ phận cử 1 người viết và chạy kịch bản nghiệm thu.
3. Chọn đầu mối hỗ trợ người dùng sau go-live.
4. Thống nhất kế hoạch triển khai theo đợt.
5. Người có thẩm quyền ký biên bản nghiệm thu.

---

## Thứ tự đề xuất

| Thời điểm | Việc                                                                 |
| --------- | -------------------------------------------------------------------- |
| Hôm nay   | Việc 1. Gửi yêu cầu việc 2, việc 5, việc 6                           |
| Tuần 1    | Việc 7. Hỏi Marketing việc 11                                        |
| Tuần 2 đến 4 | Việc 3, việc 4, việc 8. Họp FAST và ký biên bản                   |
| Khi có domain | Việc 9                                                           |
| Trong lúc Claude làm phần Quản trị | Việc 12, việc 13                        |
| Trước giai đoạn CSKH và Dashboard | Việc 10, việc 14, việc 15                |
| Trước go-live | Việc 16, việc 17                                                 |

**Claude làm được ngay, không phải chờ ai:** A3, A9, A10, A11.

## Nguồn tham khảo

- [Apple: đăng ký Developer Program](https://developer.apple.com/programs/enroll/)
- [Apple: D-U-N-S](https://developer.apple.com/help/account/membership/D-U-N-S/)
- [Apple: phát hành Unlisted App](https://developer.apple.com/support/unlisted-app-distribution/)
- [Google: thông tin tạo tài khoản Play Console](https://support.google.com/googleplay/android-developer/answer/13628312)
- [Google: kiểm thử nội bộ và kín](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Android: xác minh nhà phát triển](https://developer.android.com/developer-verification)
- [Google: thông báo D-U-N-S cho tài khoản tổ chức](https://android-developers.googleblog.com/2023/07/boosting-trust-and-transparency-in-google-play.html)
- [Mattermost: bot accounts](https://docs.mattermost.com/developers/integrate/reference/bot-accounts)
- [Zalo for Developers](https://developers.zalo.me)
