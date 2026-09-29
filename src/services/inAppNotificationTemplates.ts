/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'

let schemaReady: Promise<void> | null = null

export async function ensureInAppNotificationTemplates(c: Context): Promise<void> {
  if (!schemaReady) schemaReady = c.env.RENT.prepare(`CREATE TABLE IF NOT EXISTS in_app_notification_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run().then(() => undefined)
  try { await schemaReady } catch (error) { schemaReady = null; throw error }
}
