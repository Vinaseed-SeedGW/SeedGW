import { redirect } from 'next/navigation';
import { DEFAULT_LANDING_PATH } from '@dms/contracts/auth';

export default function HomePage() {
  redirect(DEFAULT_LANDING_PATH);
}
