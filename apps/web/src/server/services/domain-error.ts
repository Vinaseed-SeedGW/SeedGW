import 'server-only';
import type { ErrorCode } from '@seedgw/contracts/common';

// Loi nghiep vu co thong bao tieng Viet, duoc tra ve cho nguoi dung nguyen van.
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}
