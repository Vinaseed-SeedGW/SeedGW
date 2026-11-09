import { signOut } from '@/server/auth/auth';

export async function GET() {
  await signOut({ redirectTo: '/login' });
}
