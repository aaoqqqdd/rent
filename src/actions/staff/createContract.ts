/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono';
import { User, getDeviceById, getContractTemplate, getSystemSettings, loadSystemSettingsFromDB, hasDeviceBookingConflict, Order, Contract, buildLayout, insertOrder, insertContract } from '../../site';
import { nanoid, customAlphabet } from 'nanoid';

// 自定义nanoid，只使用大写字母和数字，确保合同编号只包含大写字母和数字
const uppercaseAlphanumericNanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 16);

export async function handleCreateContractAction(c: Context, user: User, body: Record<string, string>): Promise<Response> {
  const { deviceId, startDate, endDate, validFrom, validUntil, expiryDuration, deviceCondition, deviceAccessories, returnLocation } = body;
  const startPeriod = body.startPeriod === 'PM' ? 'PM' : 'AM'
  const endPeriod = body.endPeriod === 'PM' ? 'PM' : 'AM'
  const deliveryMethod = body.deliveryMethod === 'Delivery' ? 'Delivery' : 'Pickup'
  const deliveryFeeText = String(body.deliveryFee || '').trim()
  const deliveryFee = deliveryMethod === 'Delivery' ? Number(deliveryFeeText) : 0
  const returnMethod = deliveryMethod === 'Delivery' && body.returnMethod === 'CourierPickup' ? 'CourierPickup' : 'StoreReturn'
  await loadSystemSettingsFromDB(c)
  const allowedLocations = getSystemSettings().companyDetails.pickupLocations
  const rentalRules = getSystemSettings().rentalRules
  let returnLocationValue = String(returnLocation || '').trim()
  let pickupLocationValue = String(body.pickupLocation || '').trim()
  let deliveryAddressData: Record<string, string> = {}
  if (deliveryMethod === 'Pickup') {
    if (!pickupLocationValue) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('请选择自取地点')}`)
    if (user.role !== 'ADMIN' && !allowedLocations.includes(pickupLocationValue)) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('员工只能选择管理员配置的自取地点')}`)
  } else {
    const street = String(body.deliveryStreet || '').trim()
    const suburb = String(body.deliverySuburb || '').trim()
    const state = String(body.deliveryState || '').trim().toUpperCase()
    const postcode = String(body.deliveryPostcode || '').trim()
    if (!street || !suburb || !['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].includes(state) || !/^\d{4}$/.test(postcode)) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('请填写完整有效的澳洲送货地址')}`)
    pickupLocationValue = `${street}, ${suburb} ${state} ${postcode}, Australia`
    deliveryAddressData = { delivery_address: pickupLocationValue, delivery_street: street, delivery_suburb: suburb, delivery_state: state, delivery_postcode: postcode, delivery_place_id: String(body.deliveryPlaceId || '').trim().slice(0, 300) }
  }
  if (returnMethod === 'CourierPickup') {
    returnLocationValue = pickupLocationValue
  } else if (!returnLocationValue || (user.role !== 'ADMIN' && !allowedLocations.includes(returnLocationValue))) {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('请选择管理员配置的归还店铺')}`)
  }

  if (!deviceId || !startDate || !endDate) {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('设备、开始日期和结束日期均为必填项')}`);
  }
  const lateFeePerDay = Number(body.lateFeePerDay)
  const repairCost = body.repairCost === '' ? null : Number(body.repairCost)
  if (!deviceCondition?.trim() || !Number.isFinite(lateFeePerDay) || lateFeePerDay < 0 || (deliveryMethod === 'Delivery' && !deliveryFeeText) || !Number.isFinite(deliveryFee) || deliveryFee < 0 || (repairCost !== null && (!Number.isFinite(repairCost) || repairCost < 0))) {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('请填写设备状况、取还地点及有效的非负费用')}`);
  }

  const device = await getDeviceById(c, deviceId);

  const normalizedStatus = String(device?.status || '').toLowerCase();
  if (!device || ['maintenance', 'retired'].includes(normalizedStatus)) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('维修或退役设备不能新建合同')}`)

  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today || end < today) {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('开始日期和结束日期必须是今天或之后的日期')}`);
  }
  if (start >= end) {
    return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('租赁结束日期必须晚于开始日期')}`);
  }
  const halfDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) * 2 + (endPeriod === 'PM' ? 1 : 0) - (startPeriod === 'PM' ? 1 : 0)
  if (halfDays <= 0) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('归还时段必须晚于取货时段')}`)
  const rentalPeriod = Math.ceil(halfDays / 2);
  if (rentalPeriod < rentalRules.minimumRentalDays) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent(`最短租赁时间为 ${rentalRules.minimumRentalDays} 天`)}`)
  const unavailable = new Set(rentalRules.unavailableDates)
  for (let day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
    if (unavailable.has(day.toISOString().slice(0, 10))) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('所选租期包含不可取货或归还的日期')}`)
  }
  const deviceUnavailable = new Set(((await c.env.RENT.prepare('SELECT unavailable_date FROM device_unavailable_dates WHERE device_id = ?').bind(deviceId).all()).results || []).map((row: any) => row.unavailable_date))
  for (let day = new Date(startDate); day < new Date(endDate); day.setDate(day.getDate() + 1)) if (deviceUnavailable.has(day.toISOString().slice(0, 10))) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('该设备包含管理员设置的不可用日期')}`)
  if (await hasDeviceBookingConflict(c, deviceId, startDate, endDate, undefined, rentalRules.bufferDays)) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('该设备在所选日期或缓冲时间内已有订单')}`)

  const dailyRate = device.pricePerDay;
  const depositAmount = device.depositAmount;
  const couponCode = String(body.couponCode || '').trim().toUpperCase().slice(0, 40)
  const rentAmount = rentalPeriod * dailyRate
  let discountAmount = 0
  let appliedCouponCode: string | null = null
  if (couponCode) {
    const coupon = await c.env.RENT.prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP) AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP) AND (max_uses IS NULL OR used_count < max_uses)").bind(couponCode).first() as any
    if (!coupon) return c.redirect(`/staff/contracts/new?error=${encodeURIComponent('优惠码无效、已过期或已达到使用次数上限')}`)
    discountAmount = coupon.discount_type === 'percent' ? rentAmount * Number(coupon.discount_value) / 100 : Number(coupon.discount_value)
    discountAmount = Math.min(rentAmount, Math.max(0, Number(discountAmount.toFixed(2))))
    appliedCouponCode = String(coupon.code).toUpperCase()
    await c.env.RENT.prepare('UPDATE coupons SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(coupon.id).run()
  }
  const totalAmount = rentAmount + depositAmount + deliveryFee - discountAmount;

  const orderId = `o-${nanoid(8)}`;
  const contractId = `ct-${nanoid(10)}`;
  const signToken = nanoid(32);

  const newOrder: Order = {
    id: orderId,
    orderNo: null,
    userId: user.id, // 临时用户ID，将在客户签署时更新
    deviceId: deviceId,
    startDate: startDate,
    endDate: endDate,
    startPeriod, endPeriod,
    pickupTimeSlot: body.pickupTimeSlot || null,
    returnTimeSlot: body.returnTimeSlot || null,
    pickupLocation: pickupLocationValue,
    returnLocation: returnLocationValue,
    deliveryMethod: deliveryMethod as any,
    deliveryFee: deliveryFee as any,
    rentalNote: String(body.rentalNote || '').trim().slice(0, 500) as any,
    rentalPeriod: rentalPeriod, // 添加 rentalPeriod
    status: 'draft',
    paymentMethod: 'bank_transfer',
    totalAmount: totalAmount,
    depositAmount: depositAmount,
    dailyRate: dailyRate,
    contractId: contractId,
    signedAt: null,
    createdAt: new Date().toISOString(), couponCode: appliedCouponCode, discountAmount
    // created_by 在部分旧代码/表结构中存在，这里与 Order 类型对齐使用 createdAt
    // createdAtBy: user.id,
  } as any;

  // 设置签约链接过期时间，使用用户选择的天数
  const signExpiresDate = new Date();
  const expiryDays = parseInt(expiryDuration) || 7;
  signExpiresDate.setDate(signExpiresDate.getDate() + expiryDays);

  // 生成合同编号：CN + 随机10位大写字母和数字，确保高唯一性
  const contractRandomSuffix = uppercaseAlphanumericNanoid().slice(0, 10);
  const contractNumber = `CN${contractRandomSuffix}`;

  const template = await getContractTemplate(c)
  const newContract: Contract = {
    id: contractId,
    rentalId: orderId,
    contractNumber: contractNumber,
    content: template.content,
    status: 'pending_sign',
    signedAt: null,
    signToken: signToken,
    createdAt: new Date().toISOString(),
    signExpiresAt: signExpiresDate.toISOString(), // 设置过期时间
    validFrom: validFrom || null, // Add validFrom
    validUntil: validUntil || null, // Add validUntil
    createdBy: user.id, // 记录合同创建人，用于权限控制
    device_condition: deviceCondition.trim(),
    device_accessories: deviceAccessories?.trim() || null,
    late_fee_per_day: lateFeePerDay,
    repair_cost: repairCost,
    pickup_location: pickupLocationValue,
    return_location: returnLocationValue,
    contract_data: { invoice_number: '', delivery_method: deliveryMethod, delivery_fee: deliveryFee.toFixed(2), return_method: returnMethod, pickup_location: pickupLocationValue, return_location: returnLocationValue, ...deliveryAddressData, agreement_version: '1.0' },
  };

  await insertOrder(c, newOrder);
  await insertContract(c, newContract);

  const fullSignUrl = `${new URL(c.req.url).origin}/contract/sign?token=${newContract.signToken}&step=1`;
  const successPage = `
    <div class="panel">
      <h2>签约链接已生成</h2>
      <p>请将以下链接发送给客户进行签署：</p>
      <div class="alert" style="background:#e0f2fe;border-color:#bae6fd; padding: 16px; border-radius: 8px;">
        <div style="word-break: break-all; margin-bottom: 16px; font-size: 14px; line-height: 1.5;">${fullSignUrl}</div>
        <button id="copy-button" class="button button-primary">复制链接</button>
      </div>
      <div style="margin-top: 24px;">
        <a href="/staff/contracts" class="button">返回合同列表</a>
      </div>
    </div>
    <script>
      document.getElementById('copy-button').addEventListener('click', function() {
        navigator.clipboard.writeText("${fullSignUrl}").then(function() {
          const button = document.getElementById('copy-button');
          button.innerText = '已复制!';
          button.disabled = true;
          setTimeout(function() {
            button.innerText = '复制链接';
            button.disabled = false;
          }, 2000);
        }, function(err) {
          console.error('无法复制链接: ', err);
          alert('复制失败，请手动复制链接');
        });
      });
    </script>`;

  return new Response(buildLayout('签约链接 - 电脑租赁管理系统', successPage, user), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
