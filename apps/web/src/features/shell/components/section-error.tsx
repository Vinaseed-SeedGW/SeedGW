'use client';

export function SectionError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="py-10 text-center">
      <h2 className="text-lg font-bold text-brand">Không tải được dữ liệu</h2>
      <p className="mt-1 text-text-muted">Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.</p>
      <button type="button" className="mt-2 font-bold text-brand" onClick={reset}>
        Thử lại
      </button>
    </div>
  );
}
