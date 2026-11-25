import 'server-only';
import { auditChanges } from '@seedgw/contracts/audit';
import type { MobileLoginInput, MobileProfile, MobileSession } from '@seedgw/contracts/check-ins';
import { db } from '@seedgw/db/client';
import {
  hashRefreshToken,
  MobileAuthError,
  type MobileUser,
  newRefreshToken,
  signAccessToken,
} from '@/server/auth/mobile';
import { writeAudit } from '@/server/services/audit';
import { checkCredentials } from '@/server/services/credentials';
import { isIpBlocked, recordIpFailure } from '@/server/services/login-rate-limit';
import { readSettingValue } from '@/server/services/settings';

const REFRESH_TOKEN_TTL_DAYS = 30;

async function issueSession(
  user: { id: string; employeeCode: string; fullName: string; sessionVersion: number },
  deviceId: string,
): Promise<MobileSession> {
  const access = signAccessToken({ sub: user.id, did: deviceId, sv: user.sessionVersion });
  const refresh = newRefreshToken();
  const now = new Date();
  const [, orgUnit] = await Promise.all([
    db.mobileRefreshToken.create({
      data: {
        userId: user.id,
        deviceId,
        tokenHash: refresh.hash,
        sessionVersion: user.sessionVersion,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    }),
    db.user.findUnique({ where: { id: user.id }, select: { orgUnit: { select: { name: true } } } }),
    db.mobileDevice.update({ where: { id: deviceId }, data: { lastSeenAt: now } }),
  ]);
  return {
    accessToken: access.token,
    accessExpiresAt: access.expiresAt.toISOString(),
    refreshToken: refresh.token,
    user: {
      id: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      orgUnitName: orgUnit?.orgUnit?.name ?? null,
    },
  };
}

type DeviceOutcome = { deviceId: string; status: 'ACTIVE' | 'PENDING'; registered: boolean };

/**
 * Mặc định (25/11/2026) đăng nhập đúng mật khẩu trên máy nào cũng dùng được ngay, không giới hạn
 * số máy; máy bị thu hồi đăng nhập lại cũng dùng được. Khi bật tham số Duyệt máy mới thì theo
 * quyết định 13/11/2026: máy đầu tiên dùng ngay, máy khác chờ quản trị duyệt ở trang Tài khoản.
 */
async function resolveDevice(
  userId: string,
  device: MobileLoginInput['device'],
): Promise<DeviceOutcome> {
  const approvalRequired = (await readSettingValue('mobileDeviceApprovalRequired')) === 1;
  return db.$transaction(async (tx) => {
    // Khoá dòng nhân viên để hai lần đăng nhập cùng lúc không cùng thành máy đầu tiên.
    await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const existing = await tx.mobileDevice.findUnique({
      where: { userId_deviceKey: { userId, deviceKey: device.key } },
      select: { id: true, status: true },
    });
    if (existing?.status === 'ACTIVE') {
      return { deviceId: existing.id, status: 'ACTIVE', registered: false };
    }
    const hasActive =
      approvalRequired &&
      (await tx.mobileDevice.count({ where: { userId, status: 'ACTIVE' } })) > 0;
    const now = new Date();
    const data = hasActive
      ? { status: 'PENDING' as const, revokedAt: null }
      : { status: 'ACTIVE' as const, approvedAt: now, revokedAt: null };
    const saved = existing
      ? await tx.mobileDevice.update({
          where: { id: existing.id },
          data: { ...data, name: device.name, platform: device.platform },
          select: { id: true, status: true },
        })
      : await tx.mobileDevice.create({
          data: {
            userId,
            deviceKey: device.key,
            name: device.name,
            platform: device.platform,
            ...data,
          },
          select: { id: true, status: true },
        });
    return {
      deviceId: saved.id,
      status: saved.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
      registered: !existing || existing.status !== saved.status,
    };
  });
}

export async function loginMobile(
  input: MobileLoginInput,
  ip: string | null,
): Promise<MobileSession> {
  if (await isIpBlocked(ip)) {
    throw new MobileAuthError('LOCKED', 'Máy này nhập sai quá nhiều lần, thử lại sau 15 phút');
  }
  const result = await checkCredentials(input.employeeCode, input.password);
  if (result.status === 'invalid') await recordIpFailure(ip);
  if (result.status === 'locked') {
    throw new MobileAuthError('LOCKED', 'Tài khoản tạm khoá do nhập sai nhiều lần, thử lại sau');
  }
  if (result.status === 'invalid') {
    throw new MobileAuthError('INVALID_CREDENTIALS', 'Mã nhân viên hoặc mật khẩu không đúng');
  }
  const flags = await db.user.findUnique({
    where: { id: result.user.id },
    select: { mustChangePassword: true },
  });
  if (flags?.mustChangePassword) {
    throw new MobileAuthError(
      'MUST_CHANGE_PASSWORD',
      'Cần đổi mật khẩu trên web trước khi đăng nhập app',
    );
  }

  const device = await resolveDevice(result.user.id, input.device);
  if (device.registered) {
    await writeAudit({
      actor: { id: result.user.id, impersonator: null },
      action: 'user.device-register',
      entityType: 'User',
      entityId: result.user.id,
      entityLabel: result.user.employeeCode,
      changes: auditChanges(
        {},
        {
          device: `${input.device.name}: ${device.status === 'ACTIVE' ? 'dùng ngay' : 'chờ duyệt'}`,
        },
      ),
      ip,
    });
  }
  if (device.status === 'PENDING') {
    throw new MobileAuthError(
      'DEVICE_PENDING',
      'Tài khoản đang dùng trên một máy khác. Nhờ quản trị duyệt máy này ở Quản trị, Tài khoản, mục Thiết bị trên web; máy cũ sẽ tự bị thu hồi.',
    );
  }
  return issueSession(result.user, device.deviceId);
}

/** Đổi refresh token cũ lấy cặp khoá mới. Token cũ bị thu hồi ngay để không dùng lại được. */
export async function refreshMobile(refreshToken: string): Promise<MobileSession> {
  const now = new Date();
  const row = await db.mobileRefreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      sessionVersion: true,
      device: { select: { id: true, status: true } },
      user: {
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          isActive: true,
          sessionVersion: true,
        },
      },
    },
  });
  if (!row || row.revokedAt || row.expiresAt <= now) {
    throw new MobileAuthError('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn, đăng nhập lại');
  }
  const revoked = await db.mobileRefreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: now },
  });
  // Hai yêu cầu làm mới cùng lúc: chỉ một yêu cầu được cấp khoá mới.
  if (revoked.count === 0) {
    throw new MobileAuthError('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn, đăng nhập lại');
  }
  if (!row.user.isActive || row.user.sessionVersion !== row.sessionVersion) {
    throw new MobileAuthError('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn, đăng nhập lại');
  }
  if (row.device.status !== 'ACTIVE') {
    throw new MobileAuthError('DEVICE_REVOKED', 'Thiết bị này đã bị thu hồi');
  }
  return issueSession(row.user, row.device.id);
}

export async function logoutMobile(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await db.mobileRefreshToken.findFirst({
    where: { tokenHash },
    select: { userId: true, deviceId: true },
  });
  await db.mobileRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  // M7: máy đăng xuất thì không nhận thông báo của người vừa đăng xuất nữa.
  if (session) {
    await db.pushToken.deleteMany({
      where: { userId: session.userId, deviceId: session.deviceId },
    });
  }
}

export async function getMobileProfile(user: MobileUser): Promise<MobileProfile> {
  const orgUnit = user.orgUnitId
    ? await db.orgUnit.findUnique({ where: { id: user.orgUnitId }, select: { name: true } })
    : null;
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    orgUnitName: orgUnit?.name ?? null,
  };
}
