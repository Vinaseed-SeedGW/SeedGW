import 'server-only';
import { recordError, type ErrorReport } from '@seedgw/db/error-log';

/** F9: Route Handler và instrumentation ghi lỗi qua đây. Không bao giờ ném lỗi. */
export function logError(report: ErrorReport): Promise<void> {
  return recordError(report);
}
