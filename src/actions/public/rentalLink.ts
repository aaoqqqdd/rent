/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { Context } from 'hono'
import { getUserById } from '../../site'
import { getRentalLink, expireRentalLinkDrafts, validRentalLinkDates } from '../../services/rentalLinks'
import { handleCreateContractAction } from '../staff/createContract'

export async function bookRentalLink(c: Context) {
  const token = c.req.param('token') || ''
  const link = await getRentalLink(c, token)
  if (!link) return c.text('租赁链接不存在或已停用，请联系工作人员', 404)
  await expireRentalLinkDrafts(c)
  const form = await c.req.parseBody()
  const errorPath = `/rent/${encodeURIComponent(token)}`
  if (!validRentalLinkDates(form)) return c.redirect(`${errorPath}?error=${encodeURIComponent('请选择有效的租赁日期和上午/下午时段，租期最长为 366 天')}`, 303)
  const creator = await getUserById(c, link.created_by)
  if (!creator || creator.role !== 'ADMIN' || creator.status !== 'active') return c.notFound()
  // 设备、金额、地点和合同条件均来自管理员配置；公开表单只接收租期。
  return handleCreateContractAction(c, creator, {
    deviceId: link.device_id, startDate: String(form.startDate), endDate: String(form.endDate),
    startPeriod: String(form.startPeriod || 'AM'), endPeriod: String(form.endPeriod || 'AM'),
    pickupLocation: link.pickup_location, returnLocation: link.return_location, deliveryMethod: 'Pickup', deliveryFee: '0',
    deviceCondition: link.device_condition, deviceAccessories: link.device_accessories || '', lateFeePerDay: String(link.late_fee_per_day), repairCost: '',
  }, { errorPath, rentalLinkId: link.id, directSigning: true })
}
