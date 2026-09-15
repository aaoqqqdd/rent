/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createTallyFeedbackToken, normalizeTallyEmbedUrl, verifyTallyFeedbackToken } from '../src/lib/tally'
import { renderTallyForm } from '../src/pages/public/tallyForm'

test('Tally integration only accepts hosted Tally embed URLs', () => {
  assert.equal(normalizeTallyEmbedUrl('https://tally.so/embed/abc123?hideTitle=1'), 'https://tally.so/embed/abc123?hideTitle=1')
  assert.equal(normalizeTallyEmbedUrl('https://tally.so/r/abc123'), '')
  assert.equal(normalizeTallyEmbedUrl('javascript:alert(1)'), '')
  assert.equal(normalizeTallyEmbedUrl('https://example.com/embed/abc123'), '')
})

test('Tally page renders the official widget embed and a safe disabled state', () => {
  const html = renderTallyForm('https://tally.so/embed/abc123')
  assert.match(html, /data-tally-src="https:\/\/tally\.so\/embed\/abc123"/)
  assert.match(html, /https:\/\/tally\.so\/widgets\/embed\.js/)
  assert.match(renderTallyForm(), /反馈问卷暂未开放/)
})

test('feedback tokens identify only the signed, unexpired customer', async () => {
  const token = await createTallyFeedbackToken('test-secret', 'customer-1', 60)
  assert.equal(await verifyTallyFeedbackToken('test-secret', token), 'customer-1')
  assert.equal(await verifyTallyFeedbackToken('wrong-secret', token), '')
  assert.equal(await verifyTallyFeedbackToken('test-secret', `${token}x`), '')
})
