import { Context } from 'hono';
import { getContractById, updateContractStatus, logError } from '../../site';

export async function handleCancelContractAction(c: Context): Promise<Response> {
  const contractId = c.req.param('id');

  if (!contractId) {
    await logError(c, 'WARNING', 'Attempted to cancel contract without ID');
    return c.redirect('/staff/contracts?error=Contract ID is missing');
  }

  try {
    const contract = await getContractById(c, contractId);

    if (!contract) {
      await logError(c, 'WARNING', `Contract not found for ID: ${contractId}`);
      return c.redirect(`/staff/contracts?error=Contract not found`);
    }

    if (contract.status !== 'pending_sign') {
      await logError(c, 'WARNING', `Attempted to cancel a contract not in 'pending_sign' status. Contract ID: ${contractId}, Current Status: ${contract.status}`);
      return c.redirect(`/staff/contracts?error=Only pending contracts can be cancelled`);
    }

    await updateContractStatus(c, contractId, 'cancelled');
    await logError(c, 'INFO', `Contract cancelled successfully. Contract ID: ${contractId}`);
    return c.redirect('/staff/contracts?success=Contract cancelled successfully');
  } catch (error) {
    await logError(c, 'ERROR', `Failed to cancel contract. Contract ID: ${contractId}`, error as Error);
    return c.redirect(`/staff/contracts?error=Failed to cancel contract`);
  }
}