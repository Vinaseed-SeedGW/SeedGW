import { z } from 'zod';

// Lời đồng ý chia sẻ vị trí, người dùng duyệt câu chữ ngày 17/11/2026; bản 19/11 chỉ đổi tên app thành
// SeedGW (quyết định 34), nội dung thu thập giữ nguyên. Web và app dùng chung một nội dung.
// Đổi câu chữ thì tăng phiên bản, mọi người sẽ được hỏi lại ở lần dùng tiếp theo.
export const LOCATION_CONSENT_VERSION = '2026-11-19';
export const LOCATION_CONSENT_KIND = 'LOCATION';

export const LOCATION_CONSENT = {
  title: 'Đồng ý chia sẻ vị trí khi làm việc',
  intro:
    'Để phục vụ hoạt động sản xuất kinh doanh, Công ty Cổ phần Tập đoàn Giống cây trồng Việt Nam (Vinaseed) cần thu thập dữ liệu vị trí của bạn khi bạn dùng SeedGW trong công việc.',
  sections: [
    {
      heading: 'Dữ liệu được thu thập',
      items: [
        'Vị trí và thời điểm khi bạn check-in tại đại lý, khách hàng hoặc điểm làm việc.',
        'Hành trình di chuyển, tính từ lượt check-in đầu tiên trong ngày tới khi bạn bấm Kết thúc ngày, hoặc muộn nhất tới 20:00.',
        'Ảnh check-in có in giờ, toạ độ và địa chỉ.',
        'Ngoài khoảng thời gian trên, app không ghi vị trí. Trang web SeedGW không lấy vị trí của bạn.',
      ],
    },
    {
      heading: 'Mục đích sử dụng',
      items: [
        'Ghi nhận các lượt ghé thăm đại lý, khách hàng.',
        'Tính quãng đường đi thị trường, làm căn cứ để đơn vị tính công.',
        'Quản lý, điều phối thị trường và lập báo cáo kinh doanh của Tập đoàn.',
      ],
    },
    {
      heading: 'Ai được xem',
      items: [
        'Bạn, Quản trị đơn vị phụ trách bạn và Quản trị hệ thống của Tập đoàn.',
        'Toạ độ được gửi tới nhà cung cấp bản đồ Vietmap chỉ để tra ra địa chỉ.',
        'Dữ liệu không được chia sẻ cho bên ngoài, trừ khi pháp luật yêu cầu.',
      ],
    },
    {
      heading: 'Thời gian lưu',
      items: [
        'Hành trình và ảnh check-in: 45 ngày.',
        'Lượt check-in và số km đã tính: 18 tháng.',
        'Hết thời hạn, dữ liệu tự xoá.',
      ],
    },
    {
      heading: 'Quyền của bạn',
      items: [
        'Xem dữ liệu của mình trên app.',
        'Đề nghị sửa, hỏi đáp qua mục Hỗ trợ hoặc liên hệ Phòng ĐMST&CĐS.',
        'Rút lại đồng ý bất cứ lúc nào ở tab Tôi. Khi đó app dừng ghi vị trí và bạn không check-in trên app được nữa; hãy liên hệ quản lý để được ghi nhận theo cách khác.',
      ],
    },
  ],
  acceptLabel: 'Tôi đồng ý',
  declineLabel: 'Không đồng ý',
} as const;

export const consentChannel = z.enum(['WEB', 'APP']);
export type ConsentChannel = z.infer<typeof consentChannel>;

export const mobileConsentStatus = z.object({
  version: z.string(),
  accepted: z.boolean(),
  acceptedAt: z.iso.datetime().nullable(),
});
export type MobileConsentStatus = z.infer<typeof mobileConsentStatus>;

export const mobileConsentInput = z.object({
  version: z.string().trim().min(1).max(20),
  action: z.enum(['ACCEPT', 'WITHDRAW']),
});
export type MobileConsentInput = z.infer<typeof mobileConsentInput>;

// Trang web hỏi đồng ý sau khi đăng nhập; bấm Không đồng ý thì không hỏi lại trong phiên này.
export const LOCATION_CONSENT_PATH = '/dong-y-vi-tri';
export const CONSENT_LATER_COOKIE = 'dms-dong-y-vi-tri-sau';
