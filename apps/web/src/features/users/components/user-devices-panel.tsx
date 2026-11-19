'use client';

import { useState } from 'react';
import { formatDateTime } from '@seedgw/contracts/format';
import { MOBILE_DEVICE_STATUS_LABEL, type UserDevice } from '@seedgw/contracts/users';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { setMobileDeviceStatusAction } from '@/server/actions/users';

type DeviceDialog = { device: UserDevice; status: 'ACTIVE' | 'REVOKED' };

export function UserDevicesPanel({ devices }: { devices: UserDevice[] }) {
  const [dialog, setDialog] = useState<DeviceDialog | null>(null);

  return (
    <section className="mt-6 rounded-md border border-border bg-surface p-4">
      <h2 className="text-lg font-bold">Thiết bị di động</h2>
      {devices.length === 0 ? (
        <p className="mt-2 text-text-muted">Chưa có thiết bị nào đăng ký.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {devices.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {device.name} ({device.platform})
                </p>
                <p className="text-sm text-text-muted">
                  {MOBILE_DEVICE_STATUS_LABEL[device.status]}, đăng ký{' '}
                  {formatDateTime(device.createdAt)}
                  {device.lastSeenAt ? `, dùng gần nhất ${formatDateTime(device.lastSeenAt)}` : ''}
                </p>
                {device.isRooted ? (
                  <p className="mt-1 inline-block rounded-sm bg-warning-soft px-1.5 text-sm">
                    Máy đã root hoặc jailbreak: check-in từ máy này được gắn cờ nghi vấn
                  </p>
                ) : null}
              </div>
              {device.status === 'PENDING' ? (
                <button
                  type="button"
                  className="text-brand"
                  onClick={() => setDialog({ device, status: 'ACTIVE' })}
                >
                  Duyệt
                </button>
              ) : null}
              {device.status !== 'REVOKED' ? (
                <button
                  type="button"
                  className="text-danger"
                  onClick={() => setDialog({ device, status: 'REVOKED' })}
                >
                  Thu hồi
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {dialog ? (
        <ConfirmDialog
          title={dialog.status === 'ACTIVE' ? 'Duyệt thiết bị' : 'Thu hồi thiết bị'}
          confirmLabel={dialog.status === 'ACTIVE' ? 'Duyệt' : 'Thu hồi'}
          tone={dialog.status === 'ACTIVE' ? 'primary' : 'danger'}
          successMessage={dialog.status === 'ACTIVE' ? 'Đã duyệt thiết bị' : 'Đã thu hồi thiết bị'}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            setMobileDeviceStatusAction({ deviceId: dialog.device.id, status: dialog.status })
          }
        >
          <p>
            {dialog.status === 'ACTIVE'
              ? `Thiết bị ${dialog.device.name} sẽ được dùng. Thiết bị đang dùng trước đó (nếu có) bị thu hồi.`
              : `Thiết bị ${dialog.device.name} sẽ bị đăng xuất ở lần kết nối tiếp theo.`}
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
