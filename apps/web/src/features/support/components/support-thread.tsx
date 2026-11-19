'use client';

import { FileText, Paperclip, X } from 'lucide-react';
import { useRef, useState, useTransition, type ClipboardEvent } from 'react';
import { formatDateTime } from '@seedgw/contracts/format';
import type { SupportDetail } from '@seedgw/contracts/support';
import {
  formatFileSize,
  SUPPORT_FILE_ACCEPT,
  SUPPORT_FILE_RULE_TEXT,
  SUPPORT_MAX_FILES_PER_MESSAGE,
} from '@seedgw/contracts/support-files';
import { cn } from '@seedgw/ui/cn';
import { useToast } from '@seedgw/ui/toast';
import { replySupportAction } from '@/server/actions/support';

// Khung trao đổi dùng chung cho nút nổi Hỗ trợ và trang Quản trị › Hỗ trợ (IA §7, SupportThread).

type Entry =
  | { kind: 'message'; at: string; message: SupportDetail['messages'][number] }
  | { kind: 'event'; at: string; event: SupportDetail['events'][number] };

function entriesOf(detail: SupportDetail): Entry[] {
  const entries: Entry[] = [
    ...detail.messages.map((message) => ({
      kind: 'message' as const,
      at: message.createdAt,
      message,
    })),
    // Sự kiện Gửi yêu cầu trùng tin đầu tiên nên không hiện thêm.
    ...detail.events
      .filter((event) => event.kind !== 'CREATE')
      .map((event) => ({ kind: 'event' as const, at: event.createdAt, event })),
  ];
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

function Attachments({ files }: { files: SupportDetail['messages'][number]['attachments'] }) {
  if (files.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((file) =>
        file.isImage && file.url ? (
          <a
            key={file.id}
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-md border border-border"
            title={file.fileName}
          >
            {/* Ảnh lấy từ link có hạn của kho tệp nên không dùng next/image. */}
            <img src={file.url} alt={file.fileName} className="h-24 w-32 object-cover" />
          </a>
        ) : (
          <a
            key={file.id}
            href={file.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-brand-soft"
          >
            <FileText size={16} aria-hidden />
            <span className="truncate">{file.fileName}</span>
            <span className="text-text-muted">{formatFileSize(file.sizeBytes)}</span>
          </a>
        ),
      )}
    </div>
  );
}

function Messages({ detail }: { detail: SupportDetail }) {
  if (detail.purged) {
    return <p className="text-text-muted">Nội dung và tệp đã tự xoá sau 18 tháng.</p>;
  }
  return (
    <ol className="grid gap-3" aria-label="Trao đổi">
      {entriesOf(detail).map((entry) =>
        entry.kind === 'event' ? (
          <li key={entry.event.id} className="text-center text-sm text-text-muted">
            {entry.event.actorName ? `${entry.event.actorName}: ` : ''}
            {entry.event.text}, {formatDateTime(entry.event.createdAt)}
          </li>
        ) : (
          <li
            key={entry.message.id}
            className={cn(
              'max-w-[90%] rounded-md px-3 py-2',
              entry.message.isMine
                ? 'ml-auto bg-brand-soft'
                : 'mr-auto border border-border bg-surface',
            )}
          >
            <p className="text-sm text-text-muted">
              <span className="font-bold text-text">{entry.message.authorName}</span>
              {entry.message.fromRequester ? '' : ', quản trị'},{' '}
              {formatDateTime(entry.message.createdAt)}
            </p>
            {entry.message.body ? (
              <p className="mt-1 break-words whitespace-pre-wrap">{entry.message.body}</p>
            ) : null}
            <Attachments files={entry.message.attachments} />
          </li>
        ),
      )}
    </ol>
  );
}

/** Ô chọn tệp và dán ảnh chụp màn hình; dùng ở form tạo yêu cầu và ô trả lời. */
export function useAttachmentPicker() {
  const [files, setFiles] = useState<File[]>([]);
  const add = (incoming: readonly File[]) =>
    setFiles((current) => [...current, ...incoming].slice(0, SUPPORT_MAX_FILES_PER_MESSAGE));
  const onPaste = (event: ClipboardEvent) => {
    const pasted = [...event.clipboardData.files].filter((file) => file.type.startsWith('image/'));
    if (pasted.length === 0) return;
    event.preventDefault();
    add(
      pasted.map(
        (file, index) =>
          new File(
            [file],
            file.name && file.name !== 'image.png'
              ? file.name
              : `anh-chup-${Date.now()}-${index}.png`,
            {
              type: file.type,
            },
          ),
      ),
    );
  };
  return {
    state: { files },
    actions: {
      add,
      remove: (index: number) => setFiles((current) => current.filter((_, i) => i !== index)),
      clear: () => setFiles([]),
    },
    meta: { onPaste },
  };
}

type Picker = ReturnType<typeof useAttachmentPicker>;

export function AttachmentField({ picker, inputId }: { picker: Picker; inputId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = picker.state.files.length >= SUPPORT_MAX_FILES_PER_MESSAGE;
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={full}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60"
        >
          <Paperclip size={16} aria-hidden />
          Đính kèm tệp
        </button>
        <span id={`${inputId}-hint`} className="text-sm text-text-muted">
          {SUPPORT_FILE_RULE_TEXT} Có thể dán ảnh chụp màn hình vào ô nội dung.
        </span>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={SUPPORT_FILE_ACCEPT}
        className="sr-only"
        aria-describedby={`${inputId}-hint`}
        onChange={(event) => {
          picker.actions.add([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
      {picker.state.files.length > 0 ? (
        <ul className="mt-2 grid gap-1" aria-label="Tệp sẽ gửi">
          {picker.state.files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm">
              <FileText size={16} aria-hidden />
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="text-text-muted">{formatFileSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Bỏ tệp ${file.name}`}
                onClick={() => picker.actions.remove(index)}
                className="text-text-muted hover:text-danger"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Composer({ code, onSent }: { code: string; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const picker = useAttachmentPicker();
  const { actions: toast } = useToast();
  const inputId = `support-reply-${code}`;

  function send() {
    setError(null);
    if (!body.trim() && picker.state.files.length === 0) {
      setError('Nhập nội dung hoặc đính kèm tệp');
      return;
    }
    const form = new FormData();
    form.set('payload', JSON.stringify({ code, clientId: crypto.randomUUID(), body }));
    for (const file of picker.state.files) form.append('files', file);
    startTransition(async () => {
      const result = await replySupportAction(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody('');
      picker.actions.clear();
      result.warnings?.forEach(({ message }) => toast.show({ tone: 'warning', message }));
      onSent();
    });
  }

  return (
    <form
      className="border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor={`${inputId}-body`} className="block text-sm font-bold">
        Trả lời
      </label>
      <textarea
        id={`${inputId}-body`}
        value={body}
        maxLength={4000}
        onChange={(event) => setBody(event.target.value)}
        onPaste={picker.meta.onPaste}
        aria-invalid={Boolean(error)}
        className="mt-1 min-h-24 w-full rounded-md border border-input bg-surface px-2.5 py-2"
      />
      <AttachmentField picker={picker} inputId={`${inputId}-files`} />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="mt-3 h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70"
      >
        {isPending ? 'Đang gửi...' : 'Gửi'}
      </button>
    </form>
  );
}

export const SupportThread = { Messages, Composer };

/** Trang máy chủ không đọc được thuộc tính của đối tượng xuất từ file client, nên xuất riêng. */
export { Messages as SupportThreadMessages };
