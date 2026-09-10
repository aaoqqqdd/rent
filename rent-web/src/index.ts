/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */

type DeviceRow = {
  id: string
  name: string
  brand: string | null
  model: string
  pricePerDay: number
  depositAmount: number
  description: string | null
  cpu: string | null
  ram: string | null
  storage: string | null
  gpu: string | null
  os: string | null
  status: string
  lifecycle_status: string | null
}

const jsonHeaders = {
  'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=120',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

async function listDevices(env: CloudflareBindings): Promise<Response> {
  try {
    const result = await env.RENT.prepare(`
      SELECT id, name, brand, model, pricePerDay, depositAmount, description,
             cpu, ram, storage, gpu, os, status, lifecycle_status
      FROM devices
      WHERE lower(COALESCE(status, '')) != 'retired'
        AND upper(COALESCE(lifecycle_status, 'READY')) != 'RETIRED'
      ORDER BY
        CASE
          WHEN lower(status) = 'available'
            AND upper(COALESCE(lifecycle_status, 'READY')) IN ('READY', 'RETURNED')
          THEN 0 ELSE 1
        END,
        updatedAt DESC,
        name ASC
      LIMIT 24
    `).all<DeviceRow>()

    const devices = (result.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      model: row.model,
      pricePerDay: Number(row.pricePerDay),
      depositAmount: Number(row.depositAmount),
      description: row.description,
      specs: [row.cpu, row.ram, row.storage, row.gpu, row.os].filter(Boolean),
      available: row.status.toLowerCase() === 'available'
        && ['READY', 'RETURNED'].includes((row.lifecycle_status ?? 'READY').toUpperCase()),
    }))

    return new Response(JSON.stringify({ devices, updatedAt: new Date().toISOString() }), {
      headers: jsonHeaders,
    })
  } catch (error) {
    console.error(JSON.stringify({
      message: 'public device list failed',
      error: error instanceof Error ? error.message : String(error),
    }))
    return new Response(JSON.stringify({ error: '设备信息暂时无法读取，请稍后重试。' }), {
      status: 503,
      headers: { ...jsonHeaders, 'Cache-Control': 'no-store' },
    })
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/devices') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...jsonHeaders, Allow: 'GET, HEAD' },
        })
      }
      const response = await listDevices(env)
      return request.method === 'HEAD' ? new Response(null, response) : response
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...jsonHeaders, 'Cache-Control': 'no-store' },
      })
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<CloudflareBindings>
