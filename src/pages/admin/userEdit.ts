/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderAdminUserEdit(c: Context, user: any, targetUserId: string, errorMessage?: string) {
  const targetUser = await getUserById(c, targetUserId)
  if (!targetUser) {
    return buildLayout('用户未找到 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>您请求的用户不存在。</p><a href="/admin/users" class="button">返回用户列表</a></div>', user)
  }

  const body = `
    <div class="entity-header"><div class="identity-strip mono"><span>USER / ${targetUser.id}</span><span>EDIT RECORD</span></div><div class="entity-heading"><div><p class="section-code">IDENTITY CONTROL</p><h2>编辑用户</h2><p>${targetUser.name} · 修改资料、权限和账户信息。</p></div><a href="/admin/users/${targetUser.id}" class="button button-secondary">返回用户详情</a></div></div>
    <div class="panel record-panel single-column">
      ${errorMessage ? `<div class="alert alert-danger" style="background: var(--danger-light); color: var(--danger); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">${errorMessage}</div>` : ''}
      <form method="POST" action="/admin/users/${targetUser.id}/edit" class="record-form">
        <section class="form-section"><div class="form-section-title"><span class="mono">01</span><div><h3>基本资料</h3><p>姓名、邮箱和联系电话。</p></div></div><div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${targetUser.name}" required />
          </div>
          <div class="form-group">
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${targetUser.email}" readonly />
          </div>
        </div></section>
        <section class="form-section"><div class="form-section-title"><span class="mono">02</span><div><h3>账户与退款</h3><p>余额及银行退款资料。</p></div></div><div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">手机</label>
            <input class="form-control" name="phone" value="${targetUser.phone ?? ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="${targetUser.bsb ?? ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">银行账号</label>
            <input class="form-control" name="account_number" value="${targetUser.account_number ?? targetUser.account ?? ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">账户余额 (AUD$)</label>
            <input class="form-control" type="number" step="0.01" name="balance" value="${targetUser.balance ?? 0}" />
          </div>
        </div></section>
        <section class="form-section"><div class="form-section-title"><span class="mono">03</span><div><h3>权限与安全</h3><p>角色调整会立即影响访问范围。</p></div></div><div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">角色</label>
            <select class="form-control" name="role">
              <option value="CUSTOMER" ${targetUser.role === 'CUSTOMER' ? 'selected' : ''}>客户</option>
              <option value="STAFF" ${targetUser.role === 'STAFF' ? 'selected' : ''}>员工</option>
              <option value="ADMIN" ${targetUser.role === 'ADMIN' ? 'selected' : ''}>管理员</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">新密码（留空则不修改）</label>
            <input class="form-control" type="password" name="password" placeholder="输入新密码" />
          </div>
        </div></section>
        <div class="record-actions">
          <button class="button button-primary" type="submit">保存修改</button>
          <a href="/admin/users" class="button button-secondary">取消</a>
        </div>
      </form>
    </div>
  `
  return buildLayout('编辑用户 - 电脑租赁管理系统', body, user)
}
