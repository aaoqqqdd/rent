-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- Staff/admin contract list pages filter by status alongside the existing
-- idx_contracts_created_by index.
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
