import { buildLayout, formatCurrency, getOrdersAsync } from '../../site'
import type { Context } from 'hono'

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))

export async function getRevenueData(c: Context) {
  const [orders, refundsResult, withdrawalsResult] = await Promise.all([
    getOrdersAsync(c),
    c.env.RENT.prepare("SELECT id, order_id, refund_amount, type, created_at FROM payment_refunds WHERE status = 'succeeded' ORDER BY created_at DESC").all(),
    c.env.RENT.prepare("SELECT id, user_id, amount, status, requested_at, processed_at FROM commission_withdrawals WHERE status = 'completed' ORDER BY processed_at DESC, requested_at DESC").all(),
  ])
  return { orders: orders as any[], refunds: (refundsResult.results || []) as any[], withdrawals: (withdrawalsResult.results || []) as any[] }
}

export function renderAdminRevenueStats(user: any, data: { orders: any[], refunds: any[], withdrawals: any[] }) {
  const revenueOrders = data.orders.filter((order: any) => ['paid', 'active', 'completed'].includes(String(order.status).toLowerCase()))
  const revenue = revenueOrders.reduce((sum, order) => sum + Number(order.total_amount || order.totalAmount || 0), 0)
  const refunds = data.refunds.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0)
  const withdrawals = data.withdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const expenses = refunds + withdrawals
  const months = new Map<string, { revenue: number, refunds: number, withdrawals: number }>()
  const monthOf = (value: unknown) => String(value || '').slice(0, 7) || '未知月份'
  revenueOrders.forEach((item: any) => { const key = monthOf(item.created_at || item.createdAt); const row = months.get(key) || { revenue: 0, refunds: 0, withdrawals: 0 }; row.revenue += Number(item.total_amount || item.totalAmount || 0); months.set(key, row) })
  data.refunds.forEach((item: any) => { const key = monthOf(item.created_at); const row = months.get(key) || { revenue: 0, refunds: 0, withdrawals: 0 }; row.refunds += Number(item.refund_amount || 0); months.set(key, row) })
  data.withdrawals.forEach((item: any) => { const key = monthOf(item.processed_at || item.requested_at); const row = months.get(key) || { revenue: 0, refunds: 0, withdrawals: 0 }; row.withdrawals += Number(item.amount || 0); months.set(key, row) })
  const monthlyRows = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, row]) => `<tr><td class="mono">${esc(month)}</td><td class="mono">${formatCurrency(row.revenue)}</td><td class="mono balance-negative">-${formatCurrency(row.refunds)}</td><td class="mono balance-negative">-${formatCurrency(row.withdrawals)}</td><td class="mono"><strong>${formatCurrency(row.revenue - row.refunds - row.withdrawals)}</strong></td></tr>`).join('')
  const orderRows = revenueOrders.slice(0, 30).map((order: any) => `<tr><td class="mono">${esc(order.orderNo || order.id)}</td><td>${esc(order.status)}</td><td class="mono">${formatCurrency(order.total_amount || order.totalAmount || 0)}</td><td class="mono">${esc(order.created_at || order.createdAt || '-')}</td></tr>`).join('')
  const body = `<div class="page-header"><div><p class="section-code">FINANCE / REVENUE LEDGER</p><h2>收入统计</h2><p>收入按已支付、租赁中和已完成订单统计；支出只计入实际完成的退款和佣金提现，不再使用估算比例。</p></div><a class="button button-secondary" href="/admin/finance">返回财务总览</a></div><div class="stats-grid"><div class="stat-card accent"><h3>订单收入</h3><div class="value">${formatCurrency(revenue)}</div><div class="trend">${revenueOrders.length} 笔有效订单</div></div><div class="stat-card warning"><h3>实际支出</h3><div class="value">${formatCurrency(expenses)}</div><div class="trend">退款 ${formatCurrency(refunds)} · 提现 ${formatCurrency(withdrawals)}</div></div><div class="stat-card success"><h3>净收入</h3><div class="value">${formatCurrency(revenue - expenses)}</div><div class="trend">收入减实际支出</div></div></div><section class="panel"><div class="section-title"><div><span class="section-code">MONTHLY SUMMARY</span><h3>月度收入汇总</h3></div><span class="section-note">按记录时间归属月份</span></div>${monthlyRows ? `<div class="table-wrapper"><table><thead><tr><th>月份</th><th>订单收入</th><th>退款</th><th>佣金提现</th><th>净收入</th></tr></thead><tbody>${monthlyRows}</tbody></table></div>` : '<div class="empty-state">暂无收入记录</div>'}</section><section class="panel"><div class="section-title"><div><span class="section-code">REVENUE ORDERS</span><h3>有效订单收入</h3></div><span class="section-note">显示最近 ${Math.min(30, revenueOrders.length)} 笔</span></div>${orderRows ? `<div class="table-wrapper"><table><thead><tr><th>订单</th><th>状态</th><th>金额</th><th>创建时间</th></tr></thead><tbody>${orderRows}</tbody></table></div>` : '<div class="empty-state">暂无有效订单</div>'}</section>`
  return buildLayout('收入统计 - 电脑租赁管理系统', body, user)
}
