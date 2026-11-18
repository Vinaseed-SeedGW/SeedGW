'use client';

import { LifeBuoy, Plus } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { FOOTER } from '@dms/config/footer';
import { formatDateTime } from '@dms/contracts/format';
import type { SupportDetail, SupportListResult } from '@dms/contracts/support';
import { FormSheet } from '@dms/ui/form-sheet';
import { useToast } from '@dms/ui/toast';
import {
  loadMySupportAction,
  loadSupportBadgeAction,
  loadSupportDetailAction,
  reopenSupportAction,
} from '@/server/actions/support';
import { useSupportEvents } from '../use-support-events';
import { SupportStatusBadge, supportKindText } from './support-badges';
import { SupportRequestFormCreate } from './support-request-form';
import { SupportThread } from './support-thread';

// Nút nổi Hỗ trợ cho Cán bộ nhân viên (quyết định 30, T2): yêu cầu của tôi, tạo yêu cầu, trao đổi.

type View = { name: 'list' } | { name: 'create' } | { name: 'detail'; code: string };

const LINK_BUTTON = 'text-sm font-bold text-brand hover:underline';

export function SupportButton({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ name: 'list' });
  const [count, setCount] = useState(initialCount);
  const [list, setList] = useState<SupportListResult | null>(null);
  const [detail, setDetail] = useState<SupportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const { actions: toast } = useToast();

  const refreshBadge = useCallback(() => {
    void loadSupportBadgeAction().then((result) => {
      if (result.ok) setCount(result.data.count);
    });
  }, []);

  const loadList = useCallback((target: number) => {
    startTransition(async () => {
      const result = await loadMySupportAction({ page: target });
      if (result.ok) {
        setList(result.data);
        setError(null);
      } else setError(result.message);
    });
  }, []);

  const loadDetail = useCallback(
    (code: string) => {
      startTransition(async () => {
        const result = await loadSupportDetailAction({ code });
        if (result.ok) {
          setDetail(result.data);
          setError(null);
          refreshBadge();
        } else setError(result.message);
      });
    },
    [refreshBadge],
  );

  useEffect(() => {
    if (!open) return;
    if (view.name === 'list') loadList(page);
    if (view.name === 'detail') loadDetail(view.code);
  }, [open, view, page, loadList, loadDetail]);

  useSupportEvents((code) => {
    refreshBadge();
    if (!open) return;
    if (view.name === 'list') loadList(page);
    if (view.name === 'detail' && (code === null || code === view.code)) loadDetail(view.code);
  });

  function close() {
    setOpen(false);
    setView({ name: 'list' });
    setDetail(null);
  }

  function reopen(code: string) {
    startTransition(async () => {
      const result = await reopenSupportAction({ code });
      if (result.ok) {
        toast.show({ tone: 'success', message: `Đã mở lại yêu cầu ${code}` });
        loadDetail(code);
      } else toast.show({ tone: 'error', message: result.message });
    });
  }

  const title =
    view.name === 'create'
      ? 'Gửi yêu cầu hỗ trợ'
      : view.name === 'detail'
        ? `Yêu cầu ${view.code}`
        : 'Hỗ trợ';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Hỗ trợ, ${count} yêu cầu có trả lời mới` : 'Hỗ trợ'}
        className="fixed right-4 bottom-4 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-brand-hover bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-6 sm:bottom-6"
      >
        <LifeBuoy size={20} aria-hidden />
        Hỗ trợ
        {count > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs text-primary-foreground">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <FormSheet.Root title={title} onClose={close}>
          {view.name !== 'list' ? (
            <button type="button" className={LINK_BUTTON} onClick={() => setView({ name: 'list' })}>
              Về yêu cầu của tôi
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
              {error}
            </p>
          ) : null}

          {view.name === 'list' ? (
            <div aria-busy={isPending}>
              <button
                type="button"
                onClick={() => setView({ name: 'create' })}
                className="inline-flex h-9.5 items-center gap-1.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
              >
                <Plus size={18} aria-hidden />
                Gửi yêu cầu mới
              </button>
              <p className="mt-2 text-sm text-text-muted">
                Hỏi đáp, báo lỗi, góp ý gửi tới Quản trị đơn vị của bạn. Trả lời hiện ở đây, có số
                đỏ trên nút Hỗ trợ.
              </p>
              <h3 className="mt-4 font-bold">Yêu cầu của tôi</h3>
              {list === null ? (
                <p className="mt-2 text-text-muted">Đang tải...</p>
              ) : list.items.length === 0 ? (
                <p className="mt-2 text-text-muted">Bạn chưa gửi yêu cầu nào.</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {list.items.map((item) => (
                    <li key={item.code}>
                      <button
                        type="button"
                        onClick={() => setView({ name: 'detail', code: item.code })}
                        className="grid w-full gap-1 rounded-md border border-border px-3 py-2 text-left hover:bg-brand-soft"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{item.title}</span>
                          {item.unread ? (
                            <span className="rounded-sm bg-danger px-1.5 text-xs font-bold text-primary-foreground">
                              Mới trả lời
                            </span>
                          ) : null}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                          <SupportStatusBadge status={item.status} />
                          {item.code}, {supportKindText(item.type, item.severity)},{' '}
                          {formatDateTime(item.lastActivityAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {list && list.total > list.pageSize ? (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    className={LINK_BUTTON}
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Trang trước
                  </button>
                  <span className="text-text-muted">
                    Trang {page} trên {Math.ceil(list.total / list.pageSize)}
                  </span>
                  <button
                    type="button"
                    className={LINK_BUTTON}
                    disabled={page * list.pageSize >= list.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Trang sau
                  </button>
                </div>
              ) : null}
              <p className="mt-6 text-sm text-text-muted">
                Cần gấp: {FOOTER.department}, email {FOOTER.email}, SĐT {FOOTER.phone}.
              </p>
            </div>
          ) : null}

          {view.name === 'create' ? (
            <div className="mt-3">
              <SupportRequestFormCreate
                onCreated={(code) => {
                  setPage(1);
                  setView({ name: 'detail', code });
                }}
              />
            </div>
          ) : null}

          {view.name === 'detail' ? (
            detail && detail.code === view.code ? (
              <div className="mt-3 grid gap-4" aria-busy={isPending}>
                <div>
                  <p className="font-bold">{detail.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                    <SupportStatusBadge status={detail.status} />
                    {supportKindText(detail.type, detail.severity)}
                    {detail.assigneeName ? `, ${detail.assigneeName} đang xử lý` : ''}
                  </p>
                </div>
                <SupportThread.Messages detail={detail} />
                {detail.actions.canReply ? (
                  <SupportThread.Composer
                    code={detail.code}
                    onSent={() => loadDetail(detail.code)}
                  />
                ) : null}
                {detail.actions.canReopen ? (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm text-text-muted">
                      Chưa ổn? Mở lại trong 7 ngày kể từ khi xong.
                    </p>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => reopen(detail.code)}
                      className="mt-2 h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
                    >
                      Mở lại
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-text-muted">Đang tải...</p>
            )
          ) : null}
        </FormSheet.Root>
      ) : null}
    </>
  );
}
