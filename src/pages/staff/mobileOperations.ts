/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { buildLayout, staffOrderPath } from '../../site'

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))

const slotLabels: Record<string, string> = {
  morning_service: '07:00–08:00',
  delivery_morning: '09:00–12:00',
  morning: '09:00–12:00',
  afternoon: '13:00–20:00',
  delivery_afternoon: '13:00–19:00',
  evening_service: '21:00–23:00',
}

const statusLabels: Record<string, string> = {
  approved: '待签署/付款',
  paid: '待取货',
  pending_pickup: '待取货',
  active: '租赁中',
  extended: '已延期',
  overdue: '已逾期',
  suspended: '已暂停',
  pending_return: '待归还验机',
}

export async function renderStaffMobileOperations(c: Context, user: any) {
  const search = String(c.req.query('q') || '').trim().slice(0, 100)
  const stage = ['pickup', 'return'].includes(String(c.req.query('stage') || '')) ? String(c.req.query('stage')) : ''
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const staffFilter = user.role === 'STAFF' ? ' AND u.staff_id = ?' : ''
  const taskQuery = `
    WITH tasks AS (
      SELECT o.id AS order_id, o.orderNo AS order_no, o.status, u.name AS customer_name, d.name AS device_name,
             o.startDate AS task_date, 'pickup' AS task_type,
             COALESCE(o.pickupTimeSlot, CASE WHEN o.startPeriod = 'PM' THEN 'afternoon' ELSE 'morning' END) AS task_slot,
             o.pickupLocation AS task_location,
             CASE COALESCE(o.pickupTimeSlot, CASE WHEN o.startPeriod = 'PM' THEN 'afternoon' ELSE 'morning' END)
               WHEN 'morning_service' THEN 0 WHEN 'morning' THEN 1 WHEN 'delivery_morning' THEN 1
               WHEN 'afternoon' THEN 2 WHEN 'delivery_afternoon' THEN 2 WHEN 'evening_service' THEN 3 ELSE 9 END AS task_order
      FROM orders o JOIN users u ON u.id = o.userId JOIN devices d ON d.id = o.deviceId
      WHERE date(o.startDate) = ? AND o.status IN ('approved', 'paid', 'pending_pickup')${staffFilter}
      UNION ALL
      SELECT o.id AS order_id, o.orderNo AS order_no, o.status, u.name AS customer_name, d.name AS device_name,
             o.endDate AS task_date, 'return' AS task_type,
             COALESCE(o.returnTimeSlot, CASE WHEN o.endPeriod = 'PM' THEN 'afternoon' ELSE 'morning' END) AS task_slot,
             o.returnLocation AS task_location,
             CASE COALESCE(o.returnTimeSlot, CASE WHEN o.endPeriod = 'PM' THEN 'afternoon' ELSE 'morning' END)
               WHEN 'morning_service' THEN 0 WHEN 'morning' THEN 1 WHEN 'delivery_morning' THEN 1
               WHEN 'afternoon' THEN 2 WHEN 'delivery_afternoon' THEN 2 WHEN 'evening_service' THEN 3 ELSE 9 END AS task_order
      FROM orders o JOIN users u ON u.id = o.userId JOIN devices d ON d.id = o.deviceId
      WHERE date(o.endDate) = ? AND o.status IN ('active', 'extended', 'overdue', 'suspended', 'pending_return')${staffFilter}
    )
    SELECT * FROM tasks
    WHERE ${stage ? 'task_type = ? AND (' : '('}LOWER(COALESCE(order_id, '')) LIKE ?
       OR LOWER(COALESCE(order_no, '')) LIKE ?
       OR LOWER(COALESCE(customer_name, '')) LIKE ?
       OR LOWER(COALESCE(device_name, '')) LIKE ?
    )
    ORDER BY task_order ASC, CASE WHEN task_type = 'pickup' THEN 0 ELSE 1 END ASC, order_no ASC
  `
  const searchLike = `%${search.toLowerCase()}%`
  const bindings: unknown[] = [today]
  if (user.role === 'STAFF') bindings.push(user.id)
  bindings.push(today)
  if (user.role === 'STAFF') bindings.push(user.id)
  if (stage) bindings.push(stage)
  bindings.push(searchLike, searchLike, searchLike, searchLike)
  const result = await c.env.RENT.prepare(taskQuery).bind(...bindings).all()
  const tasks = ((result.results || []) as any[]).map(task => ({
    ...task,
    orderNo: String(task.order_no || task.order_id || ''),
    taskType: String(task.task_type),
    taskSlot: String(task.task_slot || ''),
  }))
  const pickupCount = tasks.filter(task => task.taskType === 'pickup').length
  const returnCount = tasks.filter(task => task.taskType === 'return').length

  const taskRows = tasks.map(task => {
    const isPickup = task.taskType === 'pickup'
    const order = { id: String(task.order_id), orderNo: task.order_no }
    const canOpenAction = isPickup
      ? ['paid', 'pending_pickup'].includes(String(task.status))
      : ['active', 'extended', 'overdue', 'suspended', 'pending_return'].includes(String(task.status))
    const actionHref = canOpenAction
      ? isPickup ? `/staff/orders/${encodeURIComponent(task.order_id)}/handover` : `/staff/orders/${encodeURIComponent(task.order_id)}/inspection`
      : staffOrderPath(order)
    const actionLabel = canOpenAction ? (isPickup ? '去取货' : '去验机') : '查看订单'
    return `<article class="mobile-task-card ${isPickup ? 'is-pickup' : 'is-return'}">
      <div class="mobile-task-card__time"><strong>${isPickup ? '取货' : '归还'}</strong><span>${escapeHtml(slotLabels[task.taskSlot] || task.taskSlot || '时段待确认')}</span></div>
      <div class="mobile-task-card__body"><strong>${escapeHtml(task.orderNo)}</strong><span>${escapeHtml(task.customer_name || '未知客户')} · ${escapeHtml(task.device_name || '未知设备')}</span><small>${escapeHtml(task.task_location || '地点待确认')} · ${escapeHtml(statusLabels[String(task.status)] || String(task.status))}</small></div>
      <a class="button button-sm ${isPickup ? 'button-primary' : 'button-info'}" href="${actionHref}">${actionLabel}</a>
    </article>`
  }).join('')

  const pageTitle = stage === 'pickup' ? '今日取货' : stage === 'return' ? '今日归还' : '今日租赁任务'
  const clearHref = stage ? `/staff/mobile?stage=${stage}` : '/staff/mobile'
  const body = `<div class="mobile-operations-page">
    <div class="page-header"><div><p class="section-code">TODAY / RENTAL OPS</p><h2>${pageTitle}</h2><p>${today} · 按预约时间从早到晚排列</p></div><a class="button button-secondary" href="/staff/orders">全部订单</a></div>
    <form class="mobile-task-search" method="get" action="/staff/mobile"><input class="form-control" type="search" name="q" value="${escapeHtml(search)}" placeholder="扫码或搜索订单号、客户、设备" autocomplete="off" inputmode="search" enterkeyhint="search" ${search ? '' : 'autofocus'}>${stage ? `<input type="hidden" name="stage" value="${stage}">` : ''}<button class="button button-primary" type="submit">搜索</button>${search ? `<a class="button button-secondary" href="${clearHref}">清除</a>` : ''}</form>
    <p class="mobile-task-search__hint">扫码枪或手机键盘输入后回车即可定位订单</p>
    <div class="mobile-task-summary"><span>今日任务 <strong>${tasks.length}</strong></span><span class="is-pickup">取货 <strong>${pickupCount}</strong></span><span class="is-return">归还 <strong>${returnCount}</strong></span></div>
    <section class="mobile-task-list">${taskRows || `<div class="empty-state"><h3>${search ? '没有匹配的今日任务' : '今天没有待处理任务'}</h3><p>${search ? '请更换订单号、客户或设备关键词。' : '取货和归还任务会按预约日期自动显示在这里。'}</p></div>`}</section>
  </div>`
  return buildLayout('今日租赁任务 - 电脑租赁管理系统', body, user, { compactStaffNav: true })
}
