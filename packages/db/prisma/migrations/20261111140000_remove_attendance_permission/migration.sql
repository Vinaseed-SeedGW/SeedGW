-- DMS khong tinh cong, bo quyen cua trang Cham cong (DESIGN_BRIEF muc 20)
DELETE FROM "_role_permissions" WHERE "A" IN (SELECT "id" FROM "permissions" WHERE "code" = 'sales.attendance.read');
DELETE FROM "permissions" WHERE "code" = 'sales.attendance.read';
