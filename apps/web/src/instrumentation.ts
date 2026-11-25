import type { Instrumentation } from 'next';

// F9: lỗi khi dựng trang, Route Handler, Server Action chưa bắt được thì ghi vào bảng lỗi.
// Chỉ nạp phần ghi lỗi ở bản chạy Node; viết điều kiện trực tiếp để bản edge bỏ hẳn đoạn này khi build.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reportRequestError } = await import('./server/services/request-error');
    await reportRequestError(error, request, context);
  }
};
