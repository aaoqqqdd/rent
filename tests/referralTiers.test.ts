/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { URL } from 'node:url'
import { calculateReferralRent, calculateReferralTier, normalizeReferralSettings, validateReferralSettings } from '../src/domain/referral'
import { getSystemSettings, invalidateSystemSettingsCache, loadSystemSettingsFromDB } from '../src/site'
import { handleSaveAdminSettings } from '../src/actions/admin/saveSettings'
import { getEffectiveReferralCount, syncReferralOrderState } from '../src/services/referral'
import { renderAdminSettings } from '../src/pages/admin/settings'
import { renderCustomerReferral } from '../src/pages/customer/referral'
import { extractInlineScripts } from './helpers'

const rules = { defaultRate: 15.5, levelLimit: 3, referralsPerLevel: 2, rateIncreasePerLevel: 2.5, settlementPeriod: 30 }

test('referral tiers start at level 1, upgrade at each threshold, and add percentage points', () => {
  assert.deepEqual(calculateReferralTier(0, rules), { level: 1, rate: 15.5, effectiveReferrals: 0, referralsToNextLevel: 2 })
  assert.equal(calculateReferralTier(1, rules).rate, 15.5)
  assert.deepEqual(calculateReferralTier(2, rules), { level: 2, rate: 18, effectiveReferrals: 2, referralsToNextLevel: 2 })
  assert.equal(calculateReferralTier(3, rules).referralsToNextLevel, 1)
  assert.deepEqual(calculateReferralTier(4, rules), { level: 3, rate: 20.5, effectiveReferrals: 4, referralsToNextLevel: 0 })
  assert.equal(calculateReferralTier(100, rules).rate, 20.5)
  assert.equal(calculateReferralTier(100, { ...rules, defaultRate: 99 }).rate, 100)
  assert.equal(calculateReferralTier(100, { ...rules, levelLimit: 1 }).rate, 15.5)
})

test('referral commission excludes deposits, delivery and service fees from discounted rent', () => {
  assert.equal(calculateReferralRent({ totalAmount: 300, depositAmount: 200, deliveryFee: 15, serviceFee: 5 }), 80)
  assert.equal(calculateReferralRent({ totalAmount: 200, depositAmount: 200 }), 0)
  assert.equal(calculateReferralRent({ totalAmount: 50, depositAmount: 200 }), 0)
  assert.equal(calculateReferralRent({ totalAmount: 80 }), 80)
})

test('legacy referral settings retain the saved rate and use a zero tier bonus', () => {
  const settings = normalizeReferralSettings({ defaultRate: 15, levelLimit: 3, settlementPeriod: 45 })
  assert.equal(settings.referralsPerLevel, 5)
  assert.equal(settings.rateIncreasePerLevel, 0)
  assert.equal(calculateReferralTier(100, settings).rate, 15)
  assert.equal(settings.settlementPeriod, 45)
  assert.equal(normalizeReferralSettings({ levelLimit: 0 }).levelLimit, 1)
})

test('invalid referral rates and noninteger thresholds are rejected', () => {
  for (const invalid of [{ defaultRate: -1 }, { defaultRate: Infinity }, { rateIncreasePerLevel: 101 }, { rateIncreasePerLevel: NaN }, { referralsPerLevel: 0 }, { referralsPerLevel: 1.5 }, { levelLimit: -1 }, { settlementPeriod: 0 }]) {
    assert.throws(() => validateReferralSettings({ ...rules, ...invalid }))
  }
  assert.doesNotThrow(() => validateReferralSettings(rules))
})

function setup(t: any) {
  const sqlite = new DatabaseSync(':memory:')
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
  }
  const previous = { ...getSystemSettings().referralSettings }
  const db = {
    prepare(sql: string) {
      let values: any[] = []
      const query = {
        bind(...input: any[]) { values = input; return query },
        async first() { return sqlite.prepare(sql).get(...values) || null },
        async all() { return { results: sqlite.prepare(sql).all(...values) } },
        async run() { return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } } },
      }
      return query
    },
    async batch(statements: any[]) {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      return results
    },
  }
  const context = { env: { RENT: db }, req: { url: 'https://rent.example.test/admin/settings/save', text: async () => '{}' }, json: (data: unknown) => Response.json(data) } as any
  invalidateSystemSettingsCache()
  t.after(() => { getSystemSettings().referralSettings = previous; invalidateSystemSettingsCache(); sqlite.close() })
  return { sqlite, context }
}

test('admin can save and reload tier settings; invalid saves do not overwrite them', async t => {
  const { sqlite, context } = setup(t)
  await loadSystemSettingsFromDB(context)
  assert.equal(getSystemSettings().referralSettings.rateIncreasePerLevel, 0)
  context.req.text = async () => JSON.stringify({ referralSettings: rules })
  assert.equal((await handleSaveAdminSettings(context)).status, 200)
  invalidateSystemSettingsCache()
  await loadSystemSettingsFromDB(context)
  assert.deepEqual(getSystemSettings().referralSettings, rules)
  for (const invalid of [{ referralsPerLevel: 0 }, { referralsPerLevel: 2.5 }, { rateIncreasePerLevel: -1 }, { defaultRate: 101 }]) {
    context.req.text = async () => JSON.stringify({ referralSettings: { ...rules, ...invalid } })
    await assert.rejects(handleSaveAdminSettings(context))
  }
  const saved = sqlite.prepare("SELECT value FROM systemSettings WHERE key = 'referralSettings'").get() as any
  assert.deepEqual(JSON.parse(saved.value), rules)
  const html = renderAdminSettings({ id: 'admin', role: 'ADMIN' })
  assert.match(html, /id="referralsPerLevel"[^>]*value="2"/)
  assert.match(html, /id="referralRateIncrease"[^>]*value="2.5"/)
  for (const script of extractInlineScripts(html)) assert.doesNotThrow(() => new Function(script))
})

test('paid completed referrals earn rent-only tiered rewards once per friend', async t => {
  const { sqlite, context } = setup(t)
  getSystemSettings().referralSettings = { ...rules }
  sqlite.exec(`
    INSERT INTO users (id, name, email, role, status, referral_code, created_at) VALUES
      ('referrer', '推荐人', 'referrer@example.test', 'CUSTOMER', 'active', 'REF123', '2020-01-01'),
      ('friend1', '好友甲', 'friend1@example.test', 'CUSTOMER', 'active', NULL, '2020-01-01'),
      ('friend2', '好友乙', 'friend2@example.test', 'CUSTOMER', 'active', NULL, '2020-01-01');
    INSERT INTO devices (id, name, model, serialNumber, pricePerDay, depositAmount, status) VALUES
      ('device', '电脑', 'Laptop', 'REF-SN', 20, 200, 'available');
    INSERT INTO orders (id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount, deliveryFee, serviceFee, status, payment_status, rental_status) VALUES
      ('order1', 'friend1', 'device', '2026-01-01', '2026-01-05', 4, 300, 200, 15, 5, 'completed', 'PAID', 'COMPLETED'),
      ('order2', 'friend2', 'device', '2026-02-01', '2026-02-05', 4, 300, 200, 15, 5, 'completed', 'UNPAID', 'COMPLETED'),
      ('repeat', 'friend1', 'device', '2026-03-01', '2026-03-05', 4, 300, 200, 15, 5, 'completed', 'PAID', 'COMPLETED');
    INSERT INTO referrals (id, referral_number, referrer_customer_id, referee_customer_id, status) VALUES
      ('ref1', 'REF-1', 'referrer', 'friend1', 'REGISTERED'),
      ('ref2', 'REF-2', 'referrer', 'friend2', 'REGISTERED');
  `)
  await syncReferralOrderState(context, 'order2', 'COMPLETED')
  assert.equal(await getEffectiveReferralCount(context, 'referrer'), 0)
  await syncReferralOrderState(context, 'order1', 'COMPLETED')
  assert.equal((sqlite.prepare("SELECT reward_amount FROM referral_rewards WHERE order_id = 'order1'").get() as any).reward_amount, 12.4)
  assert.equal(await getEffectiveReferralCount(context, 'referrer'), 1)
  sqlite.exec("UPDATE orders SET payment_status = 'PAID' WHERE id = 'order2'")
  await syncReferralOrderState(context, 'order2', 'COMPLETED')
  assert.equal((sqlite.prepare("SELECT reward_amount FROM referral_rewards WHERE order_id = 'order2'").get() as any).reward_amount, 14.4)
  assert.equal(await getEffectiveReferralCount(context, 'referrer'), 2)
  // Retries and another order from the same friend cannot reprice an old reward.
  getSystemSettings().referralSettings.defaultRate = 50
  await syncReferralOrderState(context, 'order1', 'COMPLETED')
  await syncReferralOrderState(context, 'repeat', 'ACTIVE')
  await syncReferralOrderState(context, 'repeat', 'COMPLETED')
  assert.equal((sqlite.prepare('SELECT COUNT(*) AS count FROM referral_rewards').get() as any).count, 2)
  assert.equal((sqlite.prepare("SELECT qualifying_order_id FROM referrals WHERE id = 'ref1'").get() as any).qualifying_order_id, 'order1')
  assert.equal((sqlite.prepare("SELECT reward_amount FROM referral_rewards WHERE order_id = 'order1'").get() as any).reward_amount, 12.4)
  getSystemSettings().referralSettings = { ...rules }
  const html = await renderCustomerReferral(context, { id: 'referrer', role: 'CUSTOMER' })
  assert.match(html, /当前推荐等级<\/h3><p class="text-large">2</)
  assert.match(html, /当前租金分成比例<\/h3><p class="text-large">18%</)
  assert.match(html, /距下一级还需 <strong>2<\/strong>/)
  // Withdrawals may split rewards; one friend still contributes one count.
  sqlite.exec(`INSERT INTO referral_rewards (id, reward_number, referral_id, customer_id, order_id, reward_amount, status) VALUES ('split', 'RRW-SPLIT', 'ref1', 'referrer', 'order1', 1, 'AVAILABLE')`)
  assert.equal(await getEffectiveReferralCount(context, 'referrer'), 2)
  sqlite.exec("UPDATE referral_rewards SET status = 'CANCELLED' WHERE referral_id = 'ref1'")
  assert.equal(await getEffectiveReferralCount(context, 'referrer'), 1)
  sqlite.exec("UPDATE orders SET rental_status = 'ACTIVE' WHERE id = 'order2'")
  assert.equal(await getEffectiveReferralCount(context, 'referrer'), 0)
})
