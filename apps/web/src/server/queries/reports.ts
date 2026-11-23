import 'server-only';
import type { ReportInput, ReportResult } from '@seedgw/contracts/reports';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { readReport } from '@/server/services/reports';

export async function getReport(input: ReportInput): Promise<ReportResult> {
  const user = await requireUser();
  assertCan(user, 'sales.report.read');
  return readReport(input);
}
