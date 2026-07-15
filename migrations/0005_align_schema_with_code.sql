-- This is a comprehensive migration to align the database schema with the application code's expectations (camelCase).
-- It addresses inconsistencies across multiple tables.

-- Step 1: Rename 'rentals' table to 'orders'
ALTER TABLE rentals RENAME TO orders;

-- Step 2: Add 'orderNo' and 'created_by' columns to 'orders' table.
ALTER TABLE orders ADD COLUMN orderNo TEXT;
ALTER TABLE orders ADD COLUMN created_by TEXT; -- Logic from migration 0004
UPDATE orders SET orderNo = id WHERE orderNo IS NULL;

-- Step 3: Rename columns in 'orders' table from snake_case to camelCase.
ALTER TABLE orders RENAME COLUMN customer_id TO userId;
ALTER TABLE orders RENAME COLUMN device_id TO deviceId;
ALTER TABLE orders RENAME COLUMN start_date TO startDate;
ALTER TABLE orders RENAME COLUMN end_date TO endDate;
ALTER TABLE orders RENAME COLUMN rental_period TO rentalPeriod;
ALTER TABLE orders RENAME COLUMN total_amount TO totalAmount;
ALTER TABLE orders RENAME COLUMN deposit_amount TO depositAmount;
ALTER TABLE orders RENAME COLUMN payment_method TO paymentMethod;
ALTER TABLE orders RENAME COLUMN contract_signed TO contractSigned;
ALTER TABLE orders RENAME COLUMN referrer_id TO referrerId;
ALTER TABLE orders RENAME COLUMN commission_rate TO commissionRate;
ALTER TABLE orders RENAME COLUMN commission_amount TO commissionAmount;
ALTER TABLE orders RENAME COLUMN square_payment_id TO squarePaymentId;
ALTER TABLE orders RENAME COLUMN created_at TO createdAt;
ALTER TABLE orders RENAME COLUMN updated_at TO updatedAt;
ALTER TABLE orders RENAME COLUMN created_by TO createdAtBy; -- Rename the newly added column to match code style

-- Step 4: Rename columns in 'users' table.
ALTER TABLE users RENAME COLUMN password_hash TO passwordHash;
ALTER TABLE users RENAME COLUMN account_number TO accountNumber;
ALTER TABLE users RENAME COLUMN referrer_id TO referrerId;
ALTER TABLE users RENAME COLUMN commission_rate TO commissionRate;
ALTER TABLE users RENAME COLUMN commission_balance TO commissionBalance;
ALTER TABLE users RENAME COLUMN created_at TO createdAt;
ALTER TABLE users RENAME COLUMN updated_at TO updatedAt;

-- Step 5: Rename columns in 'devices' table.
ALTER TABLE devices RENAME COLUMN price_per_day TO pricePerDay;
ALTER TABLE devices RENAME COLUMN deposit_amount TO depositAmount;
ALTER TABLE devices RENAME COLUMN serial_number TO serialNumber;
ALTER TABLE devices RENAME COLUMN entry_date TO entryDate;
ALTER TABLE devices RENAME COLUMN created_at TO createdAt;
ALTER TABLE devices RENAME COLUMN updated_at TO updatedAt;

-- Step 6: Rename columns in 'contracts' table.
ALTER TABLE contracts RENAME COLUMN rental_id TO orderId;
ALTER TABLE contracts RENAME COLUMN contract_number TO contractNumber;
ALTER TABLE contracts RENAME COLUMN signed_at TO signedAt;
ALTER TABLE contracts RENAME COLUMN created_at TO createdAt;
ALTER TABLE contracts RENAME COLUMN updated_at TO updatedAt;