/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrders, getAllContracts, getUsers, getDevices } from '../../site'
import type { Context } from 'hono'

export async function renderStaffRentalsTracking(c: Context, user: any, status?: string, searchTerm?: string) {
  const [allOrders, allContracts, allUsers, allDevices] = await Promise.all([getOrders(c), getAllContracts(c), getUsers(c), getDevices(c)])
  const usersById = new Map(allUsers.map(account => [account.id, account]))
  const devicesById = new Map(allDevices.map(device => [device.id, device]))
  const visibleContracts = user.role === 'ADMIN' ? allContracts : allContracts.filter(contract => (contract.createdBy || contract.created_by) === user.id)
  const visibleOrderIds = new Set(visibleContracts.map(contract => contract.rentalId))
  const visibleOrders = user.role === 'ADMIN' ? allOrders : allOrders.filter(order => visibleOrderIds.has(order.id))

  const rentalStatuses = ['draft', 'pending_approval', 'approved', 'pending_payment', 'paid', 'active', 'pending_pickup', 'pending_return']
  const allStatuses = [...rentalStatuses, 'completed', 'cancelled', 'expiring']
  
  // 根据URL参数筛选订单
  let filteredOrders = visibleOrders
  if (status && allStatuses.includes(status)) {
    filteredOrders = visibleOrders.filter((r: any) => r.status === status)
  } else if (status === 'expiring') {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    filteredOrders = visibleOrders.filter((order: any) => {
      if (order.endDate) {
        const endDate = new Date(order.endDate);
        // 订单状态不是已完成或已取消，并且结束日期在未来7天内
        return order.status !== 'completed' && order.status !== 'cancelled' && endDate > now && endDate <= sevenDaysLater;
      }
      return false;
    });
  }

  const ordersWithDetails = filteredOrders.map((order: any) => ({
    ...order,
    customer: usersById.get(order.userId),
    device: order.deviceId ? devicesById.get(order.deviceId) : null,
  }))

  // 搜索功能
  let finalOrders = ordersWithDetails;
  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim()
    finalOrders = ordersWithDetails.filter((order: any) => {
      return [order.orderNo, order.id, order.customer?.name, order.customer?.email, order.device?.name, order.startDate, order.endDate]
        .filter(Boolean)
        .some((value: any) => String(value).toLowerCase().includes(searchLower))
    })
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>当前租赁中</h2><span class="section-note">追踪租赁中订单，处理到期提醒和归还。</span></div>

      <!-- 筛选按钮 - 和合同页面保持一致的设计 -->
      <h3 style="margin-top: 0; margin-bottom: 16px;">租赁设备管理</h3>
      <div class="filter-tabs" style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="/staff/rentals/tracking" class="button ${!status ? 'button-primary' : 'button-secondary'}">全部订单</a>
        <a href="/staff/rentals/tracking?status=pending_pickup" class="button ${status === 'pending_pickup' ? 'button-primary' : 'button-secondary'}">待拿取</a>
        <a href="/staff/rentals/tracking?status=pending_return" class="button ${status === 'pending_return' ? 'button-primary' : 'button-secondary'}">待归还</a>
        <a href="/staff/rentals/tracking?status=expiring" class="button ${status === 'expiring' ? 'button-primary' : 'button-secondary'}">即将到期</a>
        <a href="/staff/rentals/tracking?status=completed" class="button ${status === 'completed' ? 'button-primary' : 'button-secondary'}">已完成</a>
      </div>
      
      <!-- 搜索功能 -->
      <div class="search-bar" style="margin-bottom: 24px;">
        <form action="/staff/rentals/tracking" method="GET" style="display: flex; gap: 10px;">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索合同编号、订单编号、客户姓名/邮箱/电话..." value="${searchTerm || ''}" style="flex-grow: 1;" />
          ${status ? `<input type="hidden" name="status" value="${status}" />` : ''}
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>

      ${
        finalOrders.length > 0
          ? `
        <table class="table">
          <thead>
            <tr>
              <th>合同编号</th>
              <th>订单编号</th>
              <th>客户</th>
              <th>状态</th>
              <th>租赁日期</th>
              <th>归还日期</th>
              <th>租赁天数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${finalOrders
              .map((order: any) => {
                const contract = visibleContracts.find((ct: any) => ct.rentalId === order.id || ct.rental_id === order.id)
                const hasSignedContract = contract?.status === 'signed'
                const statusText: Record<string, string> = { draft: '草稿', pending_approval: '待审核', approved: '待付款', pending_payment: '待付款', paid: '已付款', active: '当前租赁中', pending_pickup: '待拿取', pending_return: '待归还', completed: '已完成', cancelled: '已取消' };
                const rentalDays = order.startDate && order.endDate ? Math.max(1, Math.ceil((new Date(order.endDate).getTime() - new Date(order.startDate).getTime()) / (1000 * 60 * 60 * 24))) : '-'
                const actionButton = (() => {
                  // 合同已签署
                  if (hasSignedContract) {
                    // 订单状态为待拿取
                    if (order.status === 'paid') {
                      return `<button class="button button-sm button-primary" onclick="window.siteConfirm('确认客户已完成取货吗？确认后订单将变为租赁中。', () => fetch('/staff/orders/${order.id}/pickup', { method: 'POST' }).then((response) => { if (!response.ok) throw new Error('取货确认失败'); window.location.reload(); }).catch((error) => window.alert(error.message)));">已拿取</button>`;
                    }
                    // 订单状态为待归还
                    if (order.status === 'pending_return') {
                      return `<a class="button button-sm button-info" href="/staff/orders/${order.id}/inspection">归还验机</a>`;
                    }
                    // 订单状态为已完成
                    if (order.status === 'completed') return `<a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看订单</a>`;
                    // 其他已签署状态，例如刚签署完成，但订单状态还未更新为pending_pickup
                    return `<a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看订单</a>`;
                   }
                   // 合同未签署或已取消等情况
                   return `<a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看订单</a>`;
                 })();
                return `
                <tr>
                  <td>${contract?.contractNumber ?? '—'}</td>
                  <td>${order.orderNo}</td>
                  <td>${order.customer?.name ?? '待客户填写'}</td>
                  <td>${statusText[order.status] ?? order.status ?? '未知状态'}</td>
                  <td>${order.startDate ?? '—'}</td>
                  <td>${order.endDate ?? '—'}</td>
                  <td>${rentalDays}</td>
                  <td>${actionButton}</td>
                </tr>
              `
              })
              .join('')}
          </tbody>
        </table>
      `
          : '<p>目前没有符合条件的租赁记录。</p>'
      }
    </div>
  `

  return buildLayout('当前租赁中 - 电脑租赁管理系统', body, user)
}
