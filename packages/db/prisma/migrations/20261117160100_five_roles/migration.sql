-- F3b (17/11/2026, quyet dinh 31): them vai tro Lanh dao don vi va Quan ly theo ROLE_PRESETS,
-- doi ten hien thi Can bo nhan vien thanh Nhan vien kinh doanh (giu ma staff). Chi them, khong xoa.

INSERT INTO "roles" ("id", "code", "name", "data_scope", "updated_at") VALUES
  (gen_random_uuid(), 'unit-leader', 'Lãnh đạo đơn vị', 'ORG_UNIT_TREE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'manager', 'Quản lý', 'TEAM', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "roles" SET "name" = 'Nhân viên kinh doanh', "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'staff' AND "name" = 'Cán bộ nhân viên';

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE r."code" = 'unit-leader' AND p."code" IN (
  'executive.overview.read', 'sales.dashboard.read', 'sales.target.read', 'sales.dealer.read',
  'sales.customer.read', 'sales.route.read', 'sales.check-in.read', 'sales.check-in.create',
  'sales.report.read', 'support.request.create'
)
ON CONFLICT DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE r."code" = 'manager' AND p."code" IN (
  'sales.dashboard.read', 'sales.target.read', 'sales.dealer.read', 'sales.dealer.create',
  'sales.dealer.update', 'sales.customer.read', 'sales.route.read', 'sales.check-in.read',
  'sales.check-in.create', 'sales.report.read', 'support.request.create'
)
ON CONFLICT DO NOTHING;
