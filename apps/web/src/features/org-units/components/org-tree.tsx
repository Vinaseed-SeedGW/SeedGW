'use client';

import { useMemo, type ComponentType, type ReactNode } from 'react';
import { buildOrgTree, orgLevelLabel, type OrgTreeNode } from '@seedgw/contracts/org-tree';
import type { OrgUnitRow } from '@seedgw/contracts/org-units';
import { TreeView } from '@seedgw/ui/tree-view';

export type OrgNode = OrgTreeNode<OrgUnitRow>;

type NodeSlots = {
  RowActions?: ComponentType<{ node: OrgNode }>;
  dragHandle?: ReactNode;
};

function OrgNodeItem({ node, RowActions, dragHandle }: NodeSlots & { node: OrgNode }) {
  const isRoot = node.parentId === null;

  return (
    <TreeView.Item id={node.id}>
      <TreeView.Row>
        {isRoot ? null : dragHandle}
        {node.children.length > 0 ? (
          <TreeView.Toggle label={node.name} />
        ) : (
          <TreeView.ToggleSpacer />
        )}
        <span className="font-bold">{node.name}</span>
        <span className="text-sm text-text-muted">{node.code}</span>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">
          {orgLevelLabel(node.depth)}
        </span>
        <span className="text-sm text-text-muted">
          {node.managerName ? `Trưởng đơn vị: ${node.managerName}` : 'Chưa có trưởng đơn vị'}
        </span>
        <span className="text-sm text-text-muted">{node.memberCount} nhân viên</span>
        {RowActions ? (
          <span className="ml-auto flex flex-wrap gap-3">
            <RowActions node={node} />
          </span>
        ) : null}
      </TreeView.Row>
      {node.children.length > 0 ? (
        <TreeView.Group>
          <OrgNodeList nodes={node.children} RowActions={RowActions} dragHandle={dragHandle} />
        </TreeView.Group>
      ) : null}
    </TreeView.Item>
  );
}

export function OrgNodeList({ nodes, RowActions, dragHandle }: NodeSlots & { nodes: OrgNode[] }) {
  return nodes.map((node) => (
    <OrgNodeItem key={node.id} node={node} RowActions={RowActions} dragHandle={dragHandle} />
  ));
}

export function OrgTreeReadOnly({ units }: { units: OrgUnitRow[] }) {
  const roots = useMemo(() => buildOrgTree(units), [units]);
  return (
    <TreeView.Root>
      <OrgNodeList nodes={roots} />
    </TreeView.Root>
  );
}
