import { Context } from 'hono';
import { getContractById, updateContractStatus, logError, findUserBySession } from '../../site';

export async function handleCancelContractAction(c: Context): Promise<Response> {
  const contractId = c.req.param('id');

  if (!contractId) {
    await logError(c, 'WARNING', 'Attempted to cancel contract without ID');
    return c.redirect('/staff/contracts?error=Contract ID is missing');
  }

  try {
    // 获取当前用户信息（传入 cookie header）
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

    // 权限检查：只有管理员或合同创建人才能取消合同
    const isAdmin = user.role === 'ADMIN';
    const isCreator = contract.created_by === user.id || contract.createdBy === user.id;
    
    if (!isAdmin && !isCreator) {
      await logError(c, 'WARNING', `Permission denied: User ${user.id} attempted to cancel contract ${contractId} created by ${contract.created_by}`);
      return c.redirect(`/staff/contracts?error=You don't have permission to cancel this contract`);
    }

    await updateContractStatus(c, contractId, 'cancelled');
    await logError(c, 'INFO', `Contract cancelled successfully. Contract ID: ${contractId}, Cancelled by: ${user.id}`);
    return c.redirect('/staff/contracts?success=Contract cancelled successfully');
  } catch (error) {
    await logError(c, 'ERROR', `Failed to cancel contract. Contract ID: ${contractId}`, error as Error);
    return c.redirect(`/staff/contracts?error=Failed to cancel contract`);
  }
}