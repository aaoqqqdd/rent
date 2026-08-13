-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.

-- SQLite/D1 requires rebuilding the table to change its CHECK constraint.
PRAGMA foreign_keys=OFF;
ALTER TABLE devices RENAME TO devices_before_retired_status;

CREATE TABLE devices (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  pricePerDay REAL NOT NULL,
  depositAmount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'rented', 'maintenance', 'retired')),
  description TEXT,
  serialNumber TEXT NOT NULL UNIQUE,
  entryDate TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  brand TEXT,
  asset_tag TEXT,
  cpu TEXT,
  ram TEXT,
  storage TEXT,
  gpu TEXT,
  os TEXT
);

INSERT INTO devices (id, name, model, pricePerDay, depositAmount, status, description, serialNumber, entryDate, createdAt, updatedAt, brand, asset_tag, cpu, ram, storage, gpu, os)
SELECT id, name, model, pricePerDay, depositAmount, status, description, serialNumber, entryDate, createdAt, updatedAt, brand, asset_tag, cpu, ram, storage, gpu, os
FROM devices_before_retired_status;

DROP TABLE devices_before_retired_status;
PRAGMA foreign_keys=ON;
