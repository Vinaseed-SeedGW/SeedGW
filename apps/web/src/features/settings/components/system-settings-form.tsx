'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  SETTING_GROUPS,
  saveSystemSettingsInput,
  type SaveSystemSettingsInput,
  type SystemSettingsView,
} from '@seedgw/contracts/settings';
import { Form } from '@seedgw/ui/form';
import { SettingsSection } from '@/features/settings/components/settings-section';
import { saveSystemSettingsAction } from '@/server/actions/settings';

export function SystemSettingsForm({ settings }: { settings: SystemSettingsView }) {
  const form = useForm<SaveSystemSettingsInput>({
    resolver: zodResolver(saveSystemSettingsInput),
    defaultValues: { ...settings.values, expectedUpdatedAt: settings.updatedAt },
  });

  return (
    <Form.Root form={form} action={saveSystemSettingsAction} successMessage="Đã lưu tham số">
      {SETTING_GROUPS.map((group) => (
        <SettingsSection key={group.title} title={group.title}>
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            {group.settings.map((setting) => (
              <div key={setting.key}>
                <Form.Field
                  name={setting.key}
                  label={setting.label}
                  hint={'hint' in setting ? setting.hint : undefined}
                >
                  <Form.Input
                    type="number"
                    inputMode="numeric"
                    min={setting.min}
                    max={setting.max}
                  />
                </Form.Field>
              </div>
            ))}
          </div>
        </SettingsSection>
      ))}
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Lưu tham số</Form.Submit>
      </Form.Actions>
    </Form.Root>
  );
}
