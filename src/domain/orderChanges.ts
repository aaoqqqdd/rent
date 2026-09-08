/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 订单修改历史 (TODO.md P1 #5 / 完善.md)
//
// 任何已创建订单的关键字段都不能被静默修改：每次调整都要落一条
// order_change_history，记录改了什么、为什么、谁改的，并保持库存一致。
// 下面是纯函数部分（无 DB），供路由与单元测试共用；设备是否存在、租期是否
// 冲突等依赖 DB 的检查由调用方在拿到 patch 后执行。

export const ORDER_CHANGE_TYPES = ['EXTENSION', 'DEVICE_SWAP', 'PRICE_ADJUSTMENT', 'LOCATION_CHANGE'] as const
export type OrderChangeType = typeof ORDER_CHANGE_TYPES[number]

export const ORDER_CHANGE_TYPE_LABELS: Record<string, string> = {
  EXTENSION: '调整租期',
  DEVICE_SWAP: '更换设备',
  PRICE_ADJUSTMENT: '调整价格 / 押金',
  LOCATION_CHANGE: '修改取还地点',
  CANCELLATION: '取消订单',
  INVENTORY_RELEASE: '释放库存',
}

const ORDER_CHANGE_FIELD_LABELS: Record<string, string> = {
  deviceId: '设备',
  startDate: '起租日期',
  endDate: '归还日期',
  rentalPeriod: '租期天数',
  totalAmount: '订单总额',
  depositAmount: '押金',
  discountAmount: '优惠金额',
  pickupLocation: '取货地点',
  returnLocation: '归还地点',
  deliveryMethod: '配送方式',
  status: '订单状态',
}

const ORDER_CHANGE_DELIVERY_METHODS = ['Pickup', 'Delivery']

// 订单被追踪的关键字段快照，作为 before/after JSON 的统一结构。
export function orderChangeSnapshot(order: any): Record<string, any> {
  return {
    deviceId: order.deviceId ?? order.device_id ?? '',
    startDate: order.startDate ?? order.start_date ?? '',
    endDate: order.endDate ?? order.end_date ?? '',
    rentalPeriod: Number(order.rentalPeriod ?? order.rental_period ?? 0),
    totalAmount: Number(order.totalAmount ?? order.total_amount ?? 0),
    depositAmount: Number(order.depositAmount ?? order.deposit_amount ?? 0),
    discountAmount: Number(order.discountAmount ?? order.discount_amount ?? 0),
    pickupLocation: order.pickupLocation ?? order.pickup_location ?? '',
    returnLocation: order.returnLocation ?? order.return_location ?? '',
    deliveryMethod: order.deliveryMethod ?? order.delivery_method ?? 'Pickup',
  }
}

// 两个快照之间发生变化的字段列表，用于渲染修改历史的可读对照。
export function diffOrderSnapshots(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
): { field: string; label: string; before: any; after: any }[] {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
  const changes: { field: string; label: string; before: any; after: any }[] = []
  for (const key of keys) {
    const a = (before as any)?.[key] ?? null
    const b = (after as any)?.[key] ?? null
    if (String(a ?? '') === String(b ?? '')) continue
    changes.push({ field: key, label: ORDER_CHANGE_FIELD_LABELS[key] || key, before: a, after: b })
  }
  return changes
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000)
}

export interface OrderChangePlan {
  patch: Record<string, any>
  // 目标设备（换机时为新设备，其它类型为原设备）在新租期内需要做冲突检查
  bookingCheck?: { deviceId: string; startDate: string; endDate: string }
  // 需要确认该设备存在且状态可租
  deviceAvailabilityCheck?: string
}

// 纯校验 + patch 构造。返回 { error } 表示输入不合法；否则返回需要写回订单的
// 字段补丁以及调用方还需执行的 DB 依赖检查。
export function buildOrderChangePlan(
  type: string,
  before: Record<string, any>,
  input: Record<string, string | undefined>,
): OrderChangePlan | { error: string } {
  switch (type) {
    case 'EXTENSION': {
      const startDate = (input.startDate ?? '').trim() || before.startDate
      const endDate = (input.endDate ?? '').trim() || before.endDate
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { error: '日期格式无效' }
      if (endDate <= startDate) return { error: '归还日期必须晚于起租日期' }
      if (startDate === before.startDate && endDate === before.endDate) return { error: '租期没有变化' }
      return {
        patch: { startDate, endDate, rentalPeriod: daysBetween(startDate, endDate) },
        bookingCheck: { deviceId: before.deviceId, startDate, endDate },
      }
    }
    case 'DEVICE_SWAP': {
      const deviceId = (input.deviceId ?? '').trim()
      if (!deviceId) return { error: '请选择替换设备' }
      if (deviceId === before.deviceId) return { error: '替换设备与当前设备相同' }
      return {
        patch: { deviceId },
        deviceAvailabilityCheck: deviceId,
        bookingCheck: { deviceId, startDate: before.startDate, endDate: before.endDate },
      }
    }
    case 'PRICE_ADJUSTMENT': {
      const totalAmount = Number(input.totalAmount)
      const depositAmount = Number(input.depositAmount)
      const discountAmount = input.discountAmount === undefined || input.discountAmount === ''
        ? Number(before.discountAmount || 0)
        : Number(input.discountAmount)
      if (![totalAmount, depositAmount, discountAmount].every(Number.isFinite)) return { error: '金额必须是数字' }
      if (totalAmount < 0 || depositAmount < 0 || discountAmount < 0) return { error: '金额不能为负' }
      if (depositAmount > totalAmount) return { error: '押金不能超过订单总额' }
      const patch = {
        totalAmount: Number(totalAmount.toFixed(2)),
        depositAmount: Number(depositAmount.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
      }
      const unchanged = patch.totalAmount === Number(before.totalAmount)
        && patch.depositAmount === Number(before.depositAmount)
        && patch.discountAmount === Number(before.discountAmount || 0)
      if (unchanged) return { error: '价格没有变化' }
      return { patch }
    }
    case 'LOCATION_CHANGE': {
      const pickupLocation = (input.pickupLocation ?? before.pickupLocation ?? '').trim().slice(0, 200)
      const returnLocation = (input.returnLocation ?? before.returnLocation ?? '').trim().slice(0, 200)
      const deliveryMethod = (input.deliveryMethod ?? before.deliveryMethod ?? 'Pickup').trim()
      if (!ORDER_CHANGE_DELIVERY_METHODS.includes(deliveryMethod)) return { error: '配送方式无效' }
      const unchanged = pickupLocation === (before.pickupLocation || '')
        && returnLocation === (before.returnLocation || '')
        && deliveryMethod === (before.deliveryMethod || 'Pickup')
      if (unchanged) return { error: '取还信息没有变化' }
      return { patch: { pickupLocation, returnLocation, deliveryMethod } }
    }
    default:
      return { error: '不支持的订单修改类型' }
  }
}
