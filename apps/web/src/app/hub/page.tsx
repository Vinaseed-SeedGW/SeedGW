import Link from 'next/link';
import { DEPARTMENTS } from '@dms/contracts/departments';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { requireUser } from '@/server/auth/current-user';

export default async function HubPage() {
  const user = await requireUser();

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: 16 }}>
      <h1>Xin chào, {user.fullName}</h1>
      <p>Chọn bộ phận để bắt đầu làm việc</p>
      <ul>
        {DEPARTMENTS.map((department) => (
          <li key={department.slug}>
            <Link href={`/${department.slug}`}>
              <b>{department.name}</b>
            </Link>
            <p>{department.description}</p>
          </li>
        ))}
      </ul>
      <LogoutButton />
    </main>
  );
}
