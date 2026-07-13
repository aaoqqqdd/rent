import { buildLayout, getContractById, getOrderById, getUserById } from '../../site';

export function renderAdminContractDetail(user: any, contractId: string) {
  const contract = getContractById(contractId);
  if (!contract) {
    return buildLayout('合同详情 - 电脑租赁管理系统', `<div class="panel"><h2>合同未找到</h2><p>指定的合同不存在。</p></div>`, user);
  }

  const order = getOrderById(contract.rentalId);
  const customer = order ? getUserById(order.userId) : null;

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
        <p>订单号: ${order?.orderNo ?? 'N/A'}</p>
        <p>设备: ${order?.deviceName ?? 'N/A'}</p>
        <p>租期: ${order?.startDate ?? 'N/A'} 至 ${order?.endDate ?? 'N/A'} (${order?.rentalPeriod ?? 'N/A'} 天)</p>
        <p>租金: $${order?.totalAmount ?? '0.00'}</p>
        <p>押金: $${order?.depositAmount ?? '0.00'}</p>
      </div>

      <div class="contract-section contract-content">
        <h4>合同内容</h4>
        <div class="contract-text">
          ${contract.content}
        </div>
      </div>

      <div class="contract-actions">
        <button class="button button-primary" onclick="window.print()">打印合同</button>
        <a class="button button-secondary" href="/admin/contract/${contract.id}/download-pdf">下载PDF</a>
        <a class="button button-info" href="/admin/contracts">返回合同管理</a>
      </div>
    </div>
  `;

  return buildLayout('合同详情 - 电脑租赁管理系统', body, user);
}