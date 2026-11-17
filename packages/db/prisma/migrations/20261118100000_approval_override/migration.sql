-- 18/11/2026: Quan tri he thong duyet thay, tra lai thay, rut lai thay va gui thay Tuyen, Chi tieu.
-- Chi them quyen, khong doi bang.
INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'sales.approval.override', 'Duyệt thay, sửa thay Tuyến và Chỉ tiêu')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'sales.approval.override' AND r."code" = 'admin'
ON CONFLICT DO NOTHING;
