-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

UPDATE contracts
SET contract_data = json_remove(
  contract_data,
  '$.customer_address',
  '$.customer_dob',
  '$.customer_driver_expiry',
  '$.customer_country',
  '$.emergency_contact',
  '$.emergency_phone'
);

ALTER TABLE contracts DROP COLUMN customer_id_type;
ALTER TABLE contracts DROP COLUMN customer_id_number;
