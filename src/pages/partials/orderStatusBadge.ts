/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 订单状态统一中文标签 + badge 颜色。纯函数、无副作用、无依赖，便于页面与测试共用。
// 未知状态不抛错：标签回落到原值（空则「未知」），颜色回落 badge-neutral。

export interface OrderStatusBadge {
  label: string
  badgeClass: string
}

const ORDER_STATUS_BADGES: Record<string, OrderStatusBadge> = {
  pending: { label: '待处理', badgeClass: 'badge-warning' },
  pending_approval: { label: '待审核', badgeClass: 'badge-warning' },
  pending_payment: { label: '待付款', badgeClass: 'badge-warning' },
  awaiting_signature: { label: '待签合同', badgeClass: 'badge-warning' },
  approved: { label: '已审核，等待签署/付款', badgeClass: 'badge-info' },
  paid: { label: '租赁已确认，等待开始', badgeClass: 'badge-info' },
  pending_pickup: { label: '待取货', badgeClass: 'badge-info' },
  active: { label: '租赁中', badgeClass: 'badge-success' },
  extended: { label: '已延期（租赁中）', badgeClass: 'badge-success' },
  overdue: { label: '已逾期', badgeClass: 'badge-danger' },
  suspended: { label: '已暂停', badgeClass: 'badge-warning' },
  pending_return: { label: '待归还', badgeClass: 'badge-info' },
  returned: { label: '已归还', badgeClass: 'badge-info' },
  completed: { label: '已完成', badgeClass: 'badge-neutral' },
  cancelled: { label: '已取消', badgeClass: 'badge-danger' },
}

/** 订单状态码 → 中文标签 + badge 类名。未知状态回落到原值并给 badge-neutral。 */
export function orderStatusBadge(status: unknown): OrderStatusBadge {
  const key = String(status ?? '').trim().toLowerCase()
  const known = ORDER_STATUS_BADGES[key]
  if (known) return known
  return { label: key || '未知', badgeClass: 'badge-neutral' }
}

/** 订单状态中文标签（带兜底）。 */
export function orderStatusLabel(status: unknown): string {
  return orderStatusBadge(status).label
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** 直接渲染成中文 badge 片段；标签始终转义，可安全插入模板字符串。 */
export function renderOrderStatusBadge(status: unknown): string {
  const { label, badgeClass } = orderStatusBadge(status)
  return `<span class="badge ${badgeClass}">${escapeHtml(label)}</span>`
}
