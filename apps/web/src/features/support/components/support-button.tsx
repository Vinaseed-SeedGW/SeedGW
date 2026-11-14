'use client';

import { LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { FOOTER } from '@dms/config/footer';
import { FormSheet } from '@dms/ui/form-sheet';

// Nut noi o goc duoi ben phai cho nguoi gui yeu cau ho tro (quyet dinh 30).
// Phan gui va trao doi lam o task T2; trong luc cho, khung chi chi cach lien he truc tiep.
export function SupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="fixed right-4 bottom-4 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-brand-hover bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-6 sm:bottom-6"
      >
        <LifeBuoy size={20} aria-hidden />
        Hỗ trợ
      </button>
      {open ? (
        <FormSheet.Root title="Hỗ trợ" onClose={() => setOpen(false)}>
          <p>
            Chức năng gửi yêu cầu hỗ trợ ngay trong DMS đang được xây dựng. Khi xong, bạn gửi được
            câu hỏi, báo lỗi, góp ý tới Quản trị đơn vị và theo dõi trả lời tại đây.
          </p>
          <p className="mt-4">Trong lúc chờ, vui lòng liên hệ {FOOTER.department}:</p>
          <p className="mt-2">
            Email{' '}
            <a className="text-brand" href={`mailto:${FOOTER.email}`}>
              {FOOTER.email}
            </a>
          </p>
          <p className="mt-1">
            SĐT{' '}
            <a className="text-brand" href={`tel:${FOOTER.phone}`}>
              {FOOTER.phone}
            </a>
          </p>
          <div className="mt-6">
            <FormSheet.Close>Đóng</FormSheet.Close>
          </div>
        </FormSheet.Root>
      ) : null}
    </>
  );
}
