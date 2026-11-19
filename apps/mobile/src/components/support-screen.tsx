import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {
  SUPPORT_SEVERITY_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_TYPE_LABEL,
  supportRequestForm,
  supportSeverity,
  supportType,
  type SupportContext,
  type SupportDetail,
  type SupportSeverity,
  type SupportStatus,
  type SupportSummary,
  type SupportType,
} from '@dms/contracts/support';
import { freshAccessToken } from '../api/client';
import { API_URL, newId } from '../api/session';
import { listMySupport, readSupport, reopenSupport, supportFilePath } from '../api/support';
import { getDeviceModel } from '../sync/device-integrity';
import { formatVnDate, formatVnTime } from '../sync/geo';
import {
  codeOfLocalRequest,
  discardPendingSupport,
  listPendingSupport,
  queueSupportMessage,
  queueSupportRequest,
  syncSupportOutbox,
  type PendingSupportItem,
} from '../sync/support-outbox';
import { forgetScreen, recentScreen, type ScreenShot } from '../sync/support-screenshot';
import { COLORS, FONT, SPACE } from '../theme';
import { BackBar } from './back-bar';
import { Button } from './button';
import { Text, TextInput } from './text';

// Màn hình Hỗ trợ trên app (T3), mở từ tab Tôi: yêu cầu của tôi, tạo yêu cầu, trao đổi.
// Mọi thứ soạn ra vào hàng đợi trên máy trước, có mạng mới gửi, nên mất mạng vẫn soạn được.

const POLL_MS = 30_000;

/** Điền sẵn khi mở từ nút Báo lỗi này. */
export type SupportPrefill = {
  title: string;
  body: string;
  context: SupportContext;
  screenshot: ScreenShot | null;
};

type View_ =
  | { name: 'list' }
  | { name: 'create' }
  | { name: 'detail'; code: string | null; requestClientId: string };

function when(at: number | string): string {
  const time = typeof at === 'string' ? Date.parse(at) : at;
  return `${formatVnTime(time).slice(0, 5)} ${formatVnDate(time)}`;
}

// Không import thẳng expo-device: bản cài iPhone 17/11 chưa có phần native, import thẳng làm bản cập nhật lỗi lúc mở.
function appContext(screen: string | undefined, device: string | undefined): SupportContext {
  const runtime = Updates.runtimeVersion ?? 'chạy thử';
  return {
    appVersion: Updates.updateId ? `${runtime}, cập nhật ${Updates.updateId.slice(0, 8)}` : runtime,
    platform:
      Platform.OS === 'ios'
        ? `iOS ${String(Platform.Version)}`
        : `Android ${String(Platform.Version)}`,
    device,
    screen,
  };
}

const STATUS_TONE: Record<SupportStatus, { backgroundColor: string; color: string }> = {
  NEW: { backgroundColor: COLORS.warningSoft, color: COLORS.text },
  IN_PROGRESS: { backgroundColor: COLORS.brandSoft, color: COLORS.brand },
  WAITING_REQUESTER: { backgroundColor: COLORS.surfaceSubtle, color: COLORS.text },
  DONE: { backgroundColor: COLORS.brand, color: COLORS.onBrand },
  CLOSED: { backgroundColor: COLORS.surfaceSubtle, color: COLORS.textMuted },
};

function StatusTag({ status }: { status: SupportStatus | 'PENDING' }) {
  const tone =
    status === 'PENDING'
      ? { backgroundColor: COLORS.warningSoft, color: COLORS.text }
      : STATUS_TONE[status];
  return (
    <Text style={[styles.tag, { backgroundColor: tone.backgroundColor, color: tone.color }]}>
      {status === 'PENDING' ? 'Chờ gửi' : SUPPORT_STATUS_LABEL[status]}
    </Text>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.choice, selected && styles.choiceSelected]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TYPE_OPTIONS = supportType.options.map((value) => ({
  value,
  label: SUPPORT_TYPE_LABEL[value],
}));
const SEVERITY_OPTIONS = supportSeverity.options.map((value) => ({
  value,
  label: SUPPORT_SEVERITY_LABEL[value],
}));

function ScreenshotToggle({
  shot,
  attached,
  onChange,
}: {
  shot: ScreenShot;
  attached: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.shotRow}>
      <Image
        source={{ uri: `data:image/jpeg;base64,${shot.base64}` }}
        style={styles.shotThumb}
        accessibilityIgnoresInvertColors
        accessibilityLabel={`Ảnh màn hình ${shot.screen}`}
      />
      <View style={styles.flex}>
        <Text style={styles.body}>Đính kèm ảnh màn hình {shot.screen} vừa xem</Text>
        <Text style={styles.muted}>Chỉ gửi khi bạn bật.</Text>
      </View>
      <Switch
        value={attached}
        onValueChange={onChange}
        accessibilityLabel="Đính kèm ảnh màn hình"
      />
    </View>
  );
}

function CreateForm({
  prefill,
  onCreated,
}: {
  prefill: SupportPrefill | null;
  onCreated: (requestClientId: string) => void;
}) {
  const [type, setType] = useState<SupportType>(prefill ? 'BUG' : 'QUESTION');
  const [severity, setSeverity] = useState<SupportSeverity | null>(prefill ? 'MAJOR' : null);
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [body, setBody] = useState(prefill?.body ?? '');
  const shot = prefill?.screenshot ?? recentScreen();
  const [attach, setAttach] = useState(Boolean(prefill?.screenshot));
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit() {
    const parsed = supportRequestForm.safeParse({ type, severity, title, body });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    const files =
      attach && shot
        ? [{ clientId: newId(), fileName: `man-hinh-${shot.screen}.jpg`, base64: shot.base64 }]
        : [];
    const requestClientId = queueSupportRequest({
      type: parsed.data.type,
      severity: parsed.data.severity,
      title: parsed.data.title,
      body: parsed.data.body,
      context: {
        ...(prefill?.context ?? {}),
        ...appContext(prefill?.context.screen ?? shot?.screen, await getDeviceModel()),
      },
      files,
    });
    forgetScreen();
    void syncSupportOutbox();
    onCreated(requestClientId);
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Loại yêu cầu</Text>
      <Choice options={TYPE_OPTIONS} value={type} onChange={setType} label="Loại yêu cầu" />
      {type === 'BUG' ? (
        <>
          <Text style={styles.label}>Mức độ</Text>
          <Choice
            options={SEVERITY_OPTIONS}
            value={severity}
            onChange={setSeverity}
            label="Mức độ"
          />
          {errors.severity ? <Text style={styles.error}>{errors.severity}</Text> : null}
        </>
      ) : null}
      <Text style={styles.label}>Tiêu đề</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        accessibilityLabel="Tiêu đề"
        style={styles.input}
      />
      {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}
      <Text style={styles.label}>Nội dung</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={4000}
        accessibilityLabel="Nội dung"
        placeholder="Bạn đang làm gì, thấy gì, mong muốn gì"
        style={[styles.input, styles.multiline]}
      />
      {errors.body ? <Text style={styles.error}>{errors.body}</Text> : null}
      {shot ? <ScreenshotToggle shot={shot} attached={attach} onChange={setAttach} /> : null}
      <Text style={styles.muted}>
        App tự gửi kèm phiên bản app và loại máy để quản trị dễ kiểm tra.
      </Text>
      <View style={styles.actions}>
        <Button label="Gửi yêu cầu" onPress={() => void submit()} />
      </View>
    </View>
  );
}

function RemoteImage({ id, name }: { id: string; name: string }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void freshAccessToken().then((value) => {
      if (!cancelled) setToken(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!token) return null;
  return (
    <Image
      source={{
        uri: `${API_URL}${supportFilePath(id)}`,
        headers: { authorization: `Bearer ${token}` },
      }}
      style={styles.attachImage}
      resizeMode="cover"
      accessibilityLabel={name}
      accessibilityIgnoresInvertColors
    />
  );
}

function Thread({ detail }: { detail: SupportDetail }) {
  if (detail.purged) return <Text style={styles.muted}>Nội dung đã tự xoá sau 18 tháng.</Text>;
  const entries = [
    ...detail.messages.map((message) => ({ at: message.createdAt, message, event: null })),
    ...detail.events
      .filter((event) => event.kind !== 'CREATE')
      .map((event) => ({ at: event.createdAt, message: null, event })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <View style={styles.thread}>
      {entries.map((entry) =>
        entry.event ? (
          <Text key={entry.event.id} style={styles.event}>
            {entry.event.actorName ? `${entry.event.actorName}: ` : ''}
            {entry.event.text}, {when(entry.event.createdAt)}
          </Text>
        ) : entry.message ? (
          <View
            key={entry.message.id}
            style={[styles.bubble, entry.message.isMine ? styles.bubbleMine : styles.bubbleOther]}
          >
            <Text style={styles.muted}>
              {entry.message.authorName}
              {entry.message.fromRequester ? '' : ', quản trị'}, {when(entry.message.createdAt)}
            </Text>
            {entry.message.body ? <Text style={styles.body}>{entry.message.body}</Text> : null}
            {entry.message.attachments.map((file) =>
              file.isImage ? (
                <RemoteImage key={file.id} id={file.id} name={file.fileName} />
              ) : (
                <Text key={file.id} style={styles.muted}>
                  Tệp {file.fileName}
                </Text>
              ),
            )}
          </View>
        ) : null,
      )}
    </View>
  );
}

function Reply({
  code,
  requestClientId,
  onQueued,
}: {
  code: string | null;
  requestClientId: string;
  onQueued: () => void;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  function send() {
    if (!body.trim()) {
      setError('Nhập nội dung trả lời');
      return;
    }
    setError(null);
    queueSupportMessage({ code, requestClientId }, body.trim(), []);
    setBody('');
    void syncSupportOutbox().then(onQueued);
    onQueued();
  }
  return (
    <View style={styles.form}>
      <Text style={styles.label}>Trả lời</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={4000}
        accessibilityLabel="Nội dung trả lời"
        style={[styles.input, styles.multiline]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Gửi" onPress={send} />
      </View>
    </View>
  );
}

function PendingList({
  items,
  onDiscard,
}: {
  items: PendingSupportItem[];
  onDiscard: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.section}>Chờ gửi</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.pendingRow}>
          <Text style={styles.body}>
            {item.kind === 'REQUEST'
              ? `Yêu cầu: ${item.title ?? ''}`
              : `Tin: ${item.body || 'Tệp đính kèm'}`}
          </Text>
          <Text style={styles.muted}>
            {when(item.createdAt)}
            {item.fileCount > 0 ? `, ${item.fileCount} tệp` : ''}
          </Text>
          {item.failed ? (
            <>
              <Text style={styles.error}>Máy chủ không nhận: {item.failed}</Text>
              <Button label="Bỏ mục này" onPress={() => onDiscard(item.id)} variant="ghost" />
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Detail({
  target,
  onBack,
}: {
  target: { code: string | null; requestClientId: string };
  onBack: () => void;
}) {
  const [code, setCode] = useState(target.code ?? codeOfLocalRequest(target.requestClientId));
  const [detail, setDetail] = useState<SupportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSupportItem[]>([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const current = code ?? codeOfLocalRequest(target.requestClientId);
    if (current !== code) setCode(current);
    setPending(
      listPendingSupport().filter((item) => item.requestClientId === target.requestClientId),
    );
    if (!current) return;
    void readSupport(current).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDetail(result.data);
        setError(null);
      } else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [code, target.requestClientId, tick]);

  useEffect(() => {
    const timer = setInterval(() => {
      void syncSupportOutbox().then(reload);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  async function reopen() {
    if (!code) return;
    const result = await reopenSupport(code);
    if (result.ok) reload();
    else setError(result.message);
  }

  return (
    <View style={styles.fill}>
      <BackBar title={code ? `Yêu cầu ${code}` : 'Yêu cầu chờ gửi'} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!code ? (
          <Text style={styles.muted}>
            Yêu cầu đang chờ gửi lên máy chủ. Có mạng app tự gửi, không cần làm gì thêm.
          </Text>
        ) : null}
        {code && !detail && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {detail ? (
          <>
            <View style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.title}>{detail.title}</Text>
                <StatusTag status={detail.status} />
              </View>
              <Text style={styles.muted}>
                {SUPPORT_TYPE_LABEL[detail.type]}
                {detail.severity ? `, ${SUPPORT_SEVERITY_LABEL[detail.severity]}` : ''}
                {detail.assigneeName ? `, ${detail.assigneeName} đang xử lý` : ''}
              </Text>
            </View>
            <Thread detail={detail} />
          </>
        ) : null}
        <PendingList
          items={pending}
          onDiscard={(id) => {
            discardPendingSupport(id);
            reload();
          }}
        />
        {detail?.actions.canReopen ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Chưa ổn? Mở lại trong 7 ngày kể từ khi xong.</Text>
            <View style={styles.actions}>
              <Button label="Mở lại" onPress={() => void reopen()} variant="ghost" />
            </View>
          </View>
        ) : null}
        {!detail || detail.actions.canReply ? (
          <Reply code={code} requestClientId={target.requestClientId} onQueued={reload} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function RequestRow({ item, onOpen }: { item: SupportSummary; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{item.title}</Text>
        <StatusTag status={item.status} />
      </View>
      <Text style={styles.muted}>
        {item.code}, {SUPPORT_TYPE_LABEL[item.type]}, {when(item.lastActivityAt)}
      </Text>
      {item.unread ? <Text style={styles.newReply}>Có trả lời mới</Text> : null}
    </Pressable>
  );
}

export function SupportScreen({
  onClose,
  prefill,
  openCode,
}: {
  onClose: () => void;
  prefill: SupportPrefill | null;
  /** Mở thẳng yêu cầu này, ví dụ khi bấm thông báo Quản trị đã trả lời (M7). */
  openCode: string | null;
}) {
  const [view, setView] = useState<View_>(
    openCode
      ? { name: 'detail', code: openCode, requestClientId: openCode }
      : prefill
        ? { name: 'create' }
        : { name: 'list' },
  );
  const [list, setList] = useState<SupportSummary[] | null>(null);
  const [pending, setPending] = useState<PendingSupportItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (view.name !== 'list') return;
    let cancelled = false;
    setPending(listPendingSupport().filter((item) => item.kind === 'REQUEST' && !item.requestCode));
    void syncSupportOutbox().then(async () => {
      const result = await listMySupport();
      if (cancelled) return;
      setPending(
        listPendingSupport().filter((item) => item.kind === 'REQUEST' && !item.requestCode),
      );
      if (result.ok) {
        setList(result.data.items);
        setError(null);
      } else setError(result.message);
    });
    const timer = setInterval(() => setTick((value) => value + 1), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [view, tick]);

  if (view.name === 'detail') {
    return (
      <Detail
        target={{ code: view.code, requestClientId: view.requestClientId }}
        onBack={() => setView({ name: 'list' })}
      />
    );
  }

  if (view.name === 'create') {
    return (
      <View style={styles.fill}>
        <BackBar
          title="Gửi yêu cầu hỗ trợ"
          onBack={() => (prefill ? onClose() : setView({ name: 'list' }))}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <CreateForm
            prefill={prefill}
            onCreated={(requestClientId) =>
              setView({ name: 'detail', code: null, requestClientId })
            }
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <BackBar title="Hỗ trợ" onBack={onClose} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          Hỏi đáp, báo lỗi, góp ý gửi tới Quản trị đơn vị của bạn. Mất mạng vẫn soạn được, có mạng
          app tự gửi.
        </Text>
        <View style={styles.actions}>
          <Button label="Gửi yêu cầu mới" onPress={() => setView({ name: 'create' })} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {pending.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() =>
              setView({ name: 'detail', code: null, requestClientId: item.requestClientId })
            }
            style={styles.card}
          >
            <View style={styles.head}>
              <Text style={styles.title}>{item.title ?? ''}</Text>
              <StatusTag status="PENDING" />
            </View>
            <Text style={styles.muted}>Soạn lúc {when(item.createdAt)}</Text>
            {item.failed ? (
              <Text style={styles.error}>Máy chủ không nhận: {item.failed}</Text>
            ) : null}
          </Pressable>
        ))}
        {list === null && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {list && list.length === 0 && pending.length === 0 ? (
          <Text style={styles.muted}>Bạn chưa gửi yêu cầu nào.</Text>
        ) : null}
        {list?.map((item) => (
          <RequestRow
            key={item.code}
            item={item}
            onOpen={() => setView({ name: 'detail', code: item.code, requestClientId: item.code })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.xl * 2 },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
    backgroundColor: COLORS.surface,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  title: { flex: 1, fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  section: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  body: { fontSize: 15, color: COLORS.text },
  muted: { fontSize: 13, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
  newReply: { fontSize: 13, fontWeight: FONT.bold, color: COLORS.danger },
  tag: {
    fontSize: 12,
    fontWeight: FONT.bold,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  form: { gap: SPACE.sm },
  label: { fontSize: 14, fontWeight: FONT.bold, color: COLORS.text, marginTop: SPACE.sm },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 44,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  choice: {
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
  },
  choiceSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  choiceText: { fontSize: 15, color: COLORS.text },
  choiceTextSelected: { color: COLORS.brand, fontWeight: FONT.bold },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.sm },
  shotThumb: {
    width: 56,
    height: 100,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thread: { gap: SPACE.sm },
  event: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  bubble: { borderRadius: 8, padding: SPACE.md, gap: SPACE.xs, maxWidth: '92%' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: COLORS.brandSoft },
  bubbleOther: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  attachImage: {
    width: 200,
    height: 260,
    borderRadius: 4,
    marginTop: SPACE.xs,
    backgroundColor: COLORS.surfaceSubtle,
  },
  pendingRow: { gap: 2, paddingVertical: SPACE.xs },
});
