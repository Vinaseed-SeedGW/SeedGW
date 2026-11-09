import { redirect } from 'next/navigation';
import { signOut } from '@/server/auth/auth';
import { getCurrentUser } from '@/server/auth/current-user';

export async function GET() {
  // Chi xoa phien khi tai khoan da mat hieu luc, tranh bi dang xuat qua mot link la.
  if (await getCurrentUser()) redirect('/hub');
  await signOut({ redirectTo: '/login' });
}
