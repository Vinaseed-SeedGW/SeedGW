'use client';

import { SectionError } from '@/features/shell/components/section-error';

export default function QuanTriError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SectionError error={error} reset={reset} />;
}
