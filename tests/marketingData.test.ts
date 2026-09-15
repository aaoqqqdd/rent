/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { renderAdminMarketingData } from '../src/pages/admin/marketingData'

test('marketing data page shows opted-out customers and campaign delivery metrics', () => {
  const html = renderAdminMarketingData({ id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' }, {
    summary: { totalCustomers: 12, activeWithEmail: 10, sendableCustomers: 8, optedOutCustomers: 2, campaignCount: 3, recipientCount: 20, sentCount: 18, failedCount: 2 },
    optedOutCustomers: [{ id: 'customer-1', name: '退订客户', email: 'opted@example.com', status: 'active', marketing_opt_out_at: '2026-09-14 01:02:03', campaign_count: 2, last_marketing_sent_at: '2026-09-10 01:02:03' }],
    campaigns: [{ id: 'campaign-1', name: '春季活动', subject: '活动主题', status: 'SENT', recipient_count: 10, sent_count: 9, failed_count: 1, created_at: '2026-09-01 01:02:03' }],
  })
  assert.match(html, /营销数据/)
  assert.match(html, /已取消订阅的客户/)
  assert.match(html, /opted@example.com/)
  assert.match(html, /春季活动/)
  assert.match(html, /90\.0%/)
})
