'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { buildOrgTree, orgLevelLabel, type OrgTreeNode } from '@dms/contracts/org-tree';
import type { WorkflowUnitRow } from '@dms/contracts/workflows';
import { TreeView } from '@dms/ui/tree-view';

type UnitNode = OrgTreeNode<WorkflowUnitRow>;

const BADGE_CLASS = 'rounded-full px-2 py-0.5 text-xs font-bold';

function SourceLabel({ node }: { node: UnitNode }) {
  switch (node.source) {
    case 'OWN':
      return (
        <>
          <span className={`${BADGE_CLASS} bg-brand text-primary-foreground`}>Quy trình riêng</span>
          <span className="text-sm text-text-muted">
            Phiên bản {node.version}, {node.stepCount} bước
          </span>
        </>
      );
    case 'INHERITED':
      return (
        <span className="text-sm text-text-muted">
          Kế thừa từ {node.sourceUnitName}, {node.stepCount} bước
        </span>
      );
    case 'NONE':
      return <span className={`${BADGE_CLASS} bg-warning-soft text-text`}>Chưa có quy trình</span>;
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
        <SourceLabel node={node} />
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
