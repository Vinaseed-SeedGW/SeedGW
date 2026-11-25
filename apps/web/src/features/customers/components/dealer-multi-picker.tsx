'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useState, useTransition } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { MAX_CUSTOMER_DEALERS } from '@seedgw/contracts/customers';
import { searchCustomerDealersAction, type DealerChoice } from '@/server/actions/customers';

const SEARCH_DELAY_MS = 300;

type Props = {
  /** Tên đại lý đã chọn sẵn, để hiện chip khi mở form sửa. */
  initial: DealerChoice[];
};

/** Chọn tối đa 10 đại lý khách hàng hay mua, tìm trong phạm vi của người sửa. */
export function DealerMultiPicker({ initial }: Props) {
  const { setValue, formState } = useFormContext<{ dealerIds: string[] }>();
  const dealerIds = useWatch<{ dealerIds: string[] }, 'dealerIds'>({ name: 'dealerIds' });
  const [known, setKnown] = useState<DealerChoice[]>(initial);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DealerChoice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputId = useId();
  const listId = useId();
  const error = formState.errors.dealerIds?.message;

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setMessage(null);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await searchCustomerDealersAction(text);
        if (!result.ok) {
          setResults([]);
          setMessage(result.message);
          return;
        }
        setResults(result.data);
        setMessage(
          result.data.length === 0 ? 'Không có đại lý nào khớp trong phạm vi của bạn' : null,
        );
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const selected = dealerIds
    .map((id) => known.find((dealer) => dealer.value === id))
    .filter((dealer): dealer is DealerChoice => dealer !== undefined);
  const full = dealerIds.length >= MAX_CUSTOMER_DEALERS;

  function add(dealer: DealerChoice) {
    if (dealerIds.includes(dealer.value) || full) return;
    setKnown((list) =>
      list.some((item) => item.value === dealer.value) ? list : [...list, dealer],
    );
    setValue('dealerIds', [...dealerIds, dealer.value], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setQuery('');
  }

  function remove(id: string) {
    setValue(
      'dealerIds',
      dealerIds.filter((value) => value !== id),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-1 block font-bold">
        Đại lý hay mua
      </label>
      {selected.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Đại lý đã chọn">
          {selected.map((dealer) => (
            <li
              key={dealer.value}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-soft py-1 pr-1 pl-2.5"
            >
              <span className="min-w-0 truncate">{dealer.label}</span>
              <button
                type="button"
                onClick={() => remove(dealer.value)}
                className="inline-flex size-7 flex-none items-center justify-center rounded-md text-brand hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand"
                aria-label={`Bỏ ${dealer.label}`}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={full}
        placeholder={full ? `Đã chọn đủ ${MAX_CUSTOMER_DEALERS} đại lý` : 'Gõ tên hoặc mã đại lý'}
        autoComplete="off"
        aria-controls={listId}
        aria-describedby={`${inputId}-hint`}
        className="h-10 w-full rounded-md border border-input bg-surface px-3 disabled:opacity-60"
      />
      <p id={`${inputId}-hint`} className="mt-1 text-sm text-text-muted">
        Tìm trong đại lý thuộc phạm vi của bạn, chọn tối đa {MAX_CUSTOMER_DEALERS} đại lý.
      </p>
      <div id={listId} aria-live="polite">
        {isPending ? <p className="mt-1 text-sm text-text-muted">Đang tìm đại lý</p> : null}
        {message ? <p className="mt-1 text-sm text-text-muted">{message}</p> : null}
        {results.length > 0 ? (
          <ul className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-surface">
            {results.map((dealer) => {
              const picked = dealerIds.includes(dealer.value);
              return (
                <li key={dealer.value}>
                  <button
                    type="button"
                    disabled={picked}
                    onClick={() => add(dealer)}
                    className="block w-full px-3 py-2.5 text-left hover:bg-brand-soft disabled:text-text-muted"
                  >
                    {dealer.label}
                    {picked ? ' (đã chọn)' : ''}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
