-- Đổi tên role, giữ nguyên Id nên User.RoleId không đổi.
UPDATE "Role" SET "RoleName" = 'Chuyên viên' WHERE "RoleName" = 'Cộng tác viên';
