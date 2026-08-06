-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.

ALTER TABLE devices ADD COLUMN brand TEXT;
ALTER TABLE devices ADD COLUMN asset_tag TEXT;
ALTER TABLE devices ADD COLUMN cpu TEXT;
ALTER TABLE devices ADD COLUMN ram TEXT;
ALTER TABLE devices ADD COLUMN storage TEXT;
ALTER TABLE devices ADD COLUMN gpu TEXT;
ALTER TABLE devices ADD COLUMN os TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_asset_tag
  ON devices(asset_tag)
  WHERE asset_tag IS NOT NULL AND asset_tag <> '';
