import { formatNumber } from '@dms/contracts/format';
import {
  formatSequenceCode,
  issuedCodeCount,
  type CodeSequenceView,
} from '@dms/contracts/settings';

export function CodeSequenceStatus({ sequence }: { sequence: CodeSequenceView }) {
  const remaining = sequence.rangeEnd - sequence.nextValue + 1;
  const nextCode = formatSequenceCode(sequence.prefix, sequence.digits, sequence.nextValue);

  return (
    <p className="rounded-md bg-brand-soft px-3 py-2">
      Đã cấp {formatNumber(issuedCodeCount(sequence))} mã. Mã tiếp theo là <b>{nextCode}</b>, còn{' '}
      {formatNumber(remaining)} mã trong dải.
    </p>
  );
}
