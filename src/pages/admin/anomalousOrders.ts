import { buildLayout, getDB, sanitizePlainText } from '../../site'
import { parsePageRequest, buildPaginationMeta, clampPageRequest, renderPager } from '../../lib/pagination'

const esc = (value: unknown, limit = 500) => sanitizePlainText(value, limit).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const labels: Record<string, string> = { PAID_ORDER_WITHOUT_PAYMENT: '已付款但缺少结算记录', ACTIVE_ORDER_WITHOUT_HANDOVER: '租赁中但缺少交接记录' }

// 分页：`?page=`（默认 1，每页 50）。以前这条查询不加 LIMIT，审核历史越攒越多，
// 每打开一次页面就把全部历史行读进内存并全部渲染成表格。
export async function loadAdminAnomalousOrders(c: any, pageSize = 50) {
  const db = getDB(c)
  let request = parsePageRequest(c.req.query('page'), pageSize)
  const countRow = await db.prepare('SELECT COUNT(*) AS total FROM anomalous_order_reviews').first() as any
  const total = Number(countRow?.total || 0)
  request = clampPageRequest(request, total)
  const meta = buildPaginationMeta(total, request)
  const [rowsResult, pendingRow] = await Promise.all([
    db.prepare(`SELECT r.*, o.orderNo AS order_no, u.name AS customer_name, u.email AS customer_email, reviewer.name AS reviewer_name FROM anomalous_order_reviews r LEFT JOIN orders o ON o.id = r.order_id LEFT JOIN users u ON u.id = o.userId LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.detected_at DESC LIMIT ? OFFSET ?`)
      .bind(meta.pageSize, meta.offset).all(),
    db.prepare("SELECT COUNT(*) AS pending FROM anomalous_order_reviews WHERE status = 'PENDING'").first(),
  ])
  const reviews = ((rowsResult as any).results || []) as any[]
  meta.count = reviews.length
  return { reviews, meta, pendingCount: Number((pendingRow as any)?.pending || 0) }
}

export function renderAdminAnomalousOrders(user: any, reviews: any[] = [], options: { meta?: any; pendingCount?: number; search?: string } = {}) {
  const pending = reviews.filter(item => item.status === 'PENDING')
  const pendingTotal = options.pendingCount ?? pending.length
  const rows = reviews.map(item => `<tr><td><a class="mono" href="/admin/orders/${encodeURIComponent(item.order_id)}">${esc(item.order_no || item.order_id, 80)}</a><small>${esc(item.customer_name || item.customer_email || '-', 120)}</small></td><td><strong>${esc(labels[item.anomaly_type] || item.anomaly_type, 120)}</strong><small>发现于：${esc(item.detected_at, 80)}</small></td><td><span class="badge ${item.status === 'PENDING' ? 'badge-warning' : item.status === 'RESTORED' ? 'badge-success' : 'badge-neutral'}">${item.status === 'PENDING' ? '待审核 / 已暂停' : item.status === 'RESTORED' ? '已恢复' : '确认暂停'}</span><small>原状态：${esc(item.original_status, 40)}</small></td><td>${item.status === 'PENDING' ? `<form method="post" action="/admin/finance/anomalous-orders/${encodeURIComponent(item.id)}" style="display:grid;gap:8px;min-width:220px" data-site-confirm="确认提交这条异常订单的审核结果？恢复订单会重新允许后续支付与交付流程。" data-confirm-title="提交异常订单审核？" data-confirm-label="提交审核结果"><textarea class="form-control" name="note" maxlength="1000" required placeholder="审核说明（必填）"></textarea><div class="record-actions"><button class="button button-sm button-primary" name="decision" value="restore" type="submit">恢复订单</button><button class="button button-sm button-secondary" name="decision" value="confirm" type="submit">确认继续暂停</button></div></form>` : `<small>${esc(item.review_note || '-', 1000)}<br>审核：${esc(item.reviewer_name || item.reviewed_by || '-', 100)}</small>`}</td></tr>`).join('')
  const body = `<div class="page-header"><div><p class="section-code">FINANCE / ANOMALOUS ORDERS</p><h2>异常订单审核</h2></div><a class="button button-secondary" href="/admin/finance">返回财务管理</a></div><div class="stats-grid"><div class="stat-card warning"><h3>待审核异常订单</h3><div class="value">${pendingTotal}</div></div><div class="stat-card"><h3>审核历史</h3><div class="value">${options.meta?.total ?? reviews.length}</div></div></div><section class="panel"><div class="section-title"><h3>审核队列</h3></div>${rows ? `<div class="table-wrapper"><table><thead><tr><th>订单 / 客户</th><th>异常原因</th><th>状态</th><th>审核处理</th></tr></thead><tbody>${rows}</tbody></table></div>${options.meta ? renderPager(options.meta, { basePath: '/admin/finance/anomalous-orders', label: '条记录' }) : ''}` : '<div class="empty-state"><h3>暂无异常订单</h3></div>'}</section>`
  return buildLayout('异常订单审核 - 电脑租赁管理系统', body, user)
}
