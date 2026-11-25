import 'server-only';
import { recordError } from '@seedgw/db/error-log';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { widestDataScope, type DataScope, type PermissionCode } from '@seedgw/contracts/access';
import type { MobileAuthReason } from '@seedgw/contracts/check-ins';
import type { ErrorCode } from '@seedgw/contracts/common';
import { db } from '@seedgw/db/client';
import { getOrgUnitTreeIds, getTeamUserIds } from '@seedgw/db/org-units';
import { scopedDb } from '@seedgw/db/scoped-client';
import { DomainError } from '@/server/services/domain-error';

// Khoá truy cập ngắn hạn cho app (JWT ký HMAC-SHA256), tự viết để không thêm thư viện.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export type MobileUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  orgUnitId: string | null;
  deviceId: string;
  dataScope: DataScope;
  permissions: ReadonlySet<string>;
};

type AccessClaims = { sub: string; did: string; sv: number; exp: number };

export class MobileAuthError extends Error {
  constructor(
    readonly reason: MobileAuthReason,
    message: string,
  ) {
    super(message);
  }
}

function signingKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Thiếu AUTH_SECRET');
  // Tách khoá ký của app khỏi khoá phiên web dù dùng chung một bí mật gốc.
  return createHmac('sha256', secret).update('seedgw-mobile-access-v1').digest();
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

export function signAccessToken(claims: Omit<AccessClaims, 'exp'>, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ ...claims, exp }));
  const signature = createHmac('sha256', signingKey())
    .update(`${header}.${payload}`)
    .digest('base64url');
  return { token: `${header}.${payload}.${signature}`, expiresAt: new Date(exp * 1000) };
}

export function verifyAccessToken(token: string, now = Date.now()): AccessClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac('sha256', signingKey()).update(`${header}.${payload}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessClaims;
    if (typeof claims.sub !== 'string' || typeof claims.did !== 'string') return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Kiểm tra khoá của app ở đầu mỗi Route Handler. Đọc lại tài khoản và thiết bị mỗi lần gọi
 * để khoá tài khoản hoặc thu hồi thiết bị trên web có hiệu lực ngay.
 */
export async function requireMobileUser(request: Request): Promise<MobileUser> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims) throw new MobileAuthError('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn');

  const [user, device] = await Promise.all([
    db.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        orgUnitId: true,
        isActive: true,
        sessionVersion: true,
        roles: {
          select: {
            role: { select: { dataScope: true, permissions: { select: { code: true } } } },
          },
        },
      },
    }),
    db.mobileDevice.findUnique({
      where: { id: claims.did },
      select: { userId: true, status: true },
    }),
  ]);
  if (!user || !user.isActive || user.sessionVersion !== claims.sv) {
    throw new MobileAuthError('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn, đăng nhập lại');
  }
  if (!device || device.userId !== user.id || device.status !== 'ACTIVE') {
    throw new MobileAuthError('DEVICE_REVOKED', 'Thiết bị này đã bị thu hồi');
  }

  return {
    id: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    orgUnitId: user.orgUnitId,
    deviceId: claims.did,
    dataScope: widestDataScope(user.roles.map(({ role }) => role.dataScope)),
    permissions: new Set(user.roles.flatMap(({ role }) => role.permissions.map((p) => p.code))),
  };
}

/** Client database áp phạm vi dữ liệu của người dùng app, giống getScopedDb() bên web. */
export async function mobileScopedDb(user: MobileUser) {
  const needsTree = user.dataScope === 'ORG_UNIT_TREE' && user.orgUnitId !== null;
  return scopedDb({
    dataScope: user.dataScope,
    userId: user.id,
    orgUnitId: user.orgUnitId,
    orgUnitTreeIds: needsTree && user.orgUnitId ? await getOrgUnitTreeIds(user.orgUnitId) : [],
    teamUserIds: user.dataScope === 'TEAM' ? await getTeamUserIds(user.id) : [],
  });
}

export function assertMobileCan(
  user: MobileUser,
  permission: PermissionCode,
  message = 'Tài khoản chưa được cấp quyền check-in trên app',
): void {
  if (!user.permissions.has(permission)) throw new DomainError('FORBIDDEN', message);
}

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  INTEGRATION: 502,
  INTERNAL: 500,
};

export function mobileError(code: ErrorCode, message: string, details?: unknown): NextResponse {
  return NextResponse.json(details === undefined ? { code, message } : { code, message, details }, {
    status: HTTP_STATUS[code],
  });
}

/** Bọc Route Handler của app: đổi lỗi ra JSON {code, message}, không lộ chi tiết bên trong. */
export function mobileRoute<TContext>(
  handler: (request: Request, context: TContext) => Promise<Response>,
) {
  return async (request: Request, context: TContext): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof MobileAuthError) {
        return mobileError('UNAUTHENTICATED', error.message, { reason: error.reason });
      }
      if (error instanceof DomainError) return mobileError(error.code, error.message);
      console.error('Lỗi API app', error);
      void recordError({
        source: 'WEB_SERVER',
        error,
        path: new URL(request.url).pathname,
        context: { kind: 'mobile-api', method: request.method },
      });
      return mobileError('INTERNAL', 'Máy chủ đang lỗi, app sẽ tự gửi lại sau');
    }
  };
}
