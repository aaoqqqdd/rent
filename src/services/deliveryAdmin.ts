/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { getDB } from '../db/client'
import { getDeliveryRuntimeConfig } from '../deliveryConfig'

export type DeliveryDirection = 'outbound' | 'return'

export interface AdminDeliveryRow {
  id: string
  orderNo: string | null
  status: string
  startDate: string
  endDate: string
  deliveryFee: number
  pickupLocation: string | null
  customerName: string | null
  customerEmail: string | null
  deviceName: string | null
  outboundId: string | null
  outboundStatus: string | null
  outboundReference: string | null
  outboundTrackingUrl: string | null
  returnId: string | null
  returnStatus: string | null
  returnReference: string | null
  returnTrackingUrl: string | null
}

export async function getAdminDeliveryRows(c: Context): Promise<{ rows: AdminDeliveryRow[]; available: boolean }> {
  const db = getDB(c)
  try {
    const result = await db.prepare(`
      SELECT
        o.id, o.orderNo, o.status, o.startDate, o.endDate,
        COALESCE(o.deliveryFee, 0) AS deliveryFee, o.pickupLocation,
        u.name AS customerName, u.email AS customerEmail, d.name AS deviceName,
        outbound.id AS outboundId, outbound.status AS outboundStatus,
        outbound.provider_reference AS outboundReference, outbound.tracking_url AS outboundTrackingUrl,
        returned.id AS returnId, returned.status AS returnStatus,
        returned.provider_reference AS returnReference, returned.tracking_url AS returnTrackingUrl
      FROM orders o
      LEFT JOIN users u ON u.id = o.userId
      LEFT JOIN devices d ON d.id = o.deviceId
      LEFT JOIN delivery_bookings outbound ON outbound.id = (
        SELECT id FROM delivery_bookings WHERE order_id = o.id AND direction = 'outbound'
        ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN delivery_bookings returned ON returned.id = (
        SELECT id FROM delivery_bookings WHERE order_id = o.id AND direction = 'return'
        ORDER BY created_at DESC LIMIT 1
      )
      WHERE o.deliveryMethod = 'Delivery' AND LOWER(COALESCE(o.status, '')) <> 'cancelled'
      ORDER BY CASE LOWER(o.status)
        WHEN 'pending_pickup' THEN 1 WHEN 'paid' THEN 2 WHEN 'active' THEN 3
        WHEN 'pending_return' THEN 4 WHEN 'extended' THEN 5 WHEN 'overdue' THEN 6
        ELSE 7 END, date(o.startDate), datetime(o.createdAt) DESC
      LIMIT 200
    `).all()
    return { rows: (result.results || []) as AdminDeliveryRow[], available: true }
  } catch (error) {
    console.error(JSON.stringify({ message: 'delivery table query failed', error: error instanceof Error ? error.message : String(error) }))
    return { rows: [], available: false }
  }
}

type DeliveryBindings = { DELIVERY_SERVICE?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }; PUBLIC_WEB_ORIGIN?: string }

function normalizeReadyDateTime(value: unknown): string {
  const raw = String(value || '').trim().slice(0, 64)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00+10:00`
  return raw
}

export async function createAdminDeliveryBooking(
  c: Context,
  input: { orderId: string; direction: DeliveryDirection; readyDateTime?: string },
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; message: string }> {
  const env = c.env as DeliveryBindings
  const token = (await getDeliveryRuntimeConfig(c)).adminToken
  if (!token) return { ok: false, message: '配送管理 Token 尚未配置，请先配置 DELIVERY_ADMIN_TOKEN。' }

  const body = JSON.stringify({
    orderId: input.orderId,
    direction: input.direction,
    readyDateTime: normalizeReadyDateTime(input.readyDateTime),
  })
  let response: Response
  try {
    const request = new Request('https://delivery.internal/api/delivery/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    })
    if (env.DELIVERY_SERVICE) {
      response = await env.DELIVERY_SERVICE.fetch(request)
    } else {
      const origin = String(env.PUBLIC_WEB_ORIGIN || '').replace(/\/$/, '')
      if (!origin) return { ok: false, message: '配送 Worker 尚未配置，请配置 DELIVERY_SERVICE 或 PUBLIC_WEB_ORIGIN。' }
      response = await fetch(new Request(`${origin}/api/delivery/bookings`, request))
    }
  } catch (error) {
    console.error(JSON.stringify({ message: 'delivery service request failed', error: error instanceof Error ? error.message : String(error) }))
    return { ok: false, message: '配送服务暂时无法连接，请稍后重试。' }
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload || payload.ok !== true) {
    return { ok: false, message: String(payload?.message || '配送订单创建失败，请检查配送服务配置。') }
  }
  return { ok: true, payload }
}
