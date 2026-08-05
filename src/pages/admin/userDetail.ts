/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderAdminUserDetail(c: Context, user: any, targetUserId: string) {
  const targetUser = await getUserById(c, targetUserId);

  if (!targetUser) {
    return buildLayout('用户未找到 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>您请求的用户不存在。</p><a href="/admin/users" class="button">返回用户列表</a></div>', user);
  }

  const roleMap: Record<string, string> = {
    'ADMIN': '管理员',
    'STAFF': '员工',
    'CUSTOMER': '客户'
  };

  const statusMap: Record<string, string> = {
    'active': '正常',
    'inactive': '禁用'
  };

  const body = `
    <div class="entity-header"><div class="identity-strip mono"><span>USER / ${targetUser.id}</span><span>${targetUser.role}</span></div><div class="entity-heading"><div><p class="section-code">IDENTITY RECORD</p><h2>${targetUser.name}</h2><p>${targetUser.email}</p></div><div class="entity-heading-actions"><a href="/admin/users" class="button button-secondary">返回列表</a><a href="/admin/users/${targetUser.id}/edit" class="button">编辑用户</a></div></div></div>
    <div class="panel record-panel single-column"><div class="record-grid">
        <section class="record-section"><p class="section-code">ACCOUNT</p><h3>基本信息</h3><dl class="data-list">
          <div><dt>用户 ID</dt><dd class="mono">${targetUser.id}</dd></div><div><dt>姓名</dt><dd>${targetUser.name}</dd></div><div><dt>邮箱</dt><dd>${targetUser.email}</dd></div><div><dt>电话</dt><dd>${targetUser.phone || '未填写'}</dd></div><div><dt>角色</dt><dd><span class="badge ${targetUser.role === 'ADMIN' ? 'badge-danger' : targetUser.role === 'STAFF' ? 'badge-warning' : 'badge-info'}">${roleMap[targetUser.role] || targetUser.role}</span></dd></div><div><dt>状态</dt><dd><span class="badge ${targetUser.status === 'active' ? 'badge-success' : 'badge-danger'}">${statusMap[targetUser.status || 'active']}</span></dd></div><div><dt>注册时间</dt><dd>${targetUser.createdAt ? new Date(targetUser.createdAt).toLocaleString('zh-CN') : '-'}</dd></div>
        </dl></section>
        <section class="record-section"><p class="section-code">FINANCE</p><h3>账户信息</h3><dl class="data-list"><div><dt>账户余额</dt><dd class="mono">AUD$${(targetUser.balance || 0).toFixed(2)}</dd></div><div><dt>佣金余额</dt><dd class="mono">AUD$${(targetUser.commissionBalance || 0).toFixed(2)}</dd></div>${targetUser.role === 'CUSTOMER' ? `<div><dt>BSB</dt><dd class="mono">${targetUser.bsb || '未填写'}</dd></div><div><dt>银行账号</dt><dd class="mono">${targetUser.accountNumber || targetUser.account_number || targetUser.account || '未填写'}</dd></div>` : ''}</dl></section>
      </div>
      <div class="record-actions"><a href="/admin/orders?userId=${targetUser.id}" class="button button-secondary">查看关联订单</a></div>
    </div>
  `;

  return buildLayout('用户详情 - 电脑租赁管理系统', body, user);
}
