/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById, getUsers, sanitizePlainText, splitPersonName } from '../../site';
import { Context } from 'hono';

export async function renderAdminUserEdit(c: Context, user: any, targetUserId: string, errorMessage?: string) {
  const targetUser = await getUserById(c, targetUserId)
  if (!targetUser) {
    return buildLayout('用户未找到 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>您请求的用户不存在。</p><a href="/admin/users" class="button">返回用户列表</a></div>', user)
  }
  const personName = splitPersonName(targetUser.name)
  const allUsers = await getUsers(c)
  const activeStaff = allUsers.filter(account => account.role === 'STAFF' && account.status === 'active' && (account.accountStatus ?? account.account_status ?? 'active') === 'active')
  const accountStatus = targetUser.accountStatus ?? targetUser.account_status ?? (targetUser.status === 'active' ? 'active' : 'inactive')
  const isCurrentAdmin = user.id === targetUser.id && targetUser.role === 'ADMIN'
  const escape = (value: unknown) => sanitizePlainText(value, 200).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const body = `
    <div class="entity-header"><div class="identity-strip mono"><span>USER / ${targetUser.id}</span><span>EDIT RECORD</span></div><div class="entity-heading"><div><p class="section-code">IDENTITY CONTROL</p><h2>编辑用户</h2><p>${targetUser.name} · 修改资料、权限和账户信息。</p></div><a href="/admin/users/${targetUser.id}" class="button button-secondary">返回用户详情</a></div></div>
    <div class="panel record-panel single-column">
      ${errorMessage ? `<div class="alert alert-danger" style="background: var(--danger-light); color: var(--danger); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">${errorMessage}</div>` : ''}
      <form method="POST" action="/admin/users/${targetUser.id}/edit" class="record-form">
        <section class="form-section"><div class="form-section-title"><span class="mono">01</span><div><h3>基本资料</h3><p>姓名、邮箱和联系电话。</p></div></div><div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">名 / Given name</label>
            <input class="form-control" name="firstName" value="${personName.firstName}" required autocomplete="given-name" />
          </div>
          <div class="form-group">
            <label class="form-label">姓 / Family name</label>
            <input class="form-control" name="lastName" value="${personName.lastName}" required autocomplete="family-name" />
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
            <select class="form-control" id="user-role" name="role" ${isCurrentAdmin ? 'disabled' : ''}>
              <option value="CUSTOMER" ${targetUser.role === 'CUSTOMER' ? 'selected' : ''}>客户</option>
              <option value="STAFF" ${targetUser.role === 'STAFF' ? 'selected' : ''}>员工</option>
              <option value="ADMIN" ${targetUser.role === 'ADMIN' ? 'selected' : ''}>管理员</option>
            </select>
            ${isCurrentAdmin ? '<small class="form-text">当前正在使用的管理员账号不能更改角色。</small>' : ''}
          </div>
          <div class="form-group">
            <label class="form-label" for="account-status">账户状态</label>
            <select class="form-control" id="account-status" name="accountStatus" ${isCurrentAdmin ? 'disabled' : ''}>
              <option value="active" ${accountStatus === 'active' ? 'selected' : ''}>正常</option>
              <option value="banned" ${accountStatus === 'banned' ? 'selected' : ''}>已封禁</option>
              <option value="inactive" ${accountStatus === 'inactive' ? 'selected' : ''}>已停用</option>
              <option value="departed" data-staff-only ${accountStatus === 'departed' ? 'selected' : ''}>已离职（员工专属）</option>
            </select>
            <small class="form-text">${isCurrentAdmin ? '当前正在使用的管理员账号不能更改账户状态。' : '非正常状态将立即停止该账户登录。'}</small>
          </div>
          <div class="form-group" id="assigned-staff-group">
            <label class="form-label" for="assigned-staff">绑定员工</label>
            <select class="form-control" id="assigned-staff" name="staffId">
              <option value="">未分配</option>
              ${activeStaff.map(account => `<option value="${escape(account.id)}" ${targetUser.staffId === account.id ? 'selected' : ''}>${escape(account.name)} · ${escape(account.email)}</option>`).join('')}
            </select>
            <small class="form-text">只显示用户管理中状态正常的现有员工。</small>
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
    <script>
      (() => {
        const role = document.getElementById('user-role');
        const staffGroup = document.getElementById('assigned-staff-group');
        const staffSelect = document.getElementById('assigned-staff');
        const departed = document.querySelector('[data-staff-only]');
        const syncRoleFields = () => {
          const isCustomer = role.value === 'CUSTOMER';
          const isStaff = role.value === 'STAFF';
          staffGroup.hidden = !isCustomer;
          staffSelect.disabled = !isCustomer;
          departed.disabled = !isStaff;
          departed.hidden = !isStaff;
          if (!isStaff && departed.selected) document.getElementById('account-status').value = 'inactive';
        };
        role.addEventListener('change', syncRoleFields);
        syncRoleFields();
      })();
    </script>
  `
  return buildLayout('编辑用户 - 电脑租赁管理系统', body, user)
}
