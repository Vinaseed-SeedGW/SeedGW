'use client';

import { createContext, use, type ComponentType } from 'react';
import type { DataScope } from '@dms/contracts/access';
import {
  DATA_SCOPE_LABEL,
  DATA_SCOPE_OPTIONS,
  PERMISSION_GROUPS,
  type RoleMatrixRole,
} from '@dms/contracts/roles';
import { cn } from '@dms/ui/cn';

export type RoleDraft = { dataScope: DataScope; codes: ReadonlySet<string> };
export type RoleDrafts = ReadonlyMap<string, RoleDraft>;

export type RoleMatrixContextValue = {
  state: { drafts: RoleDrafts };
  actions: {
    togglePermission: (roleId: string, code: string) => void;
    setDataScope: (roleId: string, scope: DataScope) => void;
  };
  meta: {
    roles: readonly RoleMatrixRole[];
    scopeLockReason: (role: RoleMatrixRole) => string | null;
    cellLockReason: (role: RoleMatrixRole, code: string) => string | null;
  };
};

const RoleMatrixContext = createContext<RoleMatrixContextValue | null>(null);

function useRoleMatrix(): RoleMatrixContextValue {
  const value = use(RoleMatrixContext);
  if (!value) throw new Error('Component nay phai nam trong RoleMatrix.Provider.');
  return value;
}

export function draftsFromRoles(roles: readonly RoleMatrixRole[]): RoleDrafts {
  return new Map(
    roles.map((role) => [
      role.id,
      { dataScope: role.dataScope, codes: new Set(role.permissionCodes) },
    ]),
  );
}

const STICKY_COLUMN = 'sticky left-0 z-10 bg-surface';
const CELL_BORDER = 'border-b border-l border-border';

type ColumnActions = ComponentType<{ role: RoleMatrixRole }>;

function RoleHeader({ role, Actions }: { role: RoleMatrixRole; Actions?: ColumnActions }) {
  return (
    <th scope="col" className={cn(CELL_BORDER, 'min-w-40 bg-surface p-2 text-left align-top')}>
      <span className="block font-bold">{role.name}</span>
      <span className="block text-sm font-normal text-text-muted">{role.userCount} người</span>
      {Actions ? <Actions role={role} /> : null}
    </th>
  );
}

function ScopeCell({ role }: { role: RoleMatrixRole }) {
  const { state, actions, meta } = useRoleMatrix();
  const scope = state.drafts.get(role.id)?.dataScope ?? role.dataScope;
  const lockReason = meta.scopeLockReason(role);

  return (
    <td className={cn(CELL_BORDER, 'bg-surface p-2 align-top')}>
      {lockReason ? (
        <span className="text-sm" title={lockReason}>
          {DATA_SCOPE_LABEL[scope]}
        </span>
      ) : (
        <select
          aria-label={`Phạm vi dữ liệu của ${role.name}`}
          className="h-9.5 w-full rounded-md border border-input bg-surface px-1 text-sm"
          value={scope}
          onChange={(event) => actions.setDataScope(role.id, event.target.value as DataScope)}
        >
          {DATA_SCOPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </td>
  );
}

type Permission = (typeof PERMISSION_GROUPS)[number]['permissions'][number];

function PermissionCell({ role, permission }: { role: RoleMatrixRole; permission: Permission }) {
  const { state, actions, meta } = useRoleMatrix();
  const lockReason = meta.cellLockReason(role, permission.code);
  const checked = state.drafts.get(role.id)?.codes.has(permission.code) ?? false;

  return (
    <td className={cn(CELL_BORDER, 'text-center')}>
      <label
        title={lockReason ?? undefined}
        className={cn(
          'flex items-center justify-center p-2',
          lockReason ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <input
          type="checkbox"
          className="size-4 accent-brand disabled:opacity-60"
          aria-label={`${permission.name} cho ${role.name}`}
          checked={checked}
          disabled={lockReason !== null}
          onChange={() => actions.togglePermission(role.id, permission.code)}
        />
      </label>
    </td>
  );
}

function Table({ ColumnActions }: { ColumnActions?: ColumnActions }) {
  const { meta } = useRoleMatrix();

  return (
    <div className="isolate max-h-[70vh] overflow-auto rounded-md border border-border bg-surface">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-20">
          <tr>
            <th
              scope="col"
              className={cn(
                STICKY_COLUMN,
                'min-w-40 border-b border-border p-2 text-left md:min-w-60',
              )}
            >
              Quyền
            </th>
            {meta.roles.map((role) => (
              <RoleHeader key={role.id} role={role} Actions={ColumnActions} />
            ))}
          </tr>
          <tr>
            <th scope="row" className={cn(STICKY_COLUMN, 'border-b border-border p-2 text-left')}>
              Phạm vi dữ liệu
            </th>
            {meta.roles.map((role) => (
              <ScopeCell key={role.id} role={role} />
            ))}
          </tr>
        </thead>
        {PERMISSION_GROUPS.map((group) => (
          <tbody key={group.label}>
            <tr>
              <th
                scope="colgroup"
                colSpan={meta.roles.length + 1}
                className="border-b border-border bg-brand-soft p-2 text-left font-bold text-brand"
              >
                <span className="sticky left-2">{group.label}</span>
              </th>
            </tr>
            {group.permissions.map((permission) => (
              <tr key={permission.code}>
                <th
                  scope="row"
                  className={cn(
                    STICKY_COLUMN,
                    'border-b border-border p-2 text-left text-sm font-normal',
                  )}
                >
                  {permission.name}
                </th>
                {meta.roles.map((role) => (
                  <PermissionCell key={role.id} role={role} permission={permission} />
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export const RoleMatrix = { Provider: RoleMatrixContext, Table };
