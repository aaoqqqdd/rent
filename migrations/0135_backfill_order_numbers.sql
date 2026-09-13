-- Backfill orderNo for orders created before order numbers were assigned at creation time.
-- Also fixes rows where migration 0005 set orderNo = id (raw "o-xxxxxxxx" ids leaking into orderNo).
UPDATE orders
SET orderNo = 'OD-' || strftime('%Y%m%d', createdAt) || '-' || upper(substr(hex(randomblob(8)), 1, 6))
WHERE orderNo IS NULL OR orderNo = '' OR orderNo = id OR orderNo LIKE 'o-%';
