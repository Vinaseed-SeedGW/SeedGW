'use client';

import dynamic from 'next/dynamic';
import { createContext, use, useMemo, useState, useTransition } from 'react';
import type { DataScope } from '@dms/contracts/access';
import {
  diffPermissionCodes,
  isPermissionReserved,
  type RoleMatrixRole,
} from '@dms/contracts/roles';
import { useToast } from '@dms/ui/toast';
import type { RolePanelState } from '@/features/roles/components/role-panel';
import {
  RoleMatrix,
  draftsFromRoles,
  type RoleDraft,
  type RoleDrafts,
  type RoleMatrixContextValue,
} from '@/features/roles/components/role-matrix';
import { saveRoleMatrixAction } from '@/server/actions/roles';

// Form va Zod chi tai khi can thao tac.
const RolePanel = dynamic(
  () => import('@/features/roles/components/role-panel').then((m) => m.RolePanel),
  { ssr: false },
);

function preloadPanel() {
  void import('@/features/roles/components/role-panel');
}

const RESERVED_REASON = 'Quyền này chỉ dành cho vai trò Quản trị hệ thống';
const OUTLINE_BUTTON =
  'h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft disabled:opacity-70';
const PRIMARY_BUTTON =
  'h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70';

function isDraftChanged(role: RoleMatrixRole, draft: RoleDraft | undefined): boolean {
  if (!draft) return false;
  const { added, removed } = diffPermissionCodes(role.permissionCodes, [...draft.codes]);
  return draft.dataScope !== role.dataScope || added.length > 0 || removed.length > 0;
}

function updateDraft(
  drafts: RoleDrafts,
  roleId: string,
  change: (draft: RoleDraft) => RoleDraft,
): RoleDrafts {
  const draft = drafts.get(roleId);
  return draft ? new Map(drafts).set(roleId, change(draft)) : drafts;
}

type DeleteContextValue = { disabled: boolean; open: (role: RoleMatrixRole) => void };

const DeleteContext = createContext<DeleteContextValue | null>(null);

function DeleteRoleAction({ role }: { role: RoleMatrixRole }) {
  const context = use(DeleteContext);
  if (!context || !role.canDelete) return null;

  return (
    <button
      type="button"
      className="mt-1 text-sm font-normal text-danger disabled:opacity-60"
      disabled={context.disabled}
      onPointerEnter={preloadPanel}
      onFocus={preloadPanel}
      onClick={() => context.open(role)}
    >
      Xoá
    </button>
  );
}

export function RoleMatrixEditor({ roles }: { roles: RoleMatrixRole[] }) {
  const { actions: toast } = useToast();
  const [drafts, setDrafts] = useState(() => draftsFromRoles(roles));
  const [panel, setPanel] = useState<RolePanelState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changedRoles = roles.filter((role) => isDraftChanged(role, drafts.get(role.id)));
  const hasChanges = changedRoles.length > 0;

  const value = useMemo<RoleMatrixContextValue>(
    () => ({
      state: { drafts },
      actions: {
        togglePermission: (roleId, code) =>
          setDrafts((current) =>
            updateDraft(current, roleId, (draft) => {
              const codes = new Set(draft.codes);
              if (!codes.delete(code)) codes.add(code);
              return { ...draft, codes };
            }),
          ),
        setDataScope: (roleId, scope: DataScope) =>
          setDrafts((current) =>
            updateDraft(current, roleId, (draft) => ({ ...draft, dataScope: scope })),
          ),
      },
      meta: {
        roles,
        scopeLockReason: (role) => role.lockReason,
        cellLockReason: (role, code) =>
          role.lockReason ?? (isPermissionReserved(code) ? RESERVED_REASON : null),
      },
    }),
    [drafts, roles],
  );

  const deleteValue = useMemo<DeleteContextValue>(
    () => ({
      // Trang tai lai sau khi tao hoac xoa se lam mat cac o dang tick do.
      disabled: hasChanges,
      open: (role) => setPanel({ type: 'delete', role }),
    }),
    [hasChanges],
  );

  function save() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await saveRoleMatrixAction({
        roles: changedRoles.map((role) => ({
          id: role.id,
          expectedUpdatedAt: role.updatedAt,
          dataScope: drafts.get(role.id)?.dataScope ?? role.dataScope,
          permissionCodes: [...(drafts.get(role.id)?.codes ?? [])],
        })),
      });
      if (result.ok) toast.show({ tone: 'success', message: 'Đã lưu vai trò và quyền' });
      else setErrorMessage(result.message);
    });
  }

  return (
    <DeleteContext value={deleteValue}>
      <RoleMatrix.Provider value={value}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={OUTLINE_BUTTON}
            disabled={hasChanges}
            onPointerEnter={preloadPanel}
            onFocus={preloadPanel}
            onClick={() => setPanel({ type: 'create' })}
          >
            Tạo vai trò
          </button>
          {hasChanges ? (
            <span className="text-sm text-text-muted">Lưu hoặc bỏ thay đổi trước khi tạo, xoá</span>
          ) : null}
        </div>

        <RoleMatrix.Table ColumnActions={DeleteRoleAction} />

        {errorMessage ? (
          <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!hasChanges || isPending}
            onClick={save}
          >
            {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <button
            type="button"
            className={OUTLINE_BUTTON}
            disabled={!hasChanges || isPending}
            onClick={() => {
              setErrorMessage(null);
              setDrafts(draftsFromRoles(roles));
            }}
          >
            Bỏ thay đổi
          </button>
          <span className="text-text-muted">
            {hasChanges ? `${changedRoles.length} vai trò có thay đổi` : 'Chưa có thay đổi'}
          </span>
        </div>

        {panel ? <RolePanel panel={panel} onClose={() => setPanel(null)} /> : null}
      </RoleMatrix.Provider>
    </DeleteContext>
  );
}
