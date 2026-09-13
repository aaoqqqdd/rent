/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCustomerRiskAssessment, calculateReferralRiskAssessment } from '../src/domain/riskFlags'

const NOW = new Date('2026-09-07T00:00:00Z')

test('risk score is calculated from historical behaviour', () => {
  const result = calculateCustomerRiskAssessment({
    failedPaymentCount: 2,
    overdueOrderCount: 1,
    customerDamageCaseCount: 1,
  }, NOW)
  assert.equal(result.score, 50)
  assert.equal(result.level, 'MEDIUM')
  assert.equal(result.blocked, false)
})

test('risk score at the threshold blocks new rental activity', () => {
  const result = calculateCustomerRiskAssessment({ balance: -1, failedPaymentCount: 3 }, NOW)
  assert.equal(result.score, 60)
  assert.equal(result.level, 'HIGH')
  assert.equal(result.blocked, true)
})

test('high and hard-block risk flags block regardless of score', () => {
  assert.equal(calculateCustomerRiskAssessment({ activeFlags: [{ flag_type: 'MANUAL_REVIEW', severity: 'HIGH', status: 'ACTIVE' }] }, NOW).blocked, true)
  assert.equal(calculateCustomerRiskAssessment({ activeFlags: [{ flag_type: 'CHARGEBACK', severity: 'LOW', status: 'ACTIVE' }] }, NOW).blocked, true)
})

test('expired timestamps do not clear active flags; only resolution does', () => {
  const result = calculateCustomerRiskAssessment({
    activeFlags: [
      { flag_type: 'CHARGEBACK', severity: 'HIGH', status: 'ACTIVE', expires_at: '2026-01-01 00:00:00' },
      { flag_type: 'FRAUD_SUSPECTED', severity: 'HIGH', status: 'RESOLVED', expires_at: null },
    ],
  }, NOW)
  assert.equal(result.score, 40)
  assert.equal(result.blocked, true)
})

test('high referral risk goes to manual review', () => {
  const result = calculateReferralRiskAssessment({
    customerRiskScore: 25,
    accountAgeDays: 3,
    repeatedDeviceCount: 1,
  })
  assert.equal(result.score, 60)
  assert.equal(result.level, 'HIGH')
  assert.equal(result.requiresReview, true)
})

test('shared IP is not a referral risk factor', () => {
  const result = calculateReferralRiskAssessment({ customerRiskScore: 0, accountAgeDays: 90, referralCount: 1 })
  assert.equal(result.score, 0)
  assert.equal(result.requiresReview, false)
})

test('a hard-block customer flag also requires referral review below the score threshold', () => {
  const result = calculateReferralRiskAssessment({ customerRiskScore: 30, customerRiskBlocked: true })
  assert.equal(result.requiresReview, true)
})
