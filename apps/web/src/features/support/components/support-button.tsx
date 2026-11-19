'use client';

import { Inbox, LifeBuoy, Plus } from 'lucide-react';
import Link from 'next/link';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { FOOTER } from '@dms/config/footer';
import { formatDateTime } from '@dms/contracts/format';
import type { SupportDetail, SupportListResult } from '@dms/contracts/support';
import { FormSheet } from '@dms/ui/form-sheet';
import { useToast } from '@dms/ui/toast';
import {
  loadMySupportAction,
  loadSupportButtonSummaryAction,
  loadSupportDetailAction,
  reopenSupportAction,
} from '@/server/actions/support';
import { useSupportEvents } from '../use-support-events';
import { SupportStatusBadge, supportKindText } from './support-badges';
import { SupportRequestFormCreate } from './support-request-form';
import { SupportThread } from './support-thread';

// Nút nổi Hỗ trợ ở góc dưới bên phải mọi trang (quyết định 32, thay một phần quyết định 30).
// Ba biến thể theo vai trò: người gửi, Quản trị đơn vị, Quản trị hệ thống.

export type SupportButtonSummary = { unread: number; pending: number; overdue: number };

type ShellContextValue = {
  state: { summary: SupportButtonSummary };
  actions: { refresh: () => void };
  meta: { badge: number };
};

const ShellContext = createContext<ShellContextValue | null>(null);

function useShell(): ShellContextValue {
  const value = use(ShellContext);
  if (!value) throw new Error('Phan nay phai nam trong nut noi Ho tro.');
  return value;
}

const LINK_BUTTON = 'text-sm font-bold text-brand hover:underline';

function badgeLabel(summary: SupportButtonSummary): string {
  const parts = [
    summary.unread > 0 ? `${summary.unread} yêu cầu có trả lời mới` : '',
    summary.pending > 0 ? `${summary.pending} yêu cầu chờ xử lý` : '',
  ].filter(Boolean);
  return parts.length > 0 ? `Hỗ trợ, ${parts.join(', ')}` : 'Hỗ trợ';
}

/** Nút tròn nổi và khung bên phải. Dưới 768 px chỉ còn biểu tượng cho đỡ che nội dung. */
function Shell({ initial, children }: { initial: SupportButtonSummary; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(initial);

  const refresh = useCallback(() => {
    void loadSupportButtonSummaryAction().then((result) => {
      if (result.ok) setSummary(result.data);
    });
  }, []);
  useSupportEvents(refresh);

  const badge = summary.unread + summary.pending;
  const value = useMemo<ShellContextValue>(
    () => ({ state: { summary }, actions: { refresh }, meta: { badge } }),
    [summary, refresh, badge],
  );

  return (
    <ShellContext value={value}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={badgeLabel(summary)}
        className="fixed right-4 bottom-4 z-30 inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-brand-hover bg-brand font-bold text-primary-foreground shadow-md hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:right-6 md:bottom-6 md:px-4"
      >
        <LifeBuoy size={22} aria-hidden />
        <span className="max-md:sr-only">Hỗ trợ</span>
        {badge > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs text-primary-foreground max-md:absolute max-md:-top-1 max-md:-right-1">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <FormSheet.Root title="Hỗ trợ" onClose={() => setOpen(false)}>
          <div className="grid gap-5">{children}</div>
        </FormSheet.Root>
      ) : null}
    </ShellContext>
  );
}

/** Lối vào trang xử lý cho Quản trị đơn vị và Quản trị hệ thống. */
function HandlerSummary({ inboxLabel }: { inboxLabel: string }) {
  const { state } = useShell();
  const { pending, overdue } = state.summary;
  return (
    <section className="rounded-md border border-border bg-surface-subtle p-3">
      <h3 className="font-bold">Yêu cầu cần xử lý</h3>
      <p className="mt-1 text-sm">
        {pending > 0 ? `${pending} yêu cầu chờ xử lý` : 'Không có yêu cầu nào chờ xử lý'}
        {overdue > 0 ? <span className="font-bold text-danger">, {overdue} quá hạn</span> : null}
      </p>
      <Link
        href={overdue > 0 ? '/quan-tri/ho-tro?xem=dang-mo&han=qua-han' : '/quan-tri/ho-tro'}
        className="mt-2 inline-flex h-9.5 items-center gap-1.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
      >
        <Inbox size={18} aria-hidden />
        {inboxLabel}
      </Link>
    </section>
  );
}

type View = { name: 'list' } | { name: 'create' } | { name: 'detail'; code: string };

/** Yêu cầu của tôi, gửi yêu cầu mới, trao đổi. Chỉ chạy khi khung đang mở. */
function RequesterPanel({ recipient }: { recipient: string }) {
  const { actions: shell } = useShell();
  const [view, setView] = useState<View>({ name: 'list' });
  const [list, setList] = useState<SupportListResult | null>(null);
  const [detail, setDetail] = useState<SupportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const { actions: toast } = useToast();

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
          shell.refresh();
        } else setError(result.message);
      });
    },
    [shell],
  );

  useEffect(() => {
    if (view.name === 'list') loadList(page);
    if (view.name === 'detail') loadDetail(view.code);
  }, [view, page, loadList, loadDetail]);

  useSupportEvents((code) => {
    if (view.name === 'list') loadList(page);
    if (view.name === 'detail' && (code === null || code === view.code)) loadDetail(view.code);
  });

  function reopen(code: string) {
    startTransition(async () => {
      const result = await reopenSupportAction({ code });
      if (result.ok) {
        toast.show({ tone: 'success', message: `Đã mở lại yêu cầu ${code}` });
        loadDetail(code);
      } else toast.show({ tone: 'error', message: result.message });
    });
  }

  return (
    <section aria-label="Yêu cầu của tôi" aria-busy={isPending}>
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
        <>
          <button
            type="button"
            onClick={() => setView({ name: 'create' })}
            className="inline-flex h-9.5 items-center gap-1.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
          >
            <Plus size={18} aria-hidden />
            Gửi yêu cầu mới
          </button>
          <p className="mt-2 text-sm text-text-muted">
            Hỏi đáp, báo lỗi, góp ý gửi tới {recipient}. Trả lời hiện ở đây, có số đỏ trên nút Hỗ
            trợ.
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
        </>
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
          <div className="mt-3 grid gap-4">
            <div>
              <p className="font-bold">{detail.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                <SupportStatusBadge status={detail.status} />
                {detail.code}, {supportKindText(detail.type, detail.severity)}
                {detail.assigneeName ? `, ${detail.assigneeName} đang xử lý` : ''}
              </p>
            </div>
            <SupportThread.Messages detail={detail} />
            {detail.actions.canReply ? (
              <SupportThread.Composer code={detail.code} onSent={() => loadDetail(detail.code)} />
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
    </section>
  );
}

function Contact() {
  return (
    <p className="text-sm text-text-muted">
      Cần gấp: {FOOTER.department}, email {FOOTER.email}, SĐT {FOOTER.phone}.
    </p>
  );
}

/** Nhân viên, Quản lý, Lãnh đạo đơn vị: gửi tới Quản trị đơn vị. */
export function SupportButtonRequester({ initial }: { initial: SupportButtonSummary }) {
  return (
    <Shell initial={initial}>
      <RequesterPanel recipient="Quản trị đơn vị của bạn" />
      <Contact />
    </Shell>
  );
}

/** Quản trị đơn vị: lối vào hộp chung, và gửi yêu cầu của mình thẳng Quản trị hệ thống. */
export function SupportButtonUnitHandler({ initial }: { initial: SupportButtonSummary }) {
  return (
    <Shell initial={initial}>
      <HandlerSummary inboxLabel="Mở hộp chung của đơn vị" />
      <RequesterPanel recipient="Quản trị hệ thống" />
      <Contact />
    </Shell>
  );
}

/** Quản trị hệ thống: lối vào trang xử lý, không tự gửi yêu cầu cho mình. */
export function SupportButtonSystem({ initial }: { initial: SupportButtonSummary }) {
  return (
    <Shell initial={initial}>
      <HandlerSummary inboxLabel="Mở trang Hỗ trợ trong Quản trị" />
      <p className="text-sm text-text-muted">
        Yêu cầu các đơn vị chuyển lên, hoặc từ đơn vị chưa có Quản trị đơn vị, nằm ở trang Hỗ trợ
        trong Quản trị.
      </p>
    </Shell>
  );
}
