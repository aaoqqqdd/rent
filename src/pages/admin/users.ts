/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout } from '../../site';

export async function renderAdminUsers(user: any, c: any) {
  const { getUsersAsync } = await import('../../site')
  const allUsers = await getUsersAsync(c);

  const roleMap: Record<string, { text: string; class: string }> = {
    'ADMIN': { text: '管理员', class: 'badge-danger' },
    'STAFF': { text: '员工', class: 'badge-warning' },
    'CUSTOMER': { text: '客户', class: 'badge-info' }
  };

  const statusMap: Record<string, { text: string; class: string }> = {
    'active': { text: '正常', class: 'badge-success' },
    'inactive': { text: '禁用', class: 'badge-danger' }
  };

  const body = `
    <div class="panel">
      <div class="section-title">
        <div>
          <h2>用户管理</h2>
          <p style="color: var(--text-secondary); margin-top: 4px; font-size: 0.9rem;">查看、添加、编辑和管理所有系统用户。</p>
        </div>
        <a href="/admin/users/new" class="button">添加新用户</a>
      </div>
      ${allUsers.length === 0 ? `
        <div style="text-align: center; padding: 48px 24px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">👥</div>
          <h3>暂无用户</h3>
          <p>点击右上角"添加新用户"创建用户</p>
        </div>
      ` : `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>姓名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>余额</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${allUsers.map(u => {
            const role = roleMap[u.role] || { text: u.role, class: 'badge-info' };
            const status = statusMap[u.status || 'active'] || { text: u.status, class: 'badge-info' };
            return `
              <tr>
                <td style="font-family: monospace; font-size: 0.85rem;">${u.id}</td>
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge ${role.class}">${role.text}</span></td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>AUD$${parseFloat(String(u.balance || 0)).toFixed(2)}</td>
                <td>${u.createdAt
                  ? new Date(u.createdAt as string).toLocaleDateString('zh-CN')
                  : '-'
                }</td>
                <td>
                  <a class="link-button" href="/admin/users/${u.id}">查看</a>
                  <a class="link-button" href="/admin/users/${u.id}/edit">编辑</a>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      `}
    </div>
  `;

  return buildLayout('用户管理 - 电脑租赁管理系统', body, user);
}
