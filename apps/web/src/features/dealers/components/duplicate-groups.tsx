'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  mergeBlockReason,
  type DuplicateGroup,
  type DuplicateMember,
  type DuplicateTab,
  type ListDuplicatesResult,
} from '@dms/contracts/dealer-cleanup';
import { DEALER_LEVEL_LABEL, type DealerLevel } from '@dms/contracts/dealers';
import { formatNumber } from '@dms/contracts/format';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import {
  clearSharedPhoneAction,
  dismissDuplicateAction,
  mergeDealersAction,
} from '@/server/actions/dealer-cleanup';

const PRIMARY =
  'inline-flex h-9 items-center rounded-md bg-brand px-3 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-50';
const SECONDARY =
  'inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft';

type Dialog = 'merge' | 'dismiss' | 'clear' | null;

function memberLabel(member: DuplicateMember) {
  return `${member.code ?? member.legacyCode ?? 'Chưa có mã'} ${member.name}`;
}

/** Ưu tiên giữ đại lý có mã FAST, rồi đại lý có nhiều check-in nhất. */
function defaultKept(members: readonly DuplicateMember[]): string {
  const sorted = [...members].sort(
    (a, b) => Number(Boolean(b.code)) - Number(Boolean(a.code)) || b.checkInCount - a.checkInCount,
  );
  return sorted[0]?.id ?? '';
}

function GroupCard({ group }: { group: DuplicateGroup }) {
  const [keptId, setKeptId] = useState(() => defaultKept(group.members));
  const [mergedIds, setMergedIds] = useState<string[]>(() =>
    group.members.length <= 4
      ? group.members.map((m) => m.id).filter((id) => id !== defaultKept(group.members))
      : [],
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const kept = group.members.find((member) => member.id === keptId);
  const merged = group.members.filter(
    (member) => mergedIds.includes(member.id) && member.id !== keptId,
  );
  const blocked = kept && merged.length > 0 ? mergeBlockReason(kept, merged) : null;
  const valueLabel = group.kind === 'PHONE' ? `Số ${group.value}` : `Mã số thuế ${group.value}`;

  function toggle(id: string) {
    setMergedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section
      aria-label={valueLabel}
      className="min-w-0 rounded-md border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold text-brand">{valueLabel}</h2>
        <span className="text-sm text-text-muted">{group.members.length} đại lý</span>
        {group.sameName ? (
          <span className="rounded-sm bg-warning-soft px-1.5 text-sm">Trùng cả tên</span>
        ) : null}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-180 border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th scope="col" className="py-1.5 pr-2 font-bold">
                Giữ lại
              </th>
              <th scope="col" className="py-1.5 pr-2 font-bold">
                Gộp vào
              </th>
              <th scope="col" className="py-1.5 pr-2 font-bold">
                Đại lý
              </th>
              <th scope="col" className="py-1.5 pr-2 font-bold">
                Địa chỉ
              </th>
              <th scope="col" className="py-1.5 pr-2 font-bold">
                Phụ trách
              </th>
              <th scope="col" className="py-1.5 font-bold">
                Check-in
              </th>
            </tr>
          </thead>
          <tbody>
            {group.members.map((member) => (
              <tr key={member.id} className="border-b border-border align-top">
                <td className="py-1.5 pr-2">
                  <input
                    type="radio"
                    name={`giu-${group.kind}-${group.value}`}
                    className="size-4 accent-brand"
                    checked={member.id === keptId}
                    onChange={() => setKeptId(member.id)}
                    aria-label={`Giữ lại ${memberLabel(member)}`}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    disabled={member.id === keptId}
                    checked={member.id !== keptId && mergedIds.includes(member.id)}
                    onChange={() => toggle(member.id)}
                    aria-label={`Gộp ${memberLabel(member)} vào đại lý giữ lại`}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <a
                    href={`/quan-tri/dai-ly/${member.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-brand hover:underline"
                  >
                    {member.name}
                  </a>
                  <span className="block text-text-muted">
                    {member.code ? `FAST ${member.code}` : 'Chưa có mã FAST'}
                    {member.legacyCode ? `, mã cũ ${member.legacyCode}` : ''},{' '}
                    {DEALER_LEVEL_LABEL[member.level as DealerLevel] ?? `Cấp ${member.level}`}
                  </span>
                  {member.ownerName ? (
                    <span className="block text-text-muted">Chủ: {member.ownerName}</span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-2">
                  {member.address}
                  <span className="block text-text-muted">
                    {member.provinceName ?? 'Chưa có tỉnh'}
                    {member.hasLocation ? ', có toạ độ' : ''}
                  </span>
                </td>
                <td className="py-1.5 pr-2">
                  {member.assignedUserName ?? 'Chưa gán'}
                  <span className="block text-text-muted">{member.orgUnitName ?? ''}</span>
                </td>
                <td className="py-1.5">{formatNumber(member.checkInCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {blocked ? (
        <p role="note" className="mt-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-sm">
          {blocked}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={!kept || merged.length === 0 || blocked !== null}
          onClick={() => setDialog('merge')}
        >
          Gộp {merged.length > 0 ? `${merged.length} đại lý` : ''} vào bản giữ lại
        </button>
        <button type="button" className={SECONDARY} onClick={() => setDialog('dismiss')}>
          Không phải trùng
        </button>
        {group.kind === 'PHONE' ? (
          <button type="button" className={SECONDARY} onClick={() => setDialog('clear')}>
            Số giả, bỏ số này
          </button>
        ) : null}
      </div>

      {dialog === 'merge' && kept ? (
        <ConfirmDialog
          title="Gộp đại lý trùng"
          confirmLabel="Gộp"
          tone="primary"
          successMessage={`Đã gộp ${merged.length} đại lý vào ${kept.name}`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const result = await mergeDealersAction({
              keptId: kept.id,
              mergedIds: merged.map((member) => member.id),
            });
            return result.ok ? { ok: true } : result;
          }}
        >
          <p>
            Giữ lại <b>{memberLabel(kept)}</b>. Gộp vào:
          </p>
          <ul className="mt-1 grid gap-0.5">
            {merged.map((member) => (
              <li key={member.id}>{memberLabel(member)}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-text-muted">
            Check-in, điểm trong tuyến, đề xuất toạ độ và đại lý con chuyển sang bản giữ lại; ô
            trống của bản giữ lại lấy từ bản gộp. Bản gộp chuyển Ngừng hoạt động, không xoá, có lịch
            sử gộp.
          </p>
        </ConfirmDialog>
      ) : null}
      {dialog === 'dismiss' ? (
        <ConfirmDialog
          title="Không phải đại lý trùng"
          confirmLabel="Xác nhận"
          tone="primary"
          successMessage="Đã ẩn nhóm khỏi danh sách trùng"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const result = await dismissDuplicateAction({ kind: group.kind, value: group.value });
            return result.ok ? { ok: true } : result;
          }}
        >
          <p>
            Các đại lý dùng chung {valueLabel.toLowerCase()} nhưng là các đại lý khác nhau. Nhóm này
            sẽ không hiện lại trong danh sách trùng.
          </p>
        </ConfirmDialog>
      ) : null}
      {dialog === 'clear' ? (
        <ConfirmDialog
          title="Bỏ số giả"
          confirmLabel="Bỏ số"
          tone="danger"
          successMessage={`Đã bỏ số ${group.value}`}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const result = await clearSharedPhoneAction({ phone: group.value });
            return result.ok ? { ok: true } : result;
          }}
        >
          <p>
            Bỏ số {group.value} khỏi {group.members.length} đại lý trong phạm vi của bạn, để trống
            điện thoại chờ người phụ trách cập nhật số thật. Mỗi đại lý đều ghi nhật ký.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

export function DuplicateGroups({ data, tab }: { data: ListDuplicatesResult; tab: DuplicateTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const go = (page: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('trang', String(page));
    router.push(`${pathname}?${next.toString()}`);
  };
  if (data.items.length === 0) {
    return (
      <p className="mt-4 text-text-muted">
        {tab === 'ma-so-thue'
          ? 'Không còn đại lý trùng mã số thuế trong phạm vi.'
          : 'Không còn nhóm đại lý trùng số điện thoại trong nhóm này.'}
      </p>
    );
  }
  return (
    <>
      <div className="mt-4 grid gap-4">
        {data.items.map((group) => (
          <GroupCard key={`${group.kind}-${group.value}`} group={group} />
        ))}
      </div>
      <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={SECONDARY}
          disabled={data.page <= 1}
          onClick={() => go(data.page - 1)}
        >
          Trang trước
        </button>
        <span className="text-sm text-text-muted">
          Trang {data.page} trên {pages}, {formatNumber(data.total)} nhóm
        </span>
        <button
          type="button"
          className={SECONDARY}
          disabled={data.page >= pages}
          onClick={() => go(data.page + 1)}
        >
          Trang sau
        </button>
      </nav>
    </>
  );
}
