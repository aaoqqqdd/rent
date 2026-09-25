import type { Context } from 'hono'
import { getDB } from '../db/client'
import { deliveryStatusInfo } from '../deliveryStatus'

export type DeliveryBookingView = {
  id: string
  direction: 'outbound' | 'return'
  status: string
  statusLabel: string
  statusDescription: string
  locked: boolean
  providerReference: string
  trackingUrl: string
  updatedAt: string
}

export async function getDeliveryBookingsForOrder(c: Context, orderId: string): Promise<DeliveryBookingView[]> {
  try {
    const result = await getDB(c).prepare(`
      SELECT id, direction, status, provider_reference, tracking_url, updated_at
      FROM delivery_bookings WHERE order_id = ? ORDER BY created_at DESC
    `).bind(orderId).all()
    return ((result.results || []) as Record<string, unknown>[]).map((row: Record<string, unknown>) => {
      const info = deliveryStatusInfo(row.status)
      return {
        id: String(row.id || ''),
        direction: (String(row.direction) === 'return' ? 'return' : 'outbound') as 'outbound' | 'return',
        status: String(row.status || ''),
        statusLabel: info.label,
        statusDescription: info.description,
        locked: info.special,
        providerReference: String(row.provider_reference || ''),
        trackingUrl: String(row.tracking_url || ''),
        updatedAt: String(row.updated_at || ''),
      }
    })
  } catch {
    return []
  }
}

export function safeDeliveryTrackingUrl(value: unknown): string {
  try {
    const url = new URL(String(value || ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}
