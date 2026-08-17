/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrdersForUser, getDeviceById, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderCustomerRentals(c: Context, user: any) {
  const rentals = await getOrdersForUser(c, user.id);

  const statusMap: Record<string, string> = {
    'pending_approval': '待处理',
    'pending': '待处理',
    'approved': '租赁已确认，等待开始',
    'pending_payment': '待处理',
    'awaiting_signature': '待签合同',
    'pending_pickup': '待取货',
    'pending_return': '待归还',
    'paid': '租赁已确认，等待开始',
    'active': '租赁中',
    'extended': '已延期 / 租赁中',
    'overdue': '已逾期',
    'suspended': '已暂停',
    'returned': '已归还',
    'completed': '已完成',
    'cancelled': '已取消'
  };

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>我的租赁</h2>
        <span class="section-note">查看您的当前和历史租赁记录。</span>
      </div>

      <h3>📦 当前租赁中</h3>
      ${rentals.filter(r => r.status === 'active').length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>设备名称</th>
              <th>租期</th>
              <th>日租金</th>
              <th>押金</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${await Promise.all(rentals.filter(r => r.status === 'active').map(async (rental: any) => {
              const device = await getDeviceById(c, rental.deviceId ?? rental.device_id);
              return `
                <tr>
                  <td><strong>${device?.name ?? '未知设备'}</strong></td>
                  <td>${rental.startDate ?? rental.start_date ?? '—'} 至 ${rental.endDate ?? rental.end_date ?? '—'}</td>
                  <td>${formatCurrency(device?.pricePerDay ?? device?.price_per_day ?? 0)}</td>
                  <td>${formatCurrency(rental.depositAmount ?? rental.deposit_amount ?? 0)}</td>
                  <td><span class="badge badge-primary">${statusMap[rental.status] || rental.status}</span></td>
                </tr>
              `;
            })).then(results => results.join(''))}
          </tbody>
        </table>
      ` : '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">您当前没有正在租赁的设备。</p>'}

      <h3 style="margin-top: 32px;">📋 租赁历史记录</h3>
      ${rentals.filter(r => r.status !== 'active').length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>设备名称</th>
              <th>租期</th>
              <th>总租金</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${await Promise.all(rentals.filter(r => r.status !== 'active').map(async (rental: any) => {
              const device = await getDeviceById(c, rental.deviceId ?? rental.device_id);
              return `
                <tr>
                  <td><strong>${device?.name ?? '未知设备'}</strong></td>
                  <td>${rental.startDate ?? rental.start_date ?? '—'} 至 ${rental.endDate ?? rental.end_date ?? '—'}</td>
                  <td>${formatCurrency(rental.totalAmount ?? rental.total_amount ?? 0)}</td>
                  <td><span class="badge badge-info">${statusMap[rental.status] || rental.status}</span></td>
                  <td><a class="link-button" href="/customer/orders/${rental.id}">查看详情</a></td>
                </tr>
              `;
            })).then(results => results.join(''))}
          </tbody>
        </table>
      ` : '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">您还没有租赁历史记录。</p>'}
    </div>
  `;

  return buildLayout('我的租赁 - 电脑租赁管理系统', body, user);
}
