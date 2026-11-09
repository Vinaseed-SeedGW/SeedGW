'use client';

import { SectionError } from '@/features/shell/components/section-error';

export default function QuanTriError({ reset }: { reset: () => void }) {
  return <SectionError reset={reset} />;
}
