-- Thiết bị đang nằm trong đơn/lệnh "Chờ duyệt" tạo trước khi có giữ chỗ → "Đang chờ duyệt", để duyệt /
-- từ chối các đơn/lệnh đó chạy đúng luồng mới. Chỉ đổi thiết bị còn đúng điều kiện tạo của đơn/lệnh.
-- ponytail: thiết bị nằm trong nhiều đơn/lệnh chờ duyệt cùng lúc (được phép trước đây) chỉ được giữ chỗ
-- cho một — Trưởng phòng Kỹ thuật cần từ chối bớt đơn/lệnh trùng trước khi duyệt.
UPDATE "Device" AS d SET "Status" = 'Đang chờ duyệt'
FROM "DeviceOrderItem" AS i
JOIN "DeviceOrder" AS o ON o."Id" = i."OrderId"
WHERE i."DeviceId" = d."Id"
  AND o."Status" = 'Chờ duyệt'
  AND (
    (o."Type" = 'Cấp phát' AND d."Status" = 'Trong kho')
    OR (o."Type" = 'Thu hồi' AND d."Status" = 'Đã cấp phát' AND d."CurrentUserId" = o."TargetUserId")
  );

UPDATE "Device" AS d SET "Status" = 'Đang chờ duyệt'
FROM "DeviceTransferItem" AS i
JOIN "DeviceTransfer" AS t ON t."Id" = i."TransferId"
WHERE i."DeviceId" = d."Id"
  AND t."Status" = 'Chờ duyệt'
  AND d."Status" = 'Đã cấp phát'
  AND d."CurrentUserId" = t."FromUserId";
