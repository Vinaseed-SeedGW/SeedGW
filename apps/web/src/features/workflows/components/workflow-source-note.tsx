import type { WorkflowDetail } from '@dms/contracts/workflows';

export function WorkflowSourceNote({ own, inherited }: Pick<WorkflowDetail, 'own' | 'inherited'>) {
  if (own) {
    return (
      <p className="rounded-md bg-brand-soft px-3 py-2">
        Đơn vị dùng <b>quy trình riêng</b>, phiên bản {own.version}.
      </p>
    );
  }
  if (inherited) {
    return (
      <p className="rounded-md bg-surface-subtle px-3 py-2">
        Đơn vị đang <b>kế thừa từ {inherited.sourceUnitName}</b>, phiên bản {inherited.version}.
      </p>
    );
  }
  return (
    <p className="rounded-md bg-warning-soft px-3 py-2">
      Chưa có quy trình nào áp dụng cho đơn vị này. Đơn hàng sẽ không có người duyệt cho tới khi đơn
      vị này hoặc đơn vị cấp trên được cấu hình.
    </p>
  );
}
