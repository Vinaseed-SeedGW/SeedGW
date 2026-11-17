import { scopeWhere, type ScopeContext, type ScopeFields } from '@dms/contracts/access';
import { db } from './client';

// Moi model co du lieu theo nguoi phu trach hoac don vi can khai bao o day.
const SCOPED_MODELS: Record<string, ScopeFields> = {
  User: { ownerField: 'id', orgUnitField: 'orgUnitId' },
  MobileDevice: { ownerField: 'userId', orgUnitField: 'user.orgUnitId' },
  AuditLog: { ownerField: 'actorId', orgUnitField: 'actor.orgUnitId' },
  // Theo don vi luc check-in de bao cao cu khong doi khi nhan vien chuyen don vi.
  CheckIn: { ownerField: 'userId', orgUnitField: 'orgUnitId' },
  TrackPoint: { ownerField: 'userId', orgUnitField: 'user.orgUnitId' },
  TrackSession: { ownerField: 'userId', orgUnitField: 'user.orgUnitId' },
  // Nhan vien thay dai ly duoc giao, quan ly thay theo don vi phu trach cua dai ly.
  Dealer: { ownerField: 'assignedUserId', orgUnitField: 'orgUnitId' },
  // Theo don vi phu trach dai ly luc de xuat, nhan vien chi thay de xuat cua minh.
  DealerLocationProposal: { ownerField: 'proposedById', orgUnitField: 'orgUnitId' },
  UserConsent: { ownerField: 'userId', orgUnitField: 'user.orgUnitId' },
  ApprovalRequest: { ownerField: 'submittedById', orgUnitField: 'orgUnitId' },
  MonthlySalesTarget: { ownerField: 'userId', orgUnitField: 'orgUnitId' },
  RoutePlan: { ownerField: 'userId', orgUnitField: 'orgUnitId' },
};

const SCOPED_OPERATIONS = new Set<string>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

type WhereArgs = { where?: Record<string, unknown> & { AND?: unknown } };

function asArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function scopedDb(context: ScopeContext) {
  return db.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const fields = SCOPED_MODELS[model];
          if (!fields || !SCOPED_OPERATIONS.has(operation)) return query(args);

          const where = (args as WhereArgs).where ?? {};
          return query({
            ...args,
            where: { ...where, AND: [...asArray(where.AND), scopeWhere(context, fields)] },
          } as typeof args);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;
