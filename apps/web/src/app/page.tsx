import { redirect } from 'next/navigation';
import { DEFAULT_LANDING_PATH } from '@dms/contracts/landing';

export default function HomePage() {
  redirect(DEFAULT_LANDING_PATH);
}
