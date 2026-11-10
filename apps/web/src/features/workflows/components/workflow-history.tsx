import { formatDateTime } from '@dms/contracts/format';
import type { WorkflowVersionView } from '@dms/contracts/workflows';
import { WorkflowStepsReadOnly } from '@/features/workflows/components/workflow-steps-read-only';

export function WorkflowHistory({ versions }: { versions: readonly WorkflowVersionView[] }) {
  return (
    <section className="mt-6">
      <h2 className="font-bold text-brand">Lịch sử phiên bản</h2>
      {versions.length === 0 ? (
        <p className="mt-2 text-text-muted">Đơn vị này chưa có phiên bản quy trình riêng nào.</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {versions.map((version) => (
            <li key={version.version} className="rounded-md border border-border bg-surface">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <b>Phiên bản {version.version}</b>
                  {version.isActive ? (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">
                      Đang dùng
                    </span>
                  ) : null}
                  <span className="text-sm text-text-muted">
                    {formatDateTime(version.createdAt)}, {version.createdByName},{' '}
                    {version.steps.length} bước
                  </span>
                </summary>
                <div className="px-3 pb-3">
                  <WorkflowStepsReadOnly steps={version.steps} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
