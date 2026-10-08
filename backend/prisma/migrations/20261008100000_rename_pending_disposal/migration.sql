-- Đổi nhãn trạng thái thiết bị; AuditItem.DeviceStatus là ảnh chụp lúc lập lịch — đổi theo để biên bản cũ thống nhất.
UPDATE "Device" SET "Status" = 'Chờ xử lý' WHERE "Status" = 'Chờ thanh lý';
UPDATE "AuditItem" SET "DeviceStatus" = 'Chờ xử lý' WHERE "DeviceStatus" = 'Chờ thanh lý';
