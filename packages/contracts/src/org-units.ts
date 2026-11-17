import { z } from 'zod';

const orgUnitCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{2,30}$/, 'Mã gồm 2-30 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới');

const orgUnitName = z
  .string()
  .trim()
  .min(2, 'Tên đơn vị cần ít nhất 2 ký tự')
  .max(120, 'Tên đơn vị tối đa 120 ký tự');

const managerId = z.uuid().nullable();

export const createOrgUnitInput = z.object({
  parentId: z.uuid(),
  code: orgUnitCode,
  name: orgUnitName,
  managerId,
  // Quyet dinh 31: bat thi phieu Tuyen, Chi tieu qua Quan ly truoc Lanh dao don vi.
  hasManagerLevel: z.boolean(),
});
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitInput>;

export const updateOrgUnitInput = z.object({
  id: z.uuid(),
  code: orgUnitCode,
  name: orgUnitName,
  managerId,
  // Quyet dinh 31: bat thi phieu Tuyen, Chi tieu qua Quan ly truoc Lanh dao don vi.
  hasManagerLevel: z.boolean(),
});
export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitInput>;

export const moveOrgUnitInput = z.object({
  id: z.uuid(),
  newParentId: z.uuid('Vui lòng chọn đơn vị cha'),
});
export type MoveOrgUnitInput = z.infer<typeof moveOrgUnitInput>;

export const assignOrgUnitManagerInput = z.object({ id: z.uuid(), managerId });
export type AssignOrgUnitManagerInput = z.infer<typeof assignOrgUnitManagerInput>;

export const deleteOrgUnitInput = z.object({ id: z.uuid() });
export type DeleteOrgUnitInput = z.infer<typeof deleteOrgUnitInput>;

export type OrgUnitRow = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  managerName: string | null;
  hasManagerLevel: boolean;
  memberCount: number;
};

export type ManagerOption = { value: string; label: string };

// assignableUnitIds bang null nghia la doi duoc Truong don vi cua moi don vi.
export type OrgUnitAssignScope = {
  assignableUnitIds: string[] | null;
  managerOptions: ManagerOption[];
};
