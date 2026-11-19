'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type Control } from 'react-hook-form';
import {
  CODE_SEQUENCE_LIMITS,
  formatSequenceCode,
  issuedCodeCount,
  saveCodeSequenceInput,
  type CodeSequenceView,
  type SaveCodeSequenceInput,
} from '@dms/contracts/settings';
import { Form } from '@dms/ui/form';
import { CodeSequenceStatus } from '@/features/settings/components/code-sequence-status';
import { SettingsSection } from '@/features/settings/components/settings-section';
import { saveCodeSequenceAction } from '@/server/actions/settings';
import { APP_NAME } from '@dms/config/brand';

const ISSUED_HINT = 'Đã cấp mã nên không đổi được.';
const LOCKED_INPUT = 'bg-surface-subtle';

function CodeRangePreview({ control }: { control: Control<SaveCodeSequenceInput> }) {
  const [prefix, digits, rangeStart, rangeEnd] = useWatch({
    control,
    name: ['prefix', 'digits', 'rangeStart', 'rangeEnd'],
  });
  const code = (value: number) =>
    formatSequenceCode(prefix.trim().toUpperCase(), Number(digits), Number(value));

  return (
    <p className="mt-3.5 text-sm text-text-muted">
      Dải mã sẽ chạy từ <b>{code(rangeStart)}</b> đến <b>{code(rangeEnd)}</b>.
    </p>
  );
}

export function CodeSequenceForm({ sequence }: { sequence: CodeSequenceView }) {
  const isIssued = issuedCodeCount(sequence) > 0;
  const form = useForm<SaveCodeSequenceInput>({
    resolver: zodResolver(saveCodeSequenceInput),
    defaultValues: {
      expectedUpdatedAt: sequence.updatedAt,
      prefix: sequence.prefix,
      digits: sequence.digits,
      rangeStart: sequence.rangeStart,
      rangeEnd: sequence.rangeEnd,
    },
  });
  const lockHint = isIssued ? ISSUED_HINT : undefined;
  const lockClass = isIssued ? LOCKED_INPUT : undefined;

  return (
    <Form.Root form={form} action={saveCodeSequenceAction} successMessage="Đã lưu dải mã">
      <SettingsSection title={`Dải mã khách hàng của ${APP_NAME}`}>
        <CodeSequenceStatus sequence={sequence} />
        <div className="mt-3.5 grid items-start gap-3.5 sm:grid-cols-2">
          <div>
            <Form.Field name="prefix" label="Tiền tố" hint={lockHint}>
              <Form.Input readOnly={isIssued} className={lockClass} />
            </Form.Field>
          </div>
          <div>
            <Form.Field name="digits" label="Số chữ số" hint={lockHint}>
              <Form.Input
                type="number"
                inputMode="numeric"
                min={CODE_SEQUENCE_LIMITS.minDigits}
                max={CODE_SEQUENCE_LIMITS.maxDigits}
                readOnly={isIssued}
                className={lockClass}
              />
            </Form.Field>
          </div>
          <div>
            <Form.Field name="rangeStart" label="Số đầu dải" hint={lockHint}>
              <Form.Input
                type="number"
                inputMode="numeric"
                min={1}
                readOnly={isIssued}
                className={lockClass}
              />
            </Form.Field>
          </div>
          <div>
            <Form.Field name="rangeEnd" label="Số cuối dải">
              <Form.Input type="number" inputMode="numeric" min={1} />
            </Form.Field>
          </div>
        </div>
        <CodeRangePreview control={form.control} />
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Lưu dải mã</Form.Submit>
        </Form.Actions>
      </SettingsSection>
    </Form.Root>
  );
}
