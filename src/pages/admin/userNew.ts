/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */

import { buildLayout } from '../../site'

export function renderAdminUserNew(user: any) {
  const body = `
    <div class="entity-header">
      <div class="identity-strip mono"><span>USER / NEW</span><span>ACCESS RECORD</span></div>
      <div class="entity-heading"><div><p class="section-code">IDENTITY CONTROL</p><h2>添加新用户</h2><p>创建登录身份并分配系统权限。</p></div><a href="/admin/users" class="button button-secondary">返回用户列表</a></div>
    </div>
    <div class="panel record-panel">
      <aside class="role-guide">
        <p class="section-code">ROLE GUIDE</p><h3>角色权限</h3>
        <dl><div><dt>CUSTOMER</dt><dd>租赁设备并管理自己的订单</dd></div><div><dt>STAFF</dt><dd>处理订单、合同和设备</dd></div><div><dt>ADMIN</dt><dd>管理用户、财务及系统设置</dd></div></dl>
      </aside>
      <form method="POST" action="/admin/users/new" class="record-form">
        <section class="form-section"><div class="form-section-title"><span class="mono">01</span><div><h3>账户资料</h3><p>用于登录和识别用户。</p></div></div><div class="grid grid-2">
          <div class="form-group"><label class="form-label" for="firstName">名 / Given name</label><input class="form-control" type="text" id="firstName" name="firstName" required autocomplete="given-name"></div>
          <div class="form-group"><label class="form-label" for="lastName">姓 / Family name</label><input class="form-control" type="text" id="lastName" name="lastName" required autocomplete="family-name"></div>
          <div class="form-group"><label class="form-label" for="email">邮箱地址</label><input class="form-control" type="email" id="email" name="email" required autocomplete="email" placeholder="name@example.com"></div>
          <div class="form-group"><label class="form-label" for="password">登录密码</label><input class="form-control" type="password" id="password" name="password" required autocomplete="new-password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s])\\S{8,}" title="至少 8 位，并同时包含字母、数字和符号" placeholder="至少 8 位，包含字母、数字和符号"></div>
        </div></section>
        <section class="form-section"><div class="form-section-title"><span class="mono">02</span><div><h3>权限与状态</h3><p>决定用户可以访问的工作区。</p></div></div><div class="grid grid-2">
          <div class="form-group"><label class="form-label" for="role">用户角色</label><select class="form-control" id="role" name="role"><option value="CUSTOMER" selected>客户 / CUSTOMER</option><option value="STAFF">员工 / STAFF</option><option value="ADMIN">管理员 / ADMIN</option></select></div>
          <div class="form-group"><label class="form-label" for="status">账号状态</label><select class="form-control" id="status" name="status"><option value="active" selected>正常 / ACTIVE</option><option value="inactive">禁用 / INACTIVE</option></select></div>
        </div></section>
        <div class="record-actions"><a href="/admin/users" class="button button-secondary">取消</a><button type="submit" class="button button-primary">创建用户</button></div>
      </form>
    </div>`
  return buildLayout('添加新用户 - 电脑租赁管理系统', body, user)
}
