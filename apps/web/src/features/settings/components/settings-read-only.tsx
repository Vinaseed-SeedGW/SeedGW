import { formatNumber } from '@seedgw/contracts/format';
import {
  SETTING_GROUPS,
  formatSequenceCode,
  type SettingsOverview,
} from '@seedgw/contracts/settings';
import { CodeSequenceStatus } from '@/features/settings/components/code-sequence-status';
import { SettingsSection } from '@/features/settings/components/settings-section';
import { APP_NAME } from '@seedgw/config/brand';

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SettingsReadOnly({ overview }: { overview: SettingsOverview }) {
  const { settings, codeSequence } = overview;
  const code = (value: number) =>
    formatSequenceCode(codeSequence.prefix, codeSequence.digits, value);

  return (
    <>
      {SETTING_GROUPS.map((group) => (
        <SettingsSection key={group.title} title={group.title}>
          <dl className="grid gap-3.5 sm:grid-cols-2">
            {group.settings.map((setting) => (
              <ReadOnlyValue
                key={setting.key}
                label={setting.label}
                value={formatNumber(settings.values[setting.key])}
              />
            ))}
          </dl>
        </SettingsSection>
      ))}
      <SettingsSection title={`Dải mã khách hàng của ${APP_NAME}`}>
        <CodeSequenceStatus sequence={codeSequence} />
        <dl className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <ReadOnlyValue label="Mã đầu dải" value={code(codeSequence.rangeStart)} />
          <ReadOnlyValue label="Mã cuối dải" value={code(codeSequence.rangeEnd)} />
        </dl>
      </SettingsSection>
    </>
  );
}
