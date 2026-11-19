'use client';

import { CHECK_IN_PLACE_KIND_LABEL, type CheckInRow } from '@seedgw/contracts/check-ins';
import { formatDateTime } from '@seedgw/contracts/format';
import { useModalDialog } from '@seedgw/ui/use-modal-dialog';

export function CheckInPhotoDialog({ row, onClose }: { row: CheckInRow; onClose: () => void }) {
  const { dialogRef, attachDialog } = useModalDialog();
  const title = `Ảnh check-in của ${row.employeeName}`;

  return (
    <dialog
      ref={attachDialog}
      aria-label={title}
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-md bg-surface p-4 text-text backdrop:bg-(--overlay)"
    >
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      <p className="text-text-muted">
        {formatDateTime(row.capturedAt)}, {CHECK_IN_PLACE_KIND_LABEL[row.placeKind]} {row.placeName}
      </p>
      {row.photoUrl ? (
        // Ảnh tải thẳng từ kho ảnh bằng link có hạn, không qua bộ tối ưu ảnh của Next.
        <img
          src={row.photoUrl}
          alt={`Ảnh check-in lúc ${formatDateTime(row.capturedAt)} tại ${row.placeName}`}
          className="mt-3 max-h-[70vh] w-full rounded-md object-contain"
        />
      ) : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="h-9 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
        >
          Đóng
        </button>
      </div>
    </dialog>
  );
}
