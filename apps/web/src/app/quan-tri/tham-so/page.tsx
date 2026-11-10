import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CodeSequenceForm } from '@/features/settings/components/code-sequence-form';
import { SettingsReadOnly } from '@/features/settings/components/settings-read-only';
import { SystemSettingsForm } from '@/features/settings/components/system-settings-form';
import { can, requirePermission } from '@/server/auth/can';
import { getSettingsOverview } from '@/server/queries/settings';

export const metadata: Metadata = { title: 'Tham số' };

export default async function SettingsPage() {
  const user = await requirePermission('admin.setting.read');

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Tham số</h1>
      <p className="mt-1 text-text-muted">Áp dụng chung cho toàn công ty.</p>
      <div className="mt-4 max-w-3xl">
        <Suspense fallback={<p className="text-text-muted">Đang tải tham số...</p>}>
          {can(user, 'admin.setting.manage') ? <EditorResults /> : <ReadOnlyResults />}
        </Suspense>
      </div>
    </>
  );
}

async function EditorResults() {
  const { settings, codeSequence } = await getSettingsOverview();
  // Dat lai form sau moi lan luu de gia tri moc so sanh khop du lieu moi tu may chu.
  return (
    <>
      <SystemSettingsForm key={settings.updatedAt} settings={settings} />
      <div className="mt-4">
        <CodeSequenceForm key={codeSequence.updatedAt} sequence={codeSequence} />
      </div>
    </>
  );
}

async function ReadOnlyResults() {
  return <SettingsReadOnly overview={await getSettingsOverview()} />;
}
