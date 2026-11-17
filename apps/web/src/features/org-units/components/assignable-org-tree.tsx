'use client';

import dynamic from 'next/dynamic';
import { createContext, use, useMemo, useState } from 'react';
import { buildOrgTree } from '@dms/contracts/org-tree';
import type { OrgUnitAssignScope, OrgUnitRow } from '@dms/contracts/org-units';
import { TreeView } from '@dms/ui/tree-view';
import { OrgNodeList, type OrgNode } from '@/features/org-units/components/org-tree';

// Form va Zod chi tai khi can thao tac.
const AssignManagerSheet = dynamic(
  () =>
    import('@/features/org-units/components/assign-manager-sheet').then(
      (m) => m.AssignManagerSheet,
    ),
  { ssr: false },
);

function preloadSheet() {
  void import('@/features/org-units/components/assign-manager-sheet');
}

type AssignContextValue = {
  assignable: ReadonlySet<string> | null;
  open: (unit: OrgUnitRow) => void;
};

const AssignContext = createContext<AssignContextValue | null>(null);

function AssignRowAction({ node }: { node: OrgNode }) {
  const context = use(AssignContext);
  if (!context || (context.assignable && !context.assignable.has(node.id))) return null;

  return (
    <button
      type="button"
      className="text-sm text-brand"
      onPointerEnter={preloadSheet}
      onFocus={preloadSheet}
      onClick={() => context.open(node)}
    >
      Trưởng đơn vị, kiểu tuyến
    </button>
  );
}

type AssignableOrgTreeProps = { units: OrgUnitRow[]; scope: OrgUnitAssignScope };

export function AssignableOrgTree({ units, scope }: AssignableOrgTreeProps) {
  const [editing, setEditing] = useState<OrgUnitRow | null>(null);
  const roots = useMemo(() => buildOrgTree(units), [units]);
  const value = useMemo<AssignContextValue>(
    () => ({
      assignable: scope.assignableUnitIds ? new Set(scope.assignableUnitIds) : null,
      open: setEditing,
    }),
    [scope.assignableUnitIds],
  );

  return (
    <AssignContext value={value}>
      <TreeView.Root>
        <OrgNodeList nodes={roots} RowActions={AssignRowAction} />
      </TreeView.Root>
      {editing ? (
        <AssignManagerSheet
          unit={editing}
          managerOptions={scope.managerOptions}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </AssignContext>
  );
}
