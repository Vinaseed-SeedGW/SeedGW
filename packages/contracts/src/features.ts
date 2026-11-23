// Tính năng tạm hold theo yêu cầu 19/11/2026: chỉ tiêu, công nợ, doanh thu (Thực bán). Chỉ tiêu bật lại 23/11/2026
// (K3, phần lượt ghé thăm và số đại lý được ghé); Thực bán vẫn ẩn tới khi nối FAST.
// Ẩn khỏi menu, trang, app và Tham số; dữ liệu và code giữ nguyên, đổi sang true là bật lại.
export const FEATURES = {
  /** Chỉ tiêu tháng tự đăng ký (K3a) và phiếu Chỉ tiêu trong Cần duyệt (A10b). */
  salesTargets: true,
  /** Công nợ và hạn mức từ FAST (S11). */
  debt: false,
  /** Doanh số Thực bán từ hoá đơn FAST (K2). */
  sales: false,
} as const;

/** Trang tạm ẩn: vào bằng đường dẫn cũng như không có quyền. */
export const HIDDEN_PATHS: readonly string[] = [
  ...(FEATURES.salesTargets ? [] : ['/kinh-doanh/chi-tieu']),
];

export function isHiddenPath(pathname: string): boolean {
  return HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Tham số tạm ẩn khỏi trang Tham số; giá trị đã lưu giữ nguyên. */
export const HIDDEN_SETTING_KEYS: ReadonlySet<string> = new Set([
  ...(FEATURES.debt ? [] : ['debtWarningPercent', 'fastStockDebtSyncMinutes']),
  ...(FEATURES.sales ? [] : ['fastInvoiceSyncMinutes']),
]);
