'use client';

import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { cn } from './cn';

type TreeContextValue = {
  state: {
    collapsedIds: ReadonlySet<string>;
    draggingId: string | null;
    dropTargetId: string | null;
  };
  actions: {
    toggle: (id: string) => void;
    startDrag: (id: string) => void;
    endDrag: () => void;
    setDropTarget: (id: string | null) => void;
    drop: (targetId: string) => void;
  };
  meta: {
    canDrag: (id: string) => boolean;
    canDrop: (draggedId: string, targetId: string) => boolean;
  };
};

const TreeContext = createContext<TreeContextValue | null>(null);
const ItemContext = createContext<string | null>(null);

function useTree(): TreeContextValue {
  const value = use(TreeContext);
  if (!value) throw new Error('Component nay phai nam trong TreeView.Root.');
  return value;
}

function useItemId(): string {
  const id = use(ItemContext);
  if (id === null) throw new Error('Component nay phai nam trong TreeView.Item.');
  return id;
}

const NEVER = () => false;
const NOOP = () => undefined;

type RootProps = {
  canDrag?: (id: string) => boolean;
  canDrop?: (draggedId: string, targetId: string) => boolean;
  onDrop?: (draggedId: string, targetId: string) => void;
  children: ReactNode;
};

function Root({ canDrag = NEVER, canDrop = NEVER, onDrop = NOOP, children }: RootProps) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const endDrag = useCallback(() => {
    setDraggingId(null);
    setDropTargetId(null);
  }, []);

  const drop = useCallback(
    (targetId: string) => {
      if (draggingId && canDrop(draggingId, targetId)) onDrop(draggingId, targetId);
      setDraggingId(null);
      setDropTargetId(null);
    },
    [draggingId, canDrop, onDrop],
  );

  const value = useMemo<TreeContextValue>(
    () => ({
      state: { collapsedIds, draggingId, dropTargetId },
      actions: { toggle, startDrag: setDraggingId, endDrag, setDropTarget: setDropTargetId, drop },
      meta: { canDrag, canDrop },
    }),
    [collapsedIds, draggingId, dropTargetId, toggle, endDrag, drop, canDrag, canDrop],
  );

  return (
    <TreeContext value={value}>
      <ul>{children}</ul>
    </TreeContext>
  );
}

function Item({ id, children }: { id: string; children: ReactNode }) {
  return (
    <ItemContext value={id}>
      <li>{children}</li>
    </ItemContext>
  );
}

function Row({ children }: { children: ReactNode }) {
  const id = useItemId();
  const { state, actions, meta } = useTree();
  const isDraggable = meta.canDrag(id);
  const isDropTarget = state.dropTargetId === id;

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!state.draggingId || !meta.canDrop(state.draggingId, id)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    actions.setDropTarget(id);
  }

  return (
    <div
      draggable={isDraggable}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        // Firefox chi bat dau keo khi co du lieu.
        event.dataTransfer.setData('text/plain', id);
        actions.startDrag(id);
      }}
      onDragEnd={actions.endDrag}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          actions.setDropTarget(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        actions.drop(id);
      }}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 hover:bg-surface-subtle',
        isDropTarget && 'bg-brand-soft outline-2 outline-brand',
        state.draggingId === id && 'opacity-50',
      )}
    >
      {children}
    </div>
  );
}

function DragHandle() {
  return (
    <span className="flex-none cursor-grab text-text-muted" aria-hidden>
      <GripVertical size={16} />
    </span>
  );
}

function Toggle({ label }: { label: string }) {
  const id = useItemId();
  const { state, actions } = useTree();
  const isCollapsed = state.collapsedIds.has(id);
  const Icon = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <button
      type="button"
      className="flex-none text-text-muted"
      aria-expanded={!isCollapsed}
      aria-label={`${isCollapsed ? 'Mở' : 'Thu gọn'} ${label}`}
      onClick={() => actions.toggle(id)}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}

function ToggleSpacer() {
  return <span className="w-4.5 flex-none" aria-hidden />;
}

function Group({ children }: { children: ReactNode }) {
  const id = useItemId();
  const { state } = useTree();
  if (state.collapsedIds.has(id)) return null;
  return <ul className="ml-4 border-l border-border pl-3">{children}</ul>;
}

export const TreeView = { Root, Item, Row, DragHandle, Toggle, ToggleSpacer, Group };
