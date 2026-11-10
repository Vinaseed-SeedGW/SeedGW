'use client';

import { CalendarDays } from 'lucide-react';
import { useRef, useState } from 'react';
import { isoDateToDisplay, maskDateText, parseDisplayDate } from '@dms/contracts/format';
import { cn } from './cn';

type DateInputProps = {
  // Ngay hop le la yyyy-mm-dd, o trong la chuoi rong, chua xong hoac sai thi la chu dang go.
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  ref?: (element: HTMLInputElement | null) => void;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
  inputClassName?: string;
};

// O date cua trinh duyet hien theo ngon ngu may nen khong ep duoc dd/mm/yyyy.
export function DateInput({
  value,
  onValueChange,
  className,
  inputClassName,
  ...inputProps
}: DateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(isoDateToDisplay(value));

  // Cap nhat khi gia tri doi tu ben ngoai, vi du bam nut quay lai.
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setText(isoDateToDisplay(value));
  }

  function applyText(raw: string) {
    const masked = maskDateText(raw);
    setText(masked);
    onValueChange(parseDisplayDate(masked) ?? masked);
  }

  return (
    <span className={cn('relative inline-block', className)}>
      <input
        {...inputProps}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        className={cn('w-full pr-9', inputClassName)}
        value={text}
        onChange={(event) => applyText(event.target.value)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-brand"
        aria-label="Mở lịch chọn ngày"
        onClick={() => pickerRef.current?.showPicker()}
      >
        <CalendarDays size={16} aria-hidden />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="absolute right-0 bottom-0 size-0 opacity-0"
        value={parseDisplayDate(text) ?? ''}
        onChange={(event) => applyText(event.target.value)}
      />
    </span>
  );
}
