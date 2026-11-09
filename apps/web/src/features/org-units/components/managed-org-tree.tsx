'use client';

import dynamic from 'next/dynamic';
import { createContext, use, useCallback, useMemo, useState } from 'react';
import { MAX_ORG_DEPTH, buildOrgTree, checkOrgUnitMove } from '@dms/contracts/org-tree';
import type { ManagerOption, OrgUnitRow } from '@dms/contracts/org-units';
import { TreeView } from '@dms/ui/tree-view';
import { OrgNodeList, type OrgNode } from '@/features/org-units/components/org-tree';
import type { OrgPanel } from '@/features/org-units/components/org-unit-panel';

// Form va Zod chi tai khi can thao tac.
const OrgUnitPanel = dynamic(
  () => import('@/features/org-units/components/org-unit-panel').then((m) => m.OrgUnitPanel),
  { ssr: false },
);

function preloadPanel() {
  void import('@/features/org-units/components/org-unit-panel');
}

const OpenPanelContext = createContext<((panel: OrgPanel) => void) | null>(null);

const ACTION_CLASS = 'text-sm text-brand';

function ManagedRowActions({ node }: { node: OrgNode }) {
  const open = use(OpenPanelContext);
  const isRoot = node.parentId === null;

  return (
    <>
      {node.depth < MAX_ORG_DEPTH ? (
        <button
          type="button"
          className={ACTION_CLASS}
          onPointerEnter={preloadPanel}
          onFocus={preloadPanel}
          onClick={() => open?.({ type: 'create', parent: node })}
        >
          Thêm cấp dưới
        </button>
      ) : null}
      <button
        type="button"
        className={ACTION_CLASS}
        onPointerEnter={preloadPanel}
        onFocus={preloadPanel}
        onClick={() => open?.({ type: 'edit', unit: node })}
      >
        Sửa
      </button>
      {isRoot ? null : (
        <>
          <button
            type="button"
            className={ACTION_CLASS}
            onPointerEnter={preloadPanel}
            onFocus={preloadPanel}
            onClick={() => open?.({ type: 'move', unit: node })}
          >
            Chuyển
          </button>
          <button
            type="button"
            className="text-sm text-danger"
            onPointerEnter={preloadPanel}
            onFocus={preloadPanel}
            onClick={() => open?.({ type: 'delete', unit: node })}
          >
            Xoá
          </button>
        </>
      )}
    </>
  );
}

type ManagedOrgTreeProps = {
  units: OrgUnitRow[];
  managerOptions: ManagerOption[];
};

export function ManagedOrgTree({ units, managerOptions }: ManagedOrgTreeProps) {
  const [panel, setPanel] = useState<OrgPanel | null>(null);
  const roots = useMemo(() => buildOrgTree(units), [units]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  const canDrag = useCallback((id: string) => unitsById.get(id)?.parentId !== null, [unitsById]);
  const canDrop = useCallback(
    (draggedId: string, targetId: string) => checkOrgUnitMove(units, draggedId, targetId).ok,
    [units],
  );
  const handleDrop = useCallback(
    (draggedId: string, targetId: string) => {
      const unit = unitsById.get(draggedId);
      const target = unitsById.get(targetId);
      if (unit && target) setPanel({ type: 'confirm-move', unit, target });
    },
    [unitsById],
  );

  return (
    <OpenPanelContext value={setPanel}>
      <TreeView.Root canDrag={canDrag} canDrop={canDrop} onDrop={handleDrop}>
        <OrgNodeList
          nodes={roots}
          RowActions={ManagedRowActions}
          dragHandle={<TreeView.DragHandle />}
        />
      </TreeView.Root>
      {panel ? (
        <OrgUnitPanel
          panel={panel}
          units={units}
          managerOptions={managerOptions}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </OpenPanelContext>
  );
}
