import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

type Props = {
  /** Phần trăm thay đổi so với mốc; null khi mốc bằng 0, không so được. */
  change: number | null;
  children: ReactNode;
};

/**
 * Dòng so sánh trên thẻ chỉ số: biểu tượng tăng, giảm kèm chữ, không chỉ dựa vào màu (D7).
 * Màu xanh cho tăng, đỏ cho giảm; chữ "tăng", "giảm" vẫn có trong nội dung cho người không phân biệt màu.
 */
export function Delta({ change, children }: Props) {
  const Icon = change === null || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-start gap-1.5',
        change !== null && change > 0 && 'text-brand',
        change !== null && change < 0 && 'text-danger',
      )}
    >
      <Icon size={16} className="mt-0.5 flex-none" aria-hidden />
      <span>{children}</span>
    </span>
  );
}
