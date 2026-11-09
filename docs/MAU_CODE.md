# Mẫu code chuẩn

Dùng tính năng Đơn hàng làm ví dụ. Mọi tính năng khác viết theo cùng khuôn. Mẫu chưa được biên dịch vì lúc soạn dự án chưa có code, cần chỉnh theo phiên bản thư viện thực tế khi dựng F1.

## 1. Khai báo package

`packages/contracts/package.json`, cho phép import đúng file mà không cần barrel:

```json
{
  "name": "@dms/contracts",
  "private": true,
  "type": "module",
  "exports": { "./*": "./src/*.ts" },
  "dependencies": { "zod": "^4" }
}
```

## 2. Kiểu dùng chung
`packages/contracts/src/common.ts`

```ts
import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const errorCode = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'INTEGRATION',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof errorCode>;

export type ActionWarning = { code: string; message: string };

export type ActionResult<T> =
  | { ok: true; data: T; warnings?: ActionWarning[] }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

export function pageResult<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  });
}
```

`packages/contracts/src/format.ts`

```ts
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatVnd(value: number): string {
  return `${number.format(value)} đ`;
}
```

## 3. Hợp đồng một miền
`packages/contracts/src/orders.ts`

```ts
import { z } from 'zod';
import { MAX_PAGE_SIZE, pageResult } from './common';

export const orderStatus = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SYNCED',
  'SYNC_FAILED',
]);
export type OrderStatus = z.infer<typeof orderStatus>;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  SYNCED: 'Đã chuyển FAST',
  SYNC_FAILED: 'Lỗi đồng bộ',
};

export const orderFlag = z.enum(['OVER_CREDIT', 'LOW_STOCK']);

export const orderSummary = z.object({
  code: z.string(),
  dealerName: z.string(),
  orderedAt: z.iso.datetime(),
  quantityKg: z.number().nonnegative(),
  totalVnd: z.number().int().nonnegative(),
  status: orderStatus,
  flags: z.array(orderFlag),
});
export type OrderSummary = z.infer<typeof orderSummary>;

export const listOrdersInput = z.object({
  q: z.string().trim().optional(),
  status: orderStatus.optional(),
  sort: z.enum(['orderedAt', '-orderedAt', 'totalVnd', '-totalVnd']).default('-orderedAt'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(20),
});
export type ListOrdersInput = z.infer<typeof listOrdersInput>;

export const listOrdersResult = pageResult(orderSummary);
export type ListOrdersResult = z.infer<typeof listOrdersResult>;

// Doi tham so tieng Viet tren URL sang dau vao cua ham. Gia tri sai thi dung mac dinh.
export const ordersUrlParams = z
  .object({
    q: z.string().optional().catch(undefined),
    'trang-thai': orderStatus.optional().catch(undefined),
    'sap-xep': listOrdersInput.shape.sort.catch('-orderedAt'),
    trang: z.coerce.number().int().positive().catch(1),
  })
  .transform(
    (url): ListOrdersInput => ({
      q: url.q,
      status: url['trang-thai'],
      sort: url['sap-xep'],
      page: url.trang,
      pageSize: 20,
    }),
  );

export const createOrderInput = z.object({
  dealerId: z.uuid(),
  note: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        productCode: z.string().min(1),
        packagingId: z.uuid(),
        quantity: z.number().positive(),
      }),
    )
    .min(1, 'Đơn hàng cần ít nhất một sản phẩm'),
});
export type CreateOrderInput = z.infer<typeof createOrderInput>;
```

`packages/contracts/src/fixtures/orders.ts`

```ts
import type { ListOrdersResult } from '../orders';

export const ordersFixture = {
  items: [
    {
      code: 'DH-2611-0042',
      dealerName: 'Đại lý Minh Phát',
      orderedAt: '2026-11-09T02:00:00.000Z',
      quantityKg: 1250,
      totalVnd: 48750000,
      status: 'APPROVED',
      flags: [],
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
} satisfies ListOrdersResult;
```

## 4. Query
`apps/web/src/server/queries/orders.ts`

```ts
import 'server-only';
import type { ListOrdersInput, ListOrdersResult } from '@dms/contracts/orders';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';

export async function listOrders(input: ListOrdersInput): Promise<ListOrdersResult> {
  const user = await requireUser();
  assertCan(user, 'sales.order.read');

  const where = { ...orderScope(user), ...orderFilters(input) };
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: orderSort(input.sort),
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: orderSummarySelect,
    }),
    db.order.count({ where }),
  ]);

  return { items: rows.map(toOrderSummary), total, page: input.page, pageSize: input.pageSize };
}
```

## 5. Server Action
`apps/web/src/server/actions/orders.ts`

```ts
'use server';

import { after } from 'next/server';
import type { ActionResult } from '@dms/contracts/common';
import { createOrderInput } from '@dms/contracts/orders';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { writeAudit } from '@/server/services/audit';
import { createOrder } from '@/server/services/orders';

export async function createOrderAction(raw: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.order.create');

    const parsed = createOrderInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    // Canh bao ton kho, cong no duoc tra ve nhung khong chan tao don.
    const { order, warnings } = await createOrder(user, parsed.data);
    after(() => writeAudit(user, 'sales.order.create', order.id));

    return { ok: true, data: { code: order.code }, warnings };
  } catch (error) {
    return toActionError(error);
  }
}
```

## 6. Trang danh sách
`apps/web/src/app/kinh-doanh/don-hang/page.tsx`

```tsx
import { Suspense } from 'react';
import { ordersUrlParams, type ListOrdersInput } from '@dms/contracts/orders';
import { OrdersTable } from '@/features/orders/components/orders-table';
import { OrdersTableSkeleton } from '@/features/orders/components/orders-table-skeleton';
import { listOrders } from '@/server/queries/orders';

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPage({ searchParams }: PageProps) {
  const input = ordersUrlParams.parse(await searchParams);

  return (
    <>
      <h1 className="text-brand text-2xl font-bold">Đơn hàng</h1>
      {/* Khong dat key theo bo loc de thanh cong cu khong mat focus khi dang go tim kiem. */}
      <Suspense fallback={<OrdersTableSkeleton />}>
        <OrdersResults input={input} />
      </Suspense>
    </>
  );
}

async function OrdersResults({ input }: { input: ListOrdersInput }) {
  const data = await listOrders(input);
  return <OrdersTable data={data} />;
}
```

## 7. Form tạo mới
`apps/web/src/features/orders/components/order-form-create.tsx`

```tsx
'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOrderInput, type CreateOrderInput } from '@dms/contracts/orders';
import { createOrderAction } from '@/server/actions/orders';

export function OrderFormCreate({ onCreated }: { onCreated: (code: string) => void }) {
  const form = useForm<CreateOrderInput>({ resolver: zodResolver(createOrderInput) });
  const [pending, startTransition] = useTransition();

  function submit(values: CreateOrderInput) {
    startTransition(async () => {
      const result = await createOrderAction(values);
      if (result.ok) {
        // Hien result.warnings cho nguoi dung, don hang van da duoc tao.
        onCreated(result.data.code);
        return;
      }
      // Hien result.message va gan result.fieldErrors vao tung truong.
    });
  }

  return <form onSubmit={form.handleSubmit(submit)}>{/* Cac truong */}</form>;
}
```

## 8. Nạp font
`apps/web/src/app/fonts.ts`

```ts
import localFont from 'next/font/local';

export const brandFont = localFont({
  variable: '--font-brand',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [
    { prop: 'ascent-override', value: '99%' },
    { prop: 'descent-override', value: '37.7%' },
    { prop: 'line-gap-override', value: '0%' },
  ],
  src: [
    { path: './fonts/UTMNeoSansIntel-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/UTMNeoSansIntel-Italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/UTMNeoSansIntel-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/UTMNeoSansIntel-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
});
```

Trong layout gốc: `<html lang="vi" className={brandFont.variable}>`.

## 9. Logo
`packages/ui/src/logo.tsx`, các file SVG chép vào `apps/web/public/brand/`.

```tsx
import Image from 'next/image';

const SIZES = {
  s: { width: 120, height: 30 },
  m: { width: 160, height: 40 },
  l: { width: 200, height: 50 },
  xl: { width: 280, height: 70 },
} as const;

type LogoProps = {
  variant: 'color' | 'white' | 'bw-light';
  size: keyof typeof SIZES;
};

export function Logo({ variant, size }: LogoProps) {
  const { width, height } = SIZES[size];
  return (
    <Image
      src={`/brand/vinaseed-logo-${variant}.svg`}
      width={width}
      height={height}
      alt="Vinaseed - A member of the PAN Group"
      unoptimized
    />
  );
}
```

## 10. Thông tin chân trang
`packages/config/src/footer.ts`

```ts
export const FOOTER = {
  copyright: 'Bản quyền © 2026 thuộc Phòng ĐMST&CĐS',
  department: 'Phòng ĐMST&CĐS',
  email: 'dmst-cds@vinaseed.com.vn',
  phone: '0982109295',
} as const;
```

Khi hiển thị, ký hiệu © được phóng to theo `BRAND.md` §2.

## 11. API cho app điện thoại
`apps/web/src/app/api/mobile/check-ins/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createCheckInInput } from '@dms/contracts/check-ins';
import { requireMobileUser } from '@/server/auth/mobile';
import { saveCheckIn } from '@/server/services/check-ins';

export async function POST(request: Request) {
  const user = await requireMobileUser(request);

  const parsed = createCheckInInput.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Dữ liệu check-in không hợp lệ', details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Goi lai voi cung clientId se tra ket qua cu, khong tao ban ghi moi.
  const checkIn = await saveCheckIn(user, parsed.data);
  return NextResponse.json({ id: checkIn.id, serverTime: checkIn.serverTime });
}
```
