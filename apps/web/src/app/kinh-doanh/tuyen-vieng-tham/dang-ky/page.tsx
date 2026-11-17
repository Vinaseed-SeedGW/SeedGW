import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { PENDING_APPROVAL_STATUSES } from '@dms/contracts/approvals';
import { formatDateTime } from '@dms/contracts/format';
import { isoDay, ROUTE_KIND_LABEL } from '@dms/contracts/route-plans';
import { RouteEditor } from '@/features/route-plans/components/route-editor';
import { can, requirePermission } from '@/server/auth/can';
import { getPeopleFilterOptions } from '@/server/queries/people-filters';
import { getRouteEditorContext } from '@/server/queries/route-plans';

export const metadata: Metadata = { title: 'Đăng ký tuyến' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const params = z.object({
  ky: isoDay.optional().catch(undefined),
  'nhan-vien': z.string().trim().max(40).optional().catch(undefined),
});

const CONTROL = 'h-9.5 rounded-md border border-border bg-surface px-2.5';

export default async function RouteRegisterPage({ searchParams }: PageProps) {
  const user = await requirePermission('sales.route.read');
  const input = params.parse(await searchParams);
  const canOverride = can(user, 'sales.approval.override');
  const employeeCode = input['nhan-vien'] || undefined;
  const [context, people] = await Promise.all([
    getRouteEditorContext(employeeCode),
    canOverride ? getPeopleFilterOptions(null, 'sales.route.read') : null,
  ]);
  const ownerQuery =
    context && !context.owner.isSelf ? `&nhan-vien=${context.owner.employeeCode}` : '';
  const backHref = context?.owner.isSelf
    ? '/kinh-doanh/tuyen-vieng-tham'
    : '/kinh-doanh/tuyen-vieng-tham?tab=pham-vi';
  const period = context?.routes.periods.find(
    (item) => item.editable && item.periodStart === input.ky,
  );
  const pending =
    period?.plan?.approvalStatus != null &&
    PENDING_APPROVAL_STATUSES.includes(period.plan.approvalStatus);

  return (
    <>
      <Link href={backHref} className="text-sm text-brand hover:underline">
        Về Tuyến viếng thăm
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-brand">
        {period ? `Đăng ký tuyến ${period.periodLabel.toLowerCase()}` : 'Đăng ký tuyến'}
      </h1>

      {people ? (
        <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            Đăng ký cho
            <select name="nhan-vien" defaultValue={employeeCode ?? ''} className={CONTROL}>
              <option value="">Chính tôi</option>
              {people.employees.map((employee) => (
                <option key={employee.code} value={employee.code}>
                  {employee.code} {employee.name}
                  {employee.orgUnitName ? `, ${employee.orgUnitName}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
          >
            Chọn
          </button>
        </form>
      ) : null}

      {!context ? (
        <p className="mt-4 text-text-muted">
          {employeeCode
            ? 'Không tìm thấy nhân viên, hoặc bạn không có quyền đăng ký thay.'
            : 'Tài khoản chưa được cấp quyền đăng ký tuyến.'}
        </p>
      ) : (
        <>
          <p className="mt-2 text-text-muted">
            {context.owner.isSelf
              ? 'Tuyến của bạn'
              : `Đăng ký thay ${context.owner.fullName} (${context.owner.employeeCode}). Phiếu đứng tên nhân viên và đi đúng luồng duyệt của nhân viên đó`}
            , đơn vị đăng ký tuyến {ROUTE_KIND_LABEL[context.routes.kind].toLowerCase()}.
          </p>
          <nav aria-label="Kỳ đăng ký" className="mt-3 flex flex-wrap gap-2">
            {context.routes.periods
              .filter((item) => item.editable)
              .map((item) => {
                const active = item.periodStart === input.ky;
                return (
                  <Link
                    key={item.periodStart}
                    href={`/kinh-doanh/tuyen-vieng-tham/dang-ky?ky=${item.periodStart}${ownerQuery}`}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md border px-3 py-1.5 ${active ? 'border-brand bg-brand-soft font-bold text-brand' : 'border-border hover:bg-brand-soft'}`}
                  >
                    {item.periodLabel}
                    {item.plan?.approvalStatus ? ', đã có tuyến' : ''}
                  </Link>
                );
              })}
          </nav>
          {!input.ky ? (
            <p className="mt-4 text-text-muted">Chọn kỳ để đăng ký hoặc sửa tuyến.</p>
          ) : !period ? (
            <p className="mt-4 text-text-muted">
              Kỳ này không đăng ký được. Chỉ đăng ký tuần này và tuần sau, hoặc hôm nay tới 7 ngày
              tới.
            </p>
          ) : pending ? (
            <p className="mt-4 rounded-md bg-warning-soft px-3 py-2">
              Phiếu {period.plan?.approvalCode} đang chờ duyệt. Rút lại phiếu ở trang Cần duyệt hoặc
              Tuyến của tôi trước khi sửa.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-text-muted">
                Hạn nộp {formatDateTime(period.deadline)}
                {period.pastDeadline ? ', đã qua hạn: vẫn gửi được, phiếu gắn nhãn Nộp muộn' : ''}.
                {period.plan?.approved
                  ? ' Bản sửa phải được duyệt lại, trong lúc chờ tuyến đã duyệt vẫn có hiệu lực.'
                  : ''}
              </p>
              <RouteEditor
                key={`${context.owner.id}-${period.periodStart}`}
                period={period}
                ownerId={context.owner.isSelf ? null : context.owner.id}
                backHref={backHref}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
