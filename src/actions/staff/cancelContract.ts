/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono';
import { getContractById, updateContractStatus, logError, findUserBySession, getOrderById, updateDeviceStatus } from '../../site'; // 导入 getOrderById 和 updateDeviceStatus

export async function handleCancelContractAction(c: Context): Promise<Response> {
  const contractId = c.req.param('id');

  if (!contractId) {
    await logError(c, 'WARNING', 'Attempted to cancel contract without ID');
    return c.redirect('/staff/contracts?error=Contract ID is missing');
  }

  try {
    const user = await findUserBySession(c, c.req.header('cookie') ?? null);
    if (!user) {
      await logError(c, 'WARNING', `Unauthorized attempt to cancel contract. Contract ID: ${contractId}`);
      return c.redirect('/login?error=Please log in first');
    }

    const contract = await getContractById(c, contractId);

    if (!contract) {
      await logError(c, 'WARNING', `Contract not found for ID: ${contractId}`);
      return c.redirect(`/staff/contracts?error=Contract not found`);
    }

    if (contract.status !== 'pending_sign') {
      await logError(c, 'WARNING', `Attempted to cancel a contract not in 'pending_sign' status. Contract ID: ${contractId}, Current Status: ${contract.status}`);
      return c.redirect(`/staff/contracts?error=Only pending contracts can be cancelled`);
    }

    const isAdmin = user.role === 'ADMIN';
    const isCreator = contract.created_by === user.id || contract.createdBy === user.id;

    if (!isAdmin && !isCreator) {
      await logError(c, 'WARNING', `Permission denied: User ${user.id} attempted to cancel contract ${contractId} created by ${contract.created_by}`);
      return c.redirect(`/staff/contracts?error=You don't have permission to cancel this contract`);
    }

    await updateContractStatus(c, contractId, 'cancelled');

    // 新增逻辑：如果合同关联了订单，则将订单中的设备状态更新为可用
    if (contract.rentalId) {
      const order = await getOrderById(c, contract.rentalId);
      if (order && order.deviceId) {
        await updateDeviceStatus(c, order.deviceId, 'available');
        await logError(c, 'INFO', `Device ${order.deviceId} status updated to 'available' after contract ${contractId} cancellation.`);
      }
    }

    await logError(c, 'INFO', `Contract cancelled successfully. Contract ID: ${contractId}, Cancelled by: ${user.id}`);
    return c.redirect('/staff/contracts?success=Contract cancelled successfully');
  } catch (error) {
    await logError(c, 'ERROR', `Failed to cancel contract. Contract ID: ${contractId}`, error as Error);
    return c.redirect(`/staff/contracts?error=Failed to cancel contract`);
  }
}
