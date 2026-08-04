/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderStaffCustomerEdit(c: Context, user: any, customerId: string, errorMessage?: string) {
  const customer = await getUserById(c, customerId)
  if (!customer || customer.role !== 'CUSTOMER') {
    return buildLayout('编辑客户 - 电脑租赁管理系统', '<div class="panel"><h2>客户未找到</h2><p>您请求的客户不存在。</p></div>', user)
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>编辑客户 - ${customer.name}</h2><span class="section-note">修改客户基本资料和账户信息。</span></div>
      ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
      <form method="POST" action="/staff/customers/${customer.id}/edit">
        <div class="grid grid-2">
          <div>
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${customer.name}" />
          </div>
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${customer.email}" readonly />
          </div>
        </div>
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
          <div>
            <label class="form-label">余额</label>
            <input class="form-control" type="number" step="0.01" name="balance" value="${customer.balance}" />
          </div>
        </div>
        <div style="margin-top:20px;">
          <button class="button button-primary" type="submit">保存修改</button>
        </div>
      </form>
    </div>
  `
  return buildLayout('编辑客户 - 电脑租赁管理系统', body, user)
}
