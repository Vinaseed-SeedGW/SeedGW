-- Quyet dinh 29 (14/11/2026): Trao doi chi con trao doi giua CBNV va quan tri, gop Tin nhan va Bao loi
-- thanh Yeu cau ho tro. Doi ma quyen tai cho de giu gan quyen cua vai tro; chi doi du lieu, khong doi bang.

UPDATE "permissions" SET "code" = 'support.request.create', "name" = 'Gửi Yêu cầu hỗ trợ'
WHERE "code" = 'chat.issue.create'
  AND NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'support.request.create');

UPDATE "permissions" SET "code" = 'support.request.manage', "name" = 'Xử lý Yêu cầu hỗ trợ'
WHERE "code" = 'chat.issue.manage'
  AND NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'support.request.manage');

-- Bo nhan tin giua nhan vien voi nhau.
DELETE FROM "_role_permissions" WHERE "A" IN (SELECT "id" FROM "permissions" WHERE "code" LIKE 'chat.%');
DELETE FROM "permissions" WHERE "code" LIKE 'chat.%';
