'use client';

import { useCallback, useRef } from 'react';

// Ham ref phai on dinh. Ham viet truc tiep trong JSX chay lai moi lan render,
// nen hop thoai vua close() co the bi showModal() mo lai truoc khi su kien close kip chay.
export function useModalDialog() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const attachDialog = useCallback((element: HTMLDialogElement | null) => {
    dialogRef.current = element;
    if (element && !element.open) element.showModal();
  }, []);

  return { dialogRef, attachDialog };
}
