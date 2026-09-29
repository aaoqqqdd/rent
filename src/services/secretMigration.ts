/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { encryptSecret, isEncryptedSecret } from '../lib/secretBox'

// Legacy contracts stored rental credentials inside contract_data as plaintext.
// Migrate a bounded batch during the daily maintenance window, using a
// compare-and-swap update so a concurrent signing write is never overwritten.
export async function migrateLegacyContractSecrets(c: Context): Promise<number> {
  if (!String((c.env as any).SETTINGS_ENCRYPTION_KEY || '')) return 0
  const rows = (await c.env.RENT.prepare(`
    SELECT id, contract_data FROM contracts
    WHERE contract_data IS NOT NULL
      AND (json_extract(contract_data, '$.windows_password') IS NOT NULL
        OR json_extract(contract_data, '$.guest_password') IS NOT NULL)
    LIMIT 100
  `).all() as any).results || []
  let migrated = 0
  for (const row of rows as any[]) {
    let data: Record<string, any>
    try { data = JSON.parse(String(row.contract_data || '{}')) } catch { continue }
    let changed = false
    for (const field of ['windows_password', 'guest_password']) {
      const value = data[field]
      if (typeof value === 'string' && value && !isEncryptedSecret(value)) {
        data[field] = await encryptSecret(c, value)
        changed = true
      }
    }
    if (!changed) continue
    const result = await c.env.RENT.prepare('UPDATE contracts SET contract_data = ? WHERE id = ? AND contract_data = ?')
      .bind(JSON.stringify(data), row.id, row.contract_data).run() as any
    migrated += Number(result.meta?.changes ?? result.changes ?? 0)
  }
  return migrated
}
