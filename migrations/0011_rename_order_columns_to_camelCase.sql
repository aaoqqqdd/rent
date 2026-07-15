-- Rename columns in the orders table from snake_case to camelCase
ALTER TABLE orders RENAME COLUMN customer_id TO userId;
ALTER TABLE orders RENAME COLUMN device_id TO deviceId;
ALTER TABLE orders RENAME COLUMN start_date TO startDate;
ALTER TABLE orders RENAME COLUMN end_date TO endDate;
ALTER TABLE orders RENAME COLUMN rental_period TO rentalPeriod;
ALTER TABLE orders RENAME COLUMN deposit_amount TO depositAmount;
ALTER TABLE orders RENAME COLUMN payment_method TO paymentMethod;
ALTER TABLE orders RENAME COLUMN created_at TO createdAt;
ALTER TABLE orders RENAME COLUMN updated_at TO updatedAt;