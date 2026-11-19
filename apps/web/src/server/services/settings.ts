import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import {
  DEALER_CODE_SEQUENCE_KEY,
  issuedCodeCount,
  resolveSystemSettings,
  type CodeSequenceView,
  type SaveCodeSequenceInput,
  type SaveSystemSettingsInput,
  type SystemSettingsView,
} from '@dms/contracts/settings';
import { db } from '@dms/db/client';
import { DomainError } from '@/server/services/domain-error';
import { APP_NAME } from '@dms/config/brand';

export type SettingOutcome = { id: string; label: string; changes: AuditChanges };

const GENERAL_SETTINGS_KEY = 'general';
const STALE_FORM_MESSAGE = 'Dữ liệu vừa được người khác sửa, vui lòng tải lại trang';

const SETTING_ROW_SELECT = {
  id: true,
  value: true,
  updatedAt: true,
} satisfies Prisma.SystemSettingSelect;

const CODE_SEQUENCE_SELECT = {
  id: true,
  prefix: true,
  digits: true,
  rangeStart: true,
  rangeEnd: true,
  nextValue: true,
  updatedAt: true,
} satisfies Prisma.CodeSequenceSelect;

function readGeneralRow() {
  return db.systemSetting.findUniqueOrThrow({
    where: { key: GENERAL_SETTINGS_KEY },
    select: SETTING_ROW_SELECT,
  });
}

function readDealerSequenceRow() {
  return db.codeSequence.findUniqueOrThrow({
    where: { key: DEALER_CODE_SEQUENCE_KEY },
    select: CODE_SEQUENCE_SELECT,
  });
}

export async function readSystemSettings(): Promise<SystemSettingsView> {
  const row = await readGeneralRow();
  return { values: resolveSystemSettings(row.value), updatedAt: row.updatedAt.toISOString() };
}

export async function readDealerCodeSequence(): Promise<CodeSequenceView> {
  const row = await readDealerSequenceRow();
  return {
    prefix: row.prefix,
    digits: row.digits,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    nextValue: row.nextValue,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveSystemSettings(input: SaveSystemSettingsInput): Promise<SettingOutcome> {
  const { expectedUpdatedAt, ...next } = input;
  const current = await readGeneralRow();
  const changes = auditChanges(resolveSystemSettings(current.value), next);
  const outcome = { id: current.id, label: 'Tham số hệ thống', changes };
  if (Object.keys(changes).length === 0) return outcome;

  // So thoi diem cap nhat de hai nguoi cung sua khong ghi de len nhau.
  const { count } = await db.systemSetting.updateMany({
    where: { key: GENERAL_SETTINGS_KEY, updatedAt: new Date(expectedUpdatedAt) },
    data: { value: next, updatedAt: new Date() },
  });
  if (count === 0) throw new DomainError('CONFLICT', STALE_FORM_MESSAGE);
  return outcome;
}

type DealerSequenceRow = Awaited<ReturnType<typeof readDealerSequenceRow>>;

// Ma da cap van ton tai tren FAST nen phan da dung cua dai khong duoc doi nua.
function assertIssuedRangeKept(current: DealerSequenceRow, next: SaveCodeSequenceInput): void {
  const isFormatChanged =
    next.prefix !== current.prefix ||
    next.digits !== current.digits ||
    next.rangeStart !== current.rangeStart;
  if (isFormatChanged) {
    throw new DomainError(
      'CONFLICT',
      'Dải đã cấp mã nên không đổi được tiền tố, số chữ số và số đầu dải',
    );
  }

  const lastIssued = current.nextValue - 1;
  if (next.rangeEnd < lastIssued) {
    const message = `Số cuối dải không được nhỏ hơn ${lastIssued} vì đã cấp mã đến số này`;
    throw new DomainError('CONFLICT', message, { rangeEnd: message });
  }
}

export async function saveDealerCodeSequence(
  input: SaveCodeSequenceInput,
): Promise<SettingOutcome> {
  const { expectedUpdatedAt, ...next } = input;
  const current = await readDealerSequenceRow();
  const isIssued = issuedCodeCount(current) > 0;
  if (isIssued) assertIssuedRangeKept(current, input);

  const changes = auditChanges(
    {
      prefix: current.prefix,
      digits: current.digits,
      rangeStart: current.rangeStart,
      rangeEnd: current.rangeEnd,
    },
    next,
  );
  const outcome = { id: current.id, label: `Dải mã khách hàng của ${APP_NAME}`, changes };
  if (Object.keys(changes).length === 0) return outcome;

  const { count } = await db.codeSequence.updateMany({
    where: { key: DEALER_CODE_SEQUENCE_KEY, updatedAt: new Date(expectedUpdatedAt) },
    data: {
      ...next,
      nextValue: isIssued ? current.nextValue : next.rangeStart,
      updatedAt: new Date(),
    },
  });
  if (count === 0) throw new DomainError('CONFLICT', STALE_FORM_MESSAGE);
  return outcome;
}
