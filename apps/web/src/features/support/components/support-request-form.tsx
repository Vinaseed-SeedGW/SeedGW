'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import {
  SUPPORT_SEVERITY_LABEL,
  SUPPORT_TYPE_LABEL,
  supportRequestForm,
  supportSeverity,
  supportType,
  type SupportRequestForm,
} from '@dms/contracts/support';
import { Form } from '@dms/ui/form';
import { createSupportRequestAction } from '@/server/actions/support';
import { AttachmentField, useAttachmentPicker } from './support-thread';

const TYPE_OPTIONS = supportType.options.map((value) => ({
  value,
  label: SUPPORT_TYPE_LABEL[value],
}));
const SEVERITY_OPTIONS = supportSeverity.options.map((value) => ({
  value,
  label: SUPPORT_SEVERITY_LABEL[value],
}));

/** Tạo yêu cầu trong khung nút nổi. Tự gắn trang đang mở để quản trị biết lỗi ở đâu. */
export function SupportRequestFormCreate({ onCreated }: { onCreated: (code: string) => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const picker = useAttachmentPicker();
  const form = useForm<SupportRequestForm>({
    resolver: zodResolver(supportRequestForm),
    defaultValues: { type: 'QUESTION', severity: null, title: '', body: '' },
  });
  const type = useWatch({ control: form.control, name: 'type' });

  async function submit(values: SupportRequestForm) {
    const data = new FormData();
    data.set(
      'payload',
      JSON.stringify({
        clientId: crypto.randomUUID(),
        type: values.type,
        severity: values.severity ?? undefined,
        title: values.title,
        body: values.body,
        context: { page: `${pathname}${search ? `?${search}` : ''}`.slice(0, 300) },
      }),
    );
    for (const file of picker.state.files) data.append('files', file);
    const result = await createSupportRequestAction(data);
    if (result.ok) picker.actions.clear();
    return result;
  }

  return (
    <Form.Root
      form={form}
      action={submit}
      successMessage="Đã gửi yêu cầu hỗ trợ"
      onSuccess={(data) => onCreated(data.code)}
    >
      <Form.Field name="type" label="Loại yêu cầu">
        <Form.ChoiceSelect options={TYPE_OPTIONS} />
      </Form.Field>
      {type === 'BUG' ? (
        <Form.Field
          name="severity"
          label="Mức độ"
          hint="Chặn công việc: không làm tiếp được. Ảnh hưởng: làm được nhưng chậm hoặc sai một phần."
        >
          <Form.Select options={SEVERITY_OPTIONS} emptyLabel="Chọn mức độ" />
        </Form.Field>
      ) : null}
      <Form.Field name="title" label="Tiêu đề">
        <Form.Input maxLength={120} />
      </Form.Field>
      <Form.Field
        name="body"
        label="Nội dung"
        hint="Mô tả việc đang làm, bạn thấy gì, mong muốn gì."
      >
        <Form.Textarea maxLength={4000} onPaste={picker.meta.onPaste} />
      </Form.Field>
      <AttachmentField picker={picker} inputId="support-create-files" />
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Gửi yêu cầu</Form.Submit>
      </Form.Actions>
    </Form.Root>
  );
}
