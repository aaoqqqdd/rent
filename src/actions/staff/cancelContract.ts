/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono';
import { getContractById, updateContractStatus, logError, findUserBySession, getOrderById, releaseDeviceIfUnbooked } from '../../site';

export async function handleCancelContractAction(c: Context): Promise<Response> {
  const contractId = c.req.param('id');

  if (!contractId) {
    await logError(c, 'WARNING', 'Attempted to cancel contract without ID');
    return c.redirect(`/staff/contracts?error=${encodeURIComponent('缺少合同编号，无法作废')}`);
  }

  try {
    const user = await findUserBySession(c, c.req.header('cookie') ?? null);
    if (!user) {
      await logError(c, 'WARNING', `Unauthorized attempt to cancel contract. Contract ID: ${contractId}`);
      return c.redirect(`/login?error=${encodeURIComponent('请先登录')}`);
    }

    const contract = await getContractById(c, contractId);

    if (!contract) {
      await logError(c, 'WARNING', `Contract not found for ID: ${contractId}`);
      return c.redirect(`/staff/contracts?error=${encodeURIComponent('合同不存在或已被删除')}`);
    }

    if (contract.status !== 'pending_sign') {
      await logError(c, 'WARNING', `Attempted to cancel a contract not in 'pending_sign' status. Contract ID: ${contractId}, Current Status: ${contract.status}`);
      return c.redirect(`/staff/contracts?error=${encodeURIComponent('只有等待签署的合同可以作废')}`);
    }

    const isAdmin = user.role === 'ADMIN';
    const isCreator = contract.created_by === user.id || contract.createdBy === user.id;

    if (!isAdmin && !isCreator) {
      await logError(c, 'WARNING', `Permission denied: User ${user.id} attempted to cancel contract ${contractId} created by ${contract.created_by}`);
      return c.redirect(`/staff/contracts?error=${encodeURIComponent('您没有权限作废该合同')}`);
    }

    await updateContractStatus(c, contractId, 'cancelled');

    // 新增逻辑：如果合同关联了订单，则将订单中的设备状态更新为可用
    if (contract.rentalId) {
      const order = await getOrderById(c, contract.rentalId);
      if (order && order.deviceId) {
        await releaseDeviceIfUnbooked(c, order.deviceId);
        await logError(c, 'INFO', `Device ${order.deviceId} status updated to 'available' after contract ${contractId} cancellation.`);
      }
    }

    await logError(c, 'INFO', `Contract cancelled successfully. Contract ID: ${contractId}, Cancelled by: ${user.id}`);
    return c.redirect(`/staff/contracts?success=${encodeURIComponent('合同已作废')}`);
  } catch (error) {
    await logError(c, 'ERROR', `Failed to cancel contract. Contract ID: ${contractId}`, error as Error);
    return c.redirect(`/staff/contracts?error=${encodeURIComponent('作废合同失败，请稍后重试')}`);
  }
}
