/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { CONNECTIVITY_PROBES } from '../src/services/connectivity'
import { renderAdminConnectivity } from '../src/pages/admin/connectivity'

test('connectivity page exposes every registered read-only probe', () => {
  const ids = CONNECTIVITY_PROBES.map(probe => probe.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids, ['database', 'stripe', 'resend', 'exchange', 'github', 'photon', 'nominatim', 'googlePlaces', 'turnstile', 'deviceChannel'])
  const html = renderAdminConnectivity({ id: 'admin-1', name: 'Admin', role: 'ADMIN' })
  for (const probe of CONNECTIVITY_PROBES) {
    assert.match(html, new RegExp(`data-probe-id="${probe.id}"`))
  }
  assert.match(html, /\/webhooks\/stripe/)
  assert.match(html, /\/api\/device-agent\/command-results/)
  assert.match(html, /\/api\/coupons\/rental-preview/)
  const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi), match => match[1])
  for (const script of scripts) assert.doesNotThrow(() => new Function(script))
})
