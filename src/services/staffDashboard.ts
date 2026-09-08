/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 员工工作台的只读聚合查询。可选按 staff_id 过滤成"我负责的客户"。仅依赖 db/client。

import type { Context } from 'hono'
import { getDB } from '../db/client'

export async function getPendingOrdersWithDetails(c: Context, staffId?: string): Promise<any[]> {
  const db = getDB(c);
  const query = `
    SELECT
      o.id,
      o.orderNo,
      o.startDate,
      o.endDate,
      o.totalAmount,
      o.status,
      u.name as customerName,
      d.name as deviceName
    FROM orders o
    JOIN users u ON o.userId = u.id
    JOIN devices d ON o.deviceId = d.id
    WHERE o.status = 'pending_approval' ${staffId ? 'AND u.staff_id = ?' : ''}
    ORDER BY o.createdAt DESC
  `;
  const statement = db.prepare(query)
  const result = staffId ? await statement.bind(staffId).all() : await statement.all();
  return result.results || [];
}

export async function getStaffDashboardData(c: Context, staffId?: string): Promise<any> {
  const db = getDB(c);

  const statsQuery = `
    SELECT
      (SELECT SUM(totalAmount) FROM orders WHERE status IN ('paid', 'active', 'completed')) as totalRevenue,
      (SELECT COUNT(*) FROM orders WHERE status = 'active' OR status = 'paid') as activeRentals,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending_approval' OR status = 'pending_payment') as pendingOrders,
      (SELECT COUNT(*) FROM devices WHERE status = 'available') as availableDevices,
      (SELECT COUNT(*) FROM devices) as totalDevices
  `;

  const recentOrdersQuery = `
    SELECT o.id, o.orderNo, o.status, u.name as customerName, d.name as deviceName
    FROM orders o
    LEFT JOIN users u ON o.userId = u.id
    LEFT JOIN devices d ON o.deviceId = d.id
    ${staffId ? 'WHERE u.staff_id = ?' : ''}
    ORDER BY o.createdAt DESC
    LIMIT 5
  `;

  const recentDevicesQuery = `
    SELECT d.id, d.name, d.status, u.name as customerName
    FROM devices d
    LEFT JOIN (
      SELECT o.deviceId, o.userId FROM orders o JOIN users owner ON o.userId = owner.id WHERE (o.status = 'active' OR o.status = 'paid') ${staffId ? 'AND owner.staff_id = ?' : ''}
    ) o ON d.id = o.deviceId
    LEFT JOIN users u ON o.userId = u.id
    ORDER BY d.createdAt DESC
    LIMIT 5
  `;

  const recentOrdersStatement = db.prepare(recentOrdersQuery)
  const recentDevicesStatement = db.prepare(recentDevicesQuery)
  const [statsResult, recentOrdersResult, recentDevicesResult] = await Promise.all([
    db.prepare(statsQuery).first(),
    staffId ? recentOrdersStatement.bind(staffId).all() : recentOrdersStatement.all(),
    staffId ? recentDevicesStatement.bind(staffId).all() : recentDevicesStatement.all()
  ]);

  return {
    stats: statsResult,
    recentOrders: recentOrdersResult.results || [],
    recentDevices: recentDevicesResult.results || []
  };
}
