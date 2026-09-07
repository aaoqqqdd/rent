/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { neutralizeTemplateTokens, renderSiteVariables, systemSettings } from '../src/site'

test('neutralizeTemplateTokens replaces unfilled contract placeholders', () => {
  const out = neutralizeTemplateTokens('<p>承租方：{signer_name}，设备 ${device_name}。</p>')
  assert.ok(!out.includes('{signer_name}'))
  assert.ok(!out.includes('${device_name}'))
  assert.equal(out.match(/doc-blank/g)?.length, 2)
})

test('neutralizeTemplateTokens is case-insensitive but leaves non-token braces alone', () => {
  assert.ok(!neutralizeTemplateTokens('{Customer_Name}').includes('{Customer_Name}'))
  const untouched = '{ spaced } {} {a-b} plain text'
  assert.equal(neutralizeTemplateTokens(untouched), untouched)
})

test('neutralizeTemplateTokens accepts a custom placeholder and nullish input', () => {
  assert.equal(neutralizeTemplateTokens('a {x} b', '_'), 'a _ b')
  assert.equal(neutralizeTemplateTokens(undefined as any), '')
})

test('legalMetadata carries the four AU agreement pages added alongside 0114', () => {
  for (const key of ['cookie', 'complaints', 'aup', 'consumer'] as const) {
    assert.ok(systemSettings.legalMetadata[key], `missing legalMetadata.${key}`)
    assert.equal(typeof systemSettings.legalMetadata[key].version, 'string')
  }
})

test('renderSiteVariables fills the new agreement version/date variables', () => {
  const html = renderSiteVariables(
    '<p>v{cookie_policy_version} @ {cookie_policy_last_updated_date}; {complaints_policy_version}; {acceptable_use_policy_version}; {consumer_rights_version}</p>',
    {},
    {
      cookie_policy_version: '2.0',
      cookie_policy_last_updated_date: '2026-09-07',
      complaints_policy_version: '3.1',
      acceptable_use_policy_version: '1.4',
      consumer_rights_version: '5.5',
    },
  )
  assert.ok(html.includes('v2.0 @ 2026-09-07'))
  assert.ok(html.includes('3.1'))
  assert.ok(html.includes('1.4'))
  assert.ok(html.includes('5.5'))
})

test('renderSiteVariables exposes built-in metadata defaults for the new pages without throwing', () => {
  const html = renderSiteVariables('<p>{cookie_policy_version}/{consumer_rights_version}</p>')
  assert.ok(html.includes(systemSettings.legalMetadata.cookie.version))
  assert.ok(html.includes(systemSettings.legalMetadata.consumer.version))
})
