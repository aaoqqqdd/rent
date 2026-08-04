-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Source-available; modification, redistribution, deployment, and commercial use
-- are prohibited without prior written permission. See LICENSE.

ALTER TABLE contracts ADD COLUMN validFrom TEXT;
ALTER TABLE contracts ADD COLUMN validUntil TEXT;
