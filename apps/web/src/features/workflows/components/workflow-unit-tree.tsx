'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { buildOrgTree, orgLevelLabel, type OrgTreeNode } from '@dms/contracts/org-tree';
import type { WorkflowUnitRow } from '@dms/contracts/workflows';
import { TreeView } from '@dms/ui/tree-view';

type UnitNode = OrgTreeNode<WorkflowUnitRow>;

function sourceText(node: UnitNode): string {
  switch (node.source) {
    case 'OWN':
      return `Quy trình riêng, phiên bản ${node.version}, ${node.stepCount} bước`;
    case 'INHERITED':
      return `Kế thừa từ ${node.sourceUnitName}, ${node.stepCount} bước`;
    case 'NONE':
      return 'Chưa có quy trình';
  }
}

function UnitItem({ node }: { node: UnitNode }) {
  return (
    <TreeView.Item id={node.id}>
      <TreeView.Row>
        {node.children.length > 0 ? (
          <TreeView.Toggle label={node.name} />
        ) : (
          <TreeView.ToggleSpacer />
        )}
        <Link href={`/quan-tri/quy-trinh-duyet/${node.id}`} className="font-bold text-brand">
          {node.name}
        </Link>
        <span className="text-sm text-text-muted">{node.code}</span>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">
          {orgLevelLabel(node.depth)}
        </span>
        <span
          className={node.source === 'NONE' ? 'text-sm text-warning' : 'text-sm text-text-muted'}
        >
          {sourceText(node)}
        </span>
      </TreeView.Row>
      {node.children.length > 0 ? (
        <TreeView.Group>
          {node.children.map((child) => (
            <UnitItem key={child.id} node={child} />
          ))}
        </TreeView.Group>
      ) : null}
    </TreeView.Item>
  );
}

export function WorkflowUnitTree({ units }: { units: WorkflowUnitRow[] }) {
  const roots = useMemo(() => buildOrgTree(units), [units]);

  if (roots.length === 0) return <p className="text-text-muted">Chưa có đơn vị nào.</p>;
  return (
    <TreeView.Root>
      {roots.map((node) => (
        <UnitItem key={node.id} node={node} />
      ))}
    </TreeView.Root>
  );
}
