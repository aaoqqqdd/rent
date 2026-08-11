/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */

import type { Context } from 'hono'
import { buildLayout, getContractByOrderId, getOrderById } from '../../site'

export async function renderGuestAccount(c: Context, user: any, message = '', type: 'error' | 'success' = 'error') {
  const order = user.guestOrderId ? await getOrderById(c, user.guestOrderId) : null
  const contract = order ? await getContractByOrderId(c, order.id) : null
  const body = `<div class="entity-header guest-account-header"><div class="identity-strip mono"><span>GUEST ACCESS</span><span>有效至 ${user.guestExpiresAt || order?.endDate || '租期结束'}</span></div><div class="entity-heading"><div><p class="section-code">TEMPORARY ACCOUNT</p><h2>访客合同中心</h2><p>此账户仅用于本次租赁的付款、合同和收据。</p></div><span class="badge badge-warning">访客账户</span></div></div>
  ${message ? `<div class="page-notification page-notification--${type === 'success' ? 'success' : 'error'}">${message}</div>` : ''}
  <div class="grid grid-2 guest-workspace"><section class="panel"><div class="section-title"><h3>本次租赁</h3><span class="mono">${order?.orderNo || '付款后生成'}</span></div>${order ? `<p>${order.startDate} 至 ${order.endDate}</p><div class="record-actions"><a class="button" href="/customer/orders/${order.id}">查看订单与付款</a>${contract ? `<a class="button button-secondary" href="/customer/orders/${order.id}">查看订单详情</a>` : ''}<a class="button button-secondary" href="/orders/${order.id}/invoice">合同与收据</a></div>` : '<p>未找到关联订单，请联系工作人员。</p>'}</section>
  <section class="panel"><div class="section-title"><h3>升级正式账户</h3><span class="section-note">保留当前邮箱</span></div><p>设置新密码后将解除访客限制，账户不会在租期结束时失效。</p><form method="post" action="/customer/guest/upgrade"><div class="form-group"><label class="form-label" for="newPassword">新密码</label><input class="form-control" id="newPassword" name="newPassword" type="password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s])\\S{8,}" autocomplete="new-password" required><small class="form-text">至少 8 位，包含字母、数字和符号。</small></div><div class="form-group"><label class="form-label" for="confirmPassword">确认新密码</label><input class="form-control" id="confirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></div><button class="button" type="submit">升级为正式账户</button></form></section></div>`
  return buildLayout('访客合同中心', body, user)
}
