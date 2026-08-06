/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById, splitPersonName } from '../../site';
import { Context } from 'hono';

export async function renderStaffCustomerEdit(c: Context, user: any, customerId: string, errorMessage?: string) {
  const customer = await getUserById(c, customerId)
  if (!customer || customer.role !== 'CUSTOMER' || (user.role !== 'ADMIN' && customer.staffId !== user.id)) {
    return buildLayout('编辑客户 - 电脑租赁管理系统', '<div class="panel"><h2>客户未找到</h2><p>您请求的客户不存在。</p></div>', user)
  }
  const personName = splitPersonName(customer.name)

  const body = `
    <div class="entity-header"><div class="identity-strip mono"><span>CUSTOMER / ${customer.id}</span><span>EDIT RECORD</span></div><div class="entity-heading"><div><p class="section-code">CUSTOMER RECORD</p><h2>编辑客户</h2><p>${customer.name} · 修改联系方式和退款账户。</p></div><a href="/staff/customers/${customer.id}" class="button button-secondary">返回客户详情</a></div></div>
    ${errorMessage ? `<div class="page-notification page-notification--error">${errorMessage}</div>` : ''}
    <div class="panel record-panel single-column">
      <form method="POST" action="/staff/customers/${customer.id}/edit" class="record-form">
        <section class="form-section"><div class="form-section-title"><span class="mono">01</span><div><h3>基本资料</h3><p>客户身份及联系方式。</p></div></div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">名 / Given name</label>
            <input class="form-control" name="firstName" value="${personName.firstName}" required autocomplete="given-name" />
          </div>
          <div>
            <label class="form-label">姓 / Family name</label>
            <input class="form-control" name="lastName" value="${personName.lastName}" required autocomplete="family-name" />
          </div>
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${customer.email}" readonly />
          </div>
        </div></section><section class="form-section"><div class="form-section-title"><span class="mono">02</span><div><h3>退款账户</h3><p>维护客户提供的银行退款信息；账户余额由管理员管理。</p></div></div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">手机</label>
            <input class="form-control" name="phone" value="${customer.phone ?? ''}" />
          </div>
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="${customer.bsb ?? ''}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${customer.account ?? ''}" />
          </div>
          ${user.role === 'ADMIN' ? `<div><label class="form-label">余额</label><input class="form-control" type="number" step="0.01" name="balance" value="${customer.balance}" /></div>` : ''}
        </div></section><div class="record-actions"><a class="button button-secondary" href="/staff/customers/${customer.id}">取消</a><button class="button button-primary" type="submit">保存修改</button></div>
      </form>
    </div>
  `
  return buildLayout('编辑客户 - 电脑租赁管理系统', body, user)
}
