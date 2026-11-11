'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { ApproverType } from '@dms/contracts/workflows';

export type DragSource =
  | { kind: 'move'; fromIndex: number; label: string }
  | { kind: 'insert'; approverType: ApproverType; label: string };

export type DragState = { source: DragSource; x: number; y: number; slot: number | null };

// Phai keo qua nguong nay moi tinh la keo, duoi nguong la bam binh thuong.
const START_DISTANCE = 6;
// Keo gan mep man hinh thi trang tu cuon de keo duoc toi buoc o xa.
const EDGE_SIZE = 72;
const MAX_SCROLL_STEP = 20;
// Khoi them moi chi tha duoc khi con tro o gan danh sach.
const INSERT_MARGIN = 40;

// Khe tha la so dong co diem giua nam tren con tro, tu 0 toi so dong.
function slotAt(list: HTMLElement, source: DragSource, x: number, y: number): number | null {
  if (source.kind === 'insert') {
    const box = list.getBoundingClientRect();
    const isNear =
      x >= box.left - INSERT_MARGIN &&
      x <= box.right + INSERT_MARGIN &&
      y >= box.top - INSERT_MARGIN &&
      y <= box.bottom + INSERT_MARGIN;
    if (!isNear) return null;
  }
  let slot = 0;
  for (const row of list.querySelectorAll<HTMLElement>('[data-step-row]')) {
    const rect = row.getBoundingClientRect();
    if (y > rect.top + rect.height / 2) slot += 1;
  }
  return slot;
}

// Tha vao khe ngay truoc hoac ngay sau chinh no thi thu tu khong doi.
export function isNoopSlot(source: DragSource, slot: number): boolean {
  return source.kind === 'move' && (slot === source.fromIndex || slot === source.fromIndex + 1);
}

function edgeScroll(y: number): number {
  const bottomEdge = window.innerHeight - EDGE_SIZE;
  if (y < EDGE_SIZE) return -Math.ceil((MAX_SCROLL_STEP * (EDGE_SIZE - y)) / EDGE_SIZE);
  if (y > bottomEdge) return Math.ceil((MAX_SCROLL_STEP * (y - bottomEdge)) / EDGE_SIZE);
  return 0;
}

// Sau khi tha, trinh duyet van ban su kien click len phan tu duoi con tro, chan lai mot lan.
function swallowNextClick() {
  const stop = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

type UseStepDragOptions = {
  listRef: RefObject<HTMLElement | null>;
  onDrop: (source: DragSource, slot: number) => void;
};

export function useStepDrag({ listRef, onDrop }: UseStepDragOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const onDropRef = useRef(onDrop);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => () => cleanupRef.current?.(), []);

  function startDrag(source: DragSource) {
    return (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !event.isPrimary) return;
      cleanupRef.current?.();

      const pointerId = event.pointerId;
      const start = { x: event.clientX, y: event.clientY };
      let last = start;
      let isActive = false;
      let frame = 0;

      const currentSlot = () => {
        const list = listRef.current;
        return list ? slotAt(list, source, last.x, last.y) : null;
      };
      const render = () => setDrag({ source, x: last.x, y: last.y, slot: currentSlot() });
      const scrollLoop = () => {
        const delta = edgeScroll(last.y);
        if (delta !== 0) {
          window.scrollBy(0, delta);
          render();
        }
        frame = window.requestAnimationFrame(scrollLoop);
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleCancel);
        window.removeEventListener('keydown', handleKey);
        window.cancelAnimationFrame(frame);
        document.documentElement.style.removeProperty('cursor');
        cleanupRef.current = null;
      };
      const finish = (shouldDrop: boolean) => {
        const slot = shouldDrop ? currentSlot() : null;
        cleanup();
        if (!isActive) return;
        swallowNextClick();
        setDrag(null);
        if (slot !== null && !isNoopSlot(source, slot)) onDropRef.current(source, slot);
      };

      function handleMove(moveEvent: PointerEvent) {
        if (moveEvent.pointerId !== pointerId) return;
        last = { x: moveEvent.clientX, y: moveEvent.clientY };
        if (!isActive) {
          if (Math.hypot(last.x - start.x, last.y - start.y) < START_DISTANCE) return;
          isActive = true;
          document.documentElement.style.cursor = 'grabbing';
          frame = window.requestAnimationFrame(scrollLoop);
        }
        moveEvent.preventDefault();
        render();
      }
      function handleUp(upEvent: PointerEvent) {
        if (upEvent.pointerId === pointerId) finish(true);
      }
      function handleCancel(cancelEvent: PointerEvent) {
        if (cancelEvent.pointerId !== pointerId) return;
        finish(false);
      }
      function handleKey(keyEvent: KeyboardEvent) {
        if (keyEvent.key === 'Escape') finish(false);
      }

      window.addEventListener('pointermove', handleMove, { passive: false });
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleCancel);
      window.addEventListener('keydown', handleKey);
      cleanupRef.current = cleanup;
    };
  }

  return { drag, startDrag };
}
