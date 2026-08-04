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
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>用户详情 - ${targetUser.name}</h2>
          <p style="color: var(--text-secondary); margin-top: 4px; font-size: 0.9rem;">查看和管理用户的详细信息。</p>
        </div>
        <a href="/admin/users" class="button button-secondary">← 返回列表</a>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div>
          <h3>基本信息</h3>
          <p><strong>ID:</strong> <span style="font-family: monospace;">${targetUser.id}</span></p>
          <p><strong>姓名:</strong> ${targetUser.name}</p>
          <p><strong>邮箱:</strong> ${targetUser.email}</p>
          <p><strong>电话:</strong> ${targetUser.phone || '未填写'}</p>
          <p><strong>角色:</strong> <span class="badge ${targetUser.role === 'ADMIN' ? 'badge-danger' : targetUser.role === 'STAFF' ? 'badge-warning' : 'badge-info'}">${roleMap[targetUser.role] || targetUser.role}</span></p>
          <p><strong>状态:</strong> <span class="badge ${targetUser.status === 'active' ? 'badge-success' : 'badge-danger'}">${statusMap[targetUser.status || 'active']}</span></p>
          <p><strong>余额:</strong> AUD$${(targetUser.balance || 0).toFixed(2)}</p>
          <p><strong>佣金余额:</strong> AUD$${(targetUser.commissionBalance || 0).toFixed(2)}</p>
          <p><strong>注册时间:</strong> ${targetUser.createdAt ? new Date(targetUser.createdAt).toLocaleString('zh-CN') : '-'}</p>
        </div>
        ${targetUser.role === 'CUSTOMER' ? `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px; border: 1px solid #f59e0b;">
          <h3 style="margin-top: 0; color: #92400e;">💳 客户银行账户信息</h3>
          <p><strong>BSB码:</strong> ${targetUser.bsb || '未填写'}</p>
          <p><strong>银行账号:</strong> ${targetUser.accountNumber || '未填写'}</p>
          <p style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.5); border-radius: 8px; color: #78350f;">
            <small>此信息为客户银行账户，退款时可使用此信息转账。</small>
          </p>
        </div>
        ` : ''}
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border);">
        <h3>快捷操作</h3>
        <div style="display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap;">
          <a href="/admin/users/${targetUser.id}/edit" class="button">✏️ 编辑用户</a>
          <a href="/admin/orders?userId=${targetUser.id}" class="button button-secondary">📋 查看关联订单</a>
        </div>
      </div>
    </div>
  `;

  return buildLayout('用户详情 - 电脑租赁管理系统', body, user);
}
