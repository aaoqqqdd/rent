-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Assign each customer to the staff member who manages the account.

ALTER TABLE users ADD COLUMN staff_id TEXT REFERENCES users(id) ON DELETE SET NULL;

UPDATE users
SET staff_id = (
  SELECT c.created_by
  FROM orders o
  JOIN contracts c ON c.orderId = o.id
  WHERE o.userId = users.id AND c.created_by IS NOT NULL
  ORDER BY c.createdAt ASC
  LIMIT 1
)
WHERE role = 'CUSTOMER' AND staff_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id, role);
