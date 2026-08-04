/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { buildLayout, formatCurrency, getOrderById, getUserById, getSystemSettings } from '../site'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))

export async function renderInvoice(c: Context, user: any, orderId: string) {
  const order = await getOrderById(c, orderId)
  if (!order || (user.role === 'CUSTOMER' && order.userId !== user.id)) return buildLayout('发票未找到', '<div class="panel"><h2>发票不存在或无权查看</h2></div>', user)
  const invoices = (await c.env.RENT.prepare('SELECT * FROM invoices WHERE order_id = ? ORDER BY issued_at').bind(order.id).all()).results as any[]
  if (!invoices.length) return buildLayout('发票尚未开具', '<div class="panel"><h2>付款完成后系统将自动开具发票</h2></div>', user)
  const customer = await getUserById(c, order.userId)
  const company = getSystemSettings().companyDetails
  const documents = invoices.map(invoice => `<article class="panel" style="margin-bottom:20px"><h2>${invoice.type === 'credit_note' ? 'Credit Note' : 'Tax Invoice'}</h2><p><strong>编号：</strong>${escape(invoice.invoice_number)}</p><p><strong>开具日期：</strong>${escape(invoice.issued_at)}</p><hr><p><strong>公司 ABN：</strong>${escape(company.abn)}</p><p>${escape(company.address)} · ${escape(company.email)} · ${escape(company.phone)}</p><p><strong>客户：</strong>${escape(customer?.name)} (${escape(customer?.email)})</p><table style="width:100%;margin-top:20px"><tr><td>税前小计</td><td>${formatCurrency(invoice.subtotal)}</td></tr><tr><td>GST</td><td>${formatCurrency(invoice.gst_amount)}</td></tr><tr><td>押金</td><td>${formatCurrency(invoice.deposit_amount)}</td></tr><tr><td><strong>合计</strong></td><td><strong>${formatCurrency(invoice.total_amount)}</strong></td></tr></table></article>`).join('')
  return buildLayout('发票', `<div class="contract-actions" style="margin-bottom:16px"><button class="button" onclick="window.print()">打印/保存 PDF</button></div>${documents}`, user)
}
