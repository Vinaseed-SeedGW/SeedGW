import { z } from 'zod';
import {
  PERMISSIONS,
  RESERVED_PERMISSIONS,
  ROLE_PRESETS,
  SYSTEM_ROLE_CODE,
  dataScope,
  type DataScope,
  type PermissionCode,
} from './access';

export const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  OWN: 'Của mình',
  ORG_UNIT: 'Đơn vị',
  ORG_UNIT_TREE: 'Đơn vị và cấp dưới',
  ALL: 'Toàn công ty',
};

export const DATA_SCOPE_OPTIONS = dataScope.options.map((value) => ({
  value,
  label: DATA_SCOPE_LABEL[value],
}));

const PERMISSION_GROUP_DEFINITIONS = [
  { label: 'Điều hành', prefix: 'executive.' },
  { label: 'Kinh doanh', prefix: 'sales.' },
  { label: 'Trao đổi', prefix: 'support.' },
  { label: 'Quản trị', prefix: 'admin.' },
] as const;

export const PERMISSION_GROUPS = PERMISSION_GROUP_DEFINITIONS.map(({ label, prefix }) => ({
  label,
  permissions: PERMISSIONS.filter((permission) => permission.code.startsWith(prefix)),
}));

const permissionCode = z.enum(
  PERMISSIONS.map((permission) => permission.code) as [PermissionCode, ...PermissionCode[]],
);

const roleDataScope = z.enum(dataScope.options, { error: 'Vui lòng chọn phạm vi dữ liệu' });

export const createRoleInput = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, 'Mã gồm 2-40 ký tự: chữ không dấu, số hoặc gạch ngang'),
  name: z
    .string()
    .trim()
    .min(2, 'Tên vai trò cần ít nhất 2 ký tự')
    .max(60, 'Tên vai trò tối đa 60 ký tự'),
  dataScope: roleDataScope,
});
export type CreateRoleInput = z.infer<typeof createRoleInput>;

export const saveRoleMatrixInput = z.object({
  roles: z
    .array(
      z.object({
        id: z.uuid(),
        expectedUpdatedAt: z.iso.datetime(),
        dataScope: roleDataScope,
        permissionCodes: z.array(permissionCode).max(PERMISSIONS.length),
      }),
    )
    .min(1, 'Chưa có thay đổi nào để lưu')
    .max(100),
});
export type SaveRoleMatrixInput = z.infer<typeof saveRoleMatrixInput>;

export const deleteRoleInput = z.object({ id: z.uuid() });

export type RoleMatrixRole = {
  id: string;
  code: string;
  name: string;
  dataScope: DataScope;
  permissionCodes: string[];
  userCount: number;
  updatedAt: string;
  lockReason: string | null;
  canDelete: boolean;
};

export function roleLockReason(roleCode: string, heldByActor: boolean): string | null {
  if (roleCode === SYSTEM_ROLE_CODE) return 'Vai trò này luôn có đủ quyền';
  if (heldByActor) return 'Bạn đang giữ vai trò này nên không sửa được';
  return null;
}

export function isPermissionReserved(code: string): boolean {
  return (RESERVED_PERMISSIONS as readonly string[]).includes(code);
}

export function isPresetRole(code: string): boolean {
  return ROLE_PRESETS.some((preset) => preset.code === code);
}

export function diffPermissionCodes(
  before: readonly string[],
  after: readonly string[],
): { added: string[]; removed: string[] } {
  const previous = new Set(before);
  const next = new Set(after);
  return {
    added: [...next].filter((code) => !previous.has(code)),
    removed: [...previous].filter((code) => !next.has(code)),
  };
}
