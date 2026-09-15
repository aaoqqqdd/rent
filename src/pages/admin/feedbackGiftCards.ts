/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText } from '../../site'

export function renderAdminFeedbackGiftCards(user: any, cards: any[] = []) {
  const rows = cards.map(card => `<tr><td>${sanitizePlainText(card.brand, 80)}</td><td class="mono">${card.status === 'AVAILABLE' ? sanitizePlainText(card.code, 160) : '已发放'}</td><td>${card.amount == null ? '—' : `AUD$${Number(card.amount).toFixed(2)}`}</td><td>${card.status === 'AVAILABLE' ? '可发放' : card.status === 'ISSUED' ? '已发放' : '已作废'}</td><td>${sanitizePlainText(card.created_at, 40)}</td></tr>`).join('') || '<tr><td colspan="5">暂无礼品卡库存</td></tr>'
  const body = `<div class="page-header"><div><p class="section-code">TALLY / REWARDS</p><h2>反馈礼品卡库存</h2><p>录入外部礼品卡兑换码，客户提交反馈后系统按先进先出自动发放。</p></div><a class="button button-secondary" href="/admin/settings">返回系统设置</a></div>
    <section class="panel"><h3>录入礼品卡</h3><form method="post" action="/admin/feedback-gift-cards" class="grid grid-2"><input class="form-control" name="brand" maxlength="80" required placeholder="品牌，例如：Amazon"><input class="form-control" name="code" maxlength="160" required placeholder="礼品卡兑换码"><input class="form-control" name="amount" type="number" min="0" step="0.01" placeholder="面值（可选）"><button class="button button-primary" type="submit">加入库存</button></form></section>
    <section class="panel"><div class="section-title"><h3>库存列表</h3><span class="section-note">兑换码仅对管理员显示</span></div><div class="table-wrapper"><table><thead><tr><th>品牌</th><th>兑换码</th><th>面值</th><th>状态</th><th>录入时间</th></tr></thead><tbody>${rows}</tbody></table></div></section>`
  return buildLayout('反馈礼品卡库存 - PC Rental', body, user)
}
