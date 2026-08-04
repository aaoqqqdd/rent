-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

ALTER TABLE contracts ADD COLUMN device_condition TEXT;
ALTER TABLE contracts ADD COLUMN device_accessories TEXT;
ALTER TABLE contracts ADD COLUMN late_fee_per_day REAL NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN repair_cost REAL;
ALTER TABLE contracts ADD COLUMN pickup_location TEXT;
ALTER TABLE contracts ADD COLUMN return_location TEXT;
ALTER TABLE contracts ADD COLUMN customer_id_type TEXT;
ALTER TABLE contracts ADD COLUMN customer_id_number TEXT;
ALTER TABLE contracts ADD COLUMN esign_ip TEXT;
ALTER TABLE contracts ADD COLUMN esign_device TEXT;
