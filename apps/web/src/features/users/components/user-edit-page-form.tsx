'use client';

import Link from 'next/link';
import type { UserEditValues } from '@dms/contracts/users';
import { UserEditForm } from '@/features/users/components/user-edit-form';

export function UserEditPageForm({ user }: { user: UserEditValues }) {
  return (
    <UserEditForm user={user}>
      <Link href="/quan-tri/tai-khoan" className="px-2 text-brand">
        Về danh sách
      </Link>
    </UserEditForm>
  );
}
