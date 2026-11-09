import { scopeWhere, type ScopeContext, type ScopeFields } from '@dms/contracts/access';
import { db } from './client';

// Moi model co du lieu theo nguoi phu trach hoac don vi can khai bao o day.
const SCOPED_MODELS: Record<string, ScopeFields> = {
  User: { ownerField: 'id', orgUnitField: 'orgUnitId' },
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
