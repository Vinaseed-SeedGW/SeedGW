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
export const CONSENT_LATER_COOKIE = 'seedgw-dong-y-vi-tri-sau';

// ---------- Sổ đồng ý, bằng chứng đồng ý (25/11/2026) ----------

type ConsentContent = {
  title: string;
  intro: string;
  sections: ReadonlyArray<{ heading: string; items: readonly string[] }>;
};

/** Nội dung theo từng phiên bản. Đổi câu chữ thì thêm phiên bản mới, không sửa bản cũ. */
const LOCATION_CONSENT_BY_VERSION: Record<string, ConsentContent> = {
  [LOCATION_CONSENT_VERSION]: LOCATION_CONSENT,
};

export const CONSENT_KIND_LABEL: Record<string, string> = {
  [LOCATION_CONSENT_KIND]: 'Chia sẻ vị trí khi làm việc',
};

/**
 * Toàn văn người dùng đã đọc, dạng chữ thuần, lưu vào sổ đồng ý và in trên giấy xác nhận. Trả null khi
 * không biết phiên bản.
 */
export function renderConsentText(kind: string, version: string): string | null {
  const content = kind === LOCATION_CONSENT_KIND ? LOCATION_CONSENT_BY_VERSION[version] : undefined;
  if (!content) return null;
  const lines = [`${content.title} (phiên bản ${version})`, '', content.intro];
  for (const section of content.sections) {
    lines.push('', section.heading);
    for (const item of section.items) lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

export const consentAction = z.enum(['ACCEPT', 'WITHDRAW']);
export type ConsentAction = z.infer<typeof consentAction>;

export const CONSENT_ACTION_LABEL: Record<ConsentAction, string> = {
  ACCEPT: 'Đồng ý',
  WITHDRAW: 'Rút lại đồng ý',
};

export const CONSENT_CHANNEL_LABEL: Record<ConsentChannel, string> = {
  WEB: 'Trang web SeedGW',
  APP: 'App SeedGW trên điện thoại',
};

/** Một dòng trong sổ đồng ý, đủ để in giấy xác nhận và kiểm chứng. */
export type ConsentRecordView = {
  id: string;
  seq: string;
  employeeCode: string;
  fullName: string;
  kind: string;
  version: string;
  action: ConsentAction;
  channel: ConsentChannel;
  ip: string | null;
  userAgent: string | null;
  deviceName: string | null;
  devicePlatform: string | null;
  contentText: string;
  contentHash: string;
  prevHash: string;
  recordHash: string;
  recordedAt: string;
  migrated: boolean;
};

/** Kết quả kiểm chứng: tính lại mã từ dữ liệu đã lưu và đối chiếu với dòng trước, dòng sau. */
export type ConsentVerification = {
  record: ConsentRecordView;
  contentMatches: boolean;
  recordMatches: boolean;
  chainMatches: boolean;
};

/** Mã kiểm chứng ngắn in trên giấy: 16 ký tự đầu của mã SHA-256, tách nhóm 4 cho dễ đọc. */
export function shortConsentCode(recordHash: string): string {
  return (
    recordHash
      .slice(0, 16)
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') ?? recordHash
  );
}

export function normalizeConsentCode(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
}

// ---------- Quản trị: tình trạng đồng ý của từng người ----------

export const consentStatus = z.enum(['ACCEPTED', 'WITHDRAWN', 'NONE']);
export type ConsentStatus = z.infer<typeof consentStatus>;

export const CONSENT_STATUS_LABEL: Record<ConsentStatus, string> = {
  ACCEPTED: 'Đã đồng ý',
  WITHDRAWN: 'Đã rút lại',
  NONE: 'Chưa trả lời',
};

export const CONSENT_STATUS_PARAM = {
  'da-dong-y': 'ACCEPTED',
  'da-rut': 'WITHDRAWN',
  'chua-tra-loi': 'NONE',
} as const satisfies Record<string, ConsentStatus>;

export type ConsentStatusRow = {
  userId: string;
  employeeCode: string;
  fullName: string;
  orgUnitName: string | null;
  status: ConsentStatus;
  lastAt: string | null;
  lastChannel: ConsentChannel | null;
  lastRecordId: string | null;
};

export type ConsentStatusPage = {
  items: ConsentStatusRow[];
  total: number;
  page: number;
  pageSize: number;
};

export const CONSENT_PAGE_SIZE = 20;

export type ConsentStatusInput = {
  q?: string;
  status?: ConsentStatus;
  page: number;
  pageSize: number;
};

export const consentStatusUrlParams = z
  .object({
    q: z.string().trim().max(100).optional().catch(undefined),
    'trang-thai': z.enum(['da-dong-y', 'da-rut', 'chua-tra-loi']).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ConsentStatusInput => ({
    q: url.q || undefined,
    status: url['trang-thai'] ? CONSENT_STATUS_PARAM[url['trang-thai']] : undefined,
    page: url.trang,
    pageSize: CONSENT_PAGE_SIZE,
  }));

export const exportConsentStatusInput = z.object({
  q: z.string().trim().max(100).optional(),
  status: consentStatus.optional(),
});
