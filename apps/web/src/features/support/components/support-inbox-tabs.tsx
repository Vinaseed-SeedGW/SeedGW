import Link from 'next/link';
import {
  SUPPORT_INBOX_VIEW_LABEL,
  supportInboxView,
  supportInboxViewSlug,
  type SupportInboxView,
} from '@seedgw/contracts/support';

/** Nhóm yêu cầu ở Quản trị › Hỗ trợ, thêm tab Thống kê (T4). */
export function SupportInboxTabs({ active }: { active: SupportInboxView | 'STATS' }) {
  const tabs = [
    ...supportInboxView.options.map((view) => ({
      key: view,
      label: SUPPORT_INBOX_VIEW_LABEL[view],
      href: `/quan-tri/ho-tro?xem=${supportInboxViewSlug(view)}`,
    })),
    { key: 'STATS' as const, label: 'Thống kê', href: '/quan-tri/ho-tro/thong-ke' },
  ];
  return (
    <nav aria-label="Nhóm yêu cầu" className="mt-4 flex flex-wrap gap-2 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={`-mb-px border-b-2 px-3 py-2 font-bold ${tab.key === active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
