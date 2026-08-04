-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

-- Migration to add contractId to the orders table and populate existing data.

-- Add contractId column to orders table
ALTER TABLE orders ADD COLUMN contractId TEXT;

-- Populate contractId for existing orders based on contracts table
-- This assumes a one-to-one or one-to-many relationship where an order can have one contract.
-- We'll link based on the orderId (which is the correct column name in contracts table)
UPDATE orders
SET contractId = (SELECT id FROM contracts WHERE contracts.orderId = orders.id LIMIT 1)
WHERE id IN (SELECT orderId FROM contracts);

-- Add foreign key constraint (optional, depending on D1 limitations and desired strictness)
-- ALTER TABLE orders ADD CONSTRAINT fk_contractId FOREIGN KEY (contractId) REFERENCES contracts(id) ON DELETE SET NULL;
