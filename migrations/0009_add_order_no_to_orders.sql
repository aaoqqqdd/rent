ALTER TABLE orders ADD COLUMN orderNo TEXT;
UPDATE orders SET orderNo = id WHERE orderNo IS NULL;