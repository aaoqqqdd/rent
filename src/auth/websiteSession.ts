/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import type { User } from '../db/types'

// Only the configured marketing origin may read this browser's session status.
// Identity, account details and session tokens never leave the dashboard.
export function websiteSessionStatus(c: Context): Response {
  c.header('Cache-Control', 'private, no-store')
  c.header('Vary', 'Origin, Cookie')
  const origin = c.req.header('Origin')
  const allowedOrigin = String(c.env.PUBLIC_WEB_ORIGIN || '').replace(/\/$/, '')
  if (!origin || !allowedOrigin || origin !== allowedOrigin) return c.body(null, 403)
  c.header('Access-Control-Allow-Origin', allowedOrigin)
  c.header('Access-Control-Allow-Credentials', 'true')
  const user = c.get('user') as User | undefined
  return c.json({ authenticated: Boolean(user && (user.accountType ?? user.account_type ?? 'formal') === 'formal') })
}
