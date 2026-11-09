import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from './auth';

export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return session.user;
});
