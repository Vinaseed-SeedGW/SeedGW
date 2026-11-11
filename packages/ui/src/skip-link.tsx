// Vung main co id nay thi link bo qua moi nhay toi duoc.
export const MAIN_CONTENT_ID = 'noi-dung-chinh';

// Chi hien khi nhan Tab, giup nguoi dung ban phim va trinh doc man hinh khong phai di qua menu (WCAG 2.4.1).
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2.5 focus:font-bold focus:text-primary-foreground"
    >
      Bỏ qua tới nội dung chính
    </a>
  );
}
