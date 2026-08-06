/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */

import { buildLayout } from '../../site'

export function renderStaffCustomerNew(user: any, errorMessage?: string) {
  const body = `
    <div class="entity-header"><div class="identity-strip mono"><span>CUSTOMER / NEW</span><span>STAFF RECORD</span></div><div class="entity-heading"><div><p class="section-code">CUSTOMER CONTROL</p><h2>创建客户账户</h2><p>建立客户登录身份和联系方式。</p></div><a href="/staff/customers" class="button button-secondary">返回客户列表</a></div></div>
    <div class="panel record-panel single-column">
      ${errorMessage ? `<div class="alert alert-danger">${errorMessage}</div>` : ''}
      <form method="POST" action="/staff/customers/new" class="record-form">
        <section class="form-section"><div class="form-section-title"><span class="mono">01</span><div><h3>客户资料</h3><p>名和姓需要分别填写。</p></div></div><div class="grid grid-2">
          <div class="form-group"><label class="form-label" for="firstName">名 / Given name</label><input class="form-control" id="firstName" name="firstName" required autocomplete="given-name"></div>
          <div class="form-group"><label class="form-label" for="lastName">姓 / Family name</label><input class="form-control" id="lastName" name="lastName" required autocomplete="family-name"></div>
          <div class="form-group"><label class="form-label" for="email">邮箱</label><input class="form-control" type="email" id="email" name="email" required autocomplete="email"></div>
          <div class="form-group"><label class="form-label" for="phone">电话</label><input class="form-control" id="phone" name="phone" autocomplete="tel"></div>
          <div class="form-group"><label class="form-label" for="password">初始密码</label><input class="form-control" type="password" id="password" name="password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s])\\S{8,}" title="至少 8 位，并同时包含字母、数字和符号" placeholder="至少 8 位，包含字母、数字和符号" required autocomplete="new-password"></div>
        </div></section>
        <div class="record-actions"><a href="/staff/customers" class="button button-secondary">取消</a><button class="button button-primary" type="submit">创建客户</button></div>
      </form>
    </div>`
  return buildLayout('创建客户账户 - 电脑租赁管理系统', body, user)
}
