import { buildLayout, getContractById, getOrderById, getUserById, formatCurrency } from '../../site';
import { Context } from 'hono';

export async function renderAdminContractDetail(c: Context, user: any, contractId: string) {
  const contract = await getContractById(c, contractId);
  if (!contract) {
    return buildLayout('合同未找到 - 电脑租赁管理系统', `<div class="panel"><h2>合同未找到</h2><p>指定的合同不存在。</p><a href="/admin/contracts" class="button">返回合同列表</a></div>`, user);
  }

  const orderId = contract.rental_id || contract.rentalId
  const order = orderId ? await getOrderById(c, orderId) : null;
  const customer = order ? await getUserById(c, order.customer_id || order.userId) : null;

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同详情</h2><span class="section-note">合同编号: ${contract.contractNumber}</span></div>

      <div class="contract-header">
        <h3>合同编号: ${contract.contractNumber}</h3>
        <p>状态: ${contract.status === 'signed' ? '已签署' : '待签署'}</p>
        <p>签署日期: ${contract.signedAt ? new Date(contract.signedAt).toLocaleString() : '未签署'}</p>
      </div>

      <div class="contract-section">
        <h4>客户信息</h4>
        <p>姓名: ${customer?.name ?? '未知'}</p>
        <p>邮箱: ${customer?.email ?? '未知'}</p>
        <p>电话: ${customer?.phone ?? '未知'}</p>
        <p>BSB: ${customer?.bsb ?? 'N/A'}</p>
        <p>Account: ${customer?.account_number ?? 'N/A'}</p>
      </div>

      <div class="contract-section">
        <h4>租赁详情</h4>
        <p>订单号: ${order?.id ?? 'N/A'}</p>
        <p>租期: ${order?.start_date || order?.startDate || 'N/A'} 至 ${order?.end_date || order?.endDate || 'N/A'} (${order?.rental_period || order?.rentalPeriod || 'N/A'} 天)</p>
        <p>租金: ${formatCurrency(order?.total_amount || order?.totalAmount || 0)}</p>
        <p>押金: ${formatCurrency(order?.deposit_amount || order?.depositAmount || 0)}</p>
      </div>

      <div class="contract-section contract-content">
        <h4>合同内容</h4>
        <div class="contract-text">
          ${contract.content}
        </div>
      </div>

      <div class="contract-actions">
        <button class="button button-primary" onclick="window.print()">打印/下载PDF</button>
        <a class="button button-info" href="/admin/contracts">返回合同管理</a>
      </div>
    </div>
  `;

  return buildLayout('合同详情 - 电脑租赁管理系统', body, user);
}