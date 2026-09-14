/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

ALTER TABLE payments ADD COLUMN square_paid_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE balance_topups ADD COLUMN square_paid_amount REAL NOT NULL DEFAULT 0;
