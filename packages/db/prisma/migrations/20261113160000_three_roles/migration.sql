-- Quyet dinh 28 (13/11/2026): con 3 vai tro Quan tri he thong, Quan tri don vi, Can bo nhan vien;
-- bo bo phan CSKH, them bo phan Trao doi (tin nhan noi bo, bao loi he thong). Chi doi du lieu, khong doi bang.

-- 1. Quyen moi cua Trao doi.
INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'chat.message.use', 'Dùng Tin nhắn nội bộ'),
  (gen_random_uuid(), 'chat.issue.create', 'Gửi Báo lỗi hệ thống'),
  (gen_random_uuid(), 'chat.issue.manage', 'Xử lý Báo lỗi hệ thống')
ON CONFLICT ("code") DO NOTHING;

-- 2. Bo quyen CSKH.
DELETE FROM "_role_permissions" WHERE "A" IN (SELECT "id" FROM "permissions" WHERE "code" LIKE 'cs.%');
DELETE FROM "permissions" WHERE "code" LIKE 'cs.%';

-- 3. Vai tro Nhan vien kinh doanh doi thanh Can bo nhan vien.
UPDATE "roles" SET "code" = 'staff', "name" = 'Cán bộ nhân viên', "data_scope" = 'OWN'
WHERE "code" = 'sales' AND NOT EXISTS (SELECT 1 FROM "roles" WHERE "code" = 'staff');

-- 4. Nguoi dang giu vai tro bi bo: quan ly vung sang Quan tri don vi, con lai sang Can bo nhan vien.
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT ur."user_id", (SELECT "id" FROM "roles" WHERE "code" = 'operations')
FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id"
WHERE r."code" = 'asm'
ON CONFLICT DO NOTHING;
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT ur."user_id", (SELECT "id" FROM "roles" WHERE "code" = 'staff')
FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id"
WHERE r."code" IN ('sales-admin', 'customer-care', 'customer-care-lead', 'executive')
ON CONFLICT DO NOTHING;

-- 5. Xoa vai tro thua (user_roles va _role_permissions tu xoa theo).
DELETE FROM "roles" WHERE "code" IN ('asm', 'sales-admin', 'customer-care', 'customer-care-lead', 'executive');

-- 6. Quyen cua 3 vai tro theo ROLE_PRESETS.
DELETE FROM "_role_permissions" WHERE "B" IN (SELECT "id" FROM "roles" WHERE "code" IN ('operations', 'staff'));

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p, "roles" r
WHERE r."code" = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p, "roles" r
WHERE r."code" = 'operations' AND (
  p."code" LIKE 'sales.%' OR p."code" LIKE 'chat.%' OR p."code" IN (
    'admin.user.read', 'admin.user.manage', 'admin.user.export',
    'admin.org-unit.read', 'admin.org-unit.assign', 'admin.dealer.read'
  )
)
ON CONFLICT DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p, "roles" r
WHERE r."code" = 'staff' AND p."code" IN (
  'sales.dashboard.read', 'sales.target.read', 'sales.dealer.read', 'sales.dealer.create',
  'sales.dealer.update', 'sales.customer.read', 'sales.route.read', 'sales.check-in.read',
  'sales.check-in.create', 'chat.message.use', 'chat.issue.create'
)
ON CONFLICT DO NOTHING;
