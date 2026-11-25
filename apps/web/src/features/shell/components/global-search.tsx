'use client';

import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import {
  SEARCH_GROUP_LABEL,
  SEARCH_MIN_LENGTH,
  type SearchHit,
  type SearchPage,
} from '@seedgw/contracts/search';
import { normalizeSearchText } from '@seedgw/contracts/text';
import { globalSearchAction } from '@/server/actions/search';

const SEARCH_DELAY_MS = 250;
const PAGE_LIMIT = 6;

type Option = { key: string; group: string; title: string; detail: string; href: string };

type Props = { pages: SearchPage[] };

/** D3: ô tìm nhanh, mở bằng nút trên thanh trên hoặc Ctrl+K (Cmd+K trên Mac). */
export function GlobalSearch({ pages }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 min-w-0 flex-none items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-text-muted hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
        aria-label="Tìm nhanh, phím tắt Ctrl K"
        aria-haspopup="dialog"
      >
        <Search size={18} aria-hidden />
        <span className="hidden lg:inline">Tìm nhanh</span>
        <kbd className="hidden rounded-sm border border-border px-1.5 text-xs lg:inline">
          Ctrl K
        </kbd>
      </button>
      {open ? <SearchDialog pages={pages} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SearchDialog({ pages, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const listId = useId();

  const attach = useCallback((element: HTMLDialogElement | null) => {
    dialogRef.current = element;
    if (element && !element.open) element.showModal();
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (normalizeSearchText(text).length < SEARCH_MIN_LENGTH) {
      setHits([]);
      setError(null);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearchAction(text);
        if (result.ok) {
          setHits(result.data);
          setError(null);
        } else {
          setHits([]);
          setError(result.message);
        }
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const options = useMemo<Option[]>(() => {
    const needle = normalizeSearchText(query);
    const pageOptions = pages
      .filter((page) => !needle || normalizeSearchText(page.label).includes(needle))
      .slice(0, needle ? PAGE_LIMIT : pages.length)
      .map((page) => ({
        key: `page:${page.href}`,
        group: 'Trang',
        title: page.label,
        detail: page.section,
        href: page.href,
      }));
    const hitOptions = hits.map((hit) => ({
      key: `${hit.group}:${hit.id}`,
      group: SEARCH_GROUP_LABEL[hit.group],
      title: hit.title,
      detail: hit.detail,
      href: hit.href,
    }));
    return [...hitOptions, ...pageOptions];
  }, [hits, pages, query]);

  useEffect(() => setActive(0), [options]);

  function go(option: Option | undefined) {
    if (!option) return;
    dialogRef.current?.close();
    router.push(option.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(options[active]);
    }
  }

  const activeId = options[active] ? `${listId}-${active}` : undefined;
  let lastGroup = '';

  return (
    <dialog
      ref={attach}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      aria-labelledby={inputId}
      className="mx-auto mt-[10vh] w-[min(640px,calc(100vw-32px))] rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-(--overlay)"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search size={20} className="flex-none text-text-muted" aria-hidden />
        <label htmlFor={inputId} className="sr-only">
          Tìm trang, đại lý, khách hàng, tài khoản, mã yêu cầu hỗ trợ
        </label>
        <input
          id={inputId}
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tìm trang, đại lý, khách hàng, tài khoản, mã HT"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeId}
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent outline-none"
        />
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="inline-flex size-9 flex-none items-center justify-center rounded-md text-text-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand"
          aria-label="Đóng tìm nhanh"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-auto p-2">
        <p className="sr-only" aria-live="polite">
          {isPending ? 'Đang tìm' : `${options.length} kết quả`}
        </p>
        {error ? <p className="px-2 py-2 text-danger">{error}</p> : null}
        {options.length === 0 && !isPending ? (
          <p className="px-2 py-6 text-center text-text-muted">Không có kết quả nào khớp.</p>
        ) : null}
        <ul id={listId} role="listbox" aria-label="Kết quả tìm">
          {options.map((option, index) => {
            const heading = option.group !== lastGroup ? option.group : null;
            lastGroup = option.group;
            return (
              <li key={option.key} role="presentation">
                {heading ? (
                  <p
                    role="presentation"
                    className="px-2 pt-2 pb-1 text-xs font-bold tracking-wide text-text-muted uppercase"
                  >
                    {heading}
                  </p>
                ) : null}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(option)}
                  className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-md px-2.5 py-1.5 ${
                    index === active ? 'bg-brand-soft text-brand' : ''
                  }`}
                >
                  <span className="font-bold">{option.title}</span>
                  {option.detail ? (
                    <span className="text-sm text-text-muted">{option.detail}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
        Dùng phím mũi tên lên, xuống để chọn, Enter để mở, Esc để đóng.
      </p>
    </dialog>
  );
}
