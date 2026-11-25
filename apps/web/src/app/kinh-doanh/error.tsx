'use client';

import { SectionError } from '@/features/shell/components/section-error';

export default function KinhDoanhError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SectionError error={error} reset={reset} />;
}
