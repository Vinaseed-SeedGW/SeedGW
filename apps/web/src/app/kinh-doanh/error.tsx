'use client';

import { SectionError } from '@/features/shell/components/section-error';

export default function KinhDoanhError({ reset }: { reset: () => void }) {
  return <SectionError reset={reset} />;
}
