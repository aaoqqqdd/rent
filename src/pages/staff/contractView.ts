import { buildLayout, getContractByOrderId, getOrderById, getUserById } from '../../site';

export function renderStaffContractView(user: any, orderId: string) {
  const order = getOrderById(orderId);
  if (!order) {
    return buildLayout('合同查看 - 电脑租赁管理系统', `<div class="panel"><h2>订单未找到</h2><p>指定的订单不存在。</p></div>`, user);
  }

  const contract = getContractByOrderId(orderId);
  if (!contract) {
    return buildLayout('合同查看 - 电脑租赁管理系统', `<div class="panel"><h2>合同未找到</h2><p>该订单没有关联的合同。</p></div>`, user);
  }

  const customer = getUserById(order.userId);

  // 客户信息脱敏处理
  const maskedCustomerName = customer ? `${customer.name.charAt(0)}**` : '未知';
  const maskedCustomerEmail = customer ? `${customer.email.substring(0, 3)}***@***.com` : '未知';
  const maskedCustomerPhone = customer && customer.phone ? `${customer.phone.substring(0, 3)}****${customer.phone.substring(7, 11)}` : '未知';
  const maskedCustomerBsb = customer && customer.bsb ? `***-***` : 'N/A';
  const maskedCustomerAccount = customer && customer.account_number ? `****${customer.account_number.substring(customer.account_number.length - 4)}` : 'N/A';

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同详情</h2><span class="section-note">订单号: ${order.orderNo}</span></div>

      <div class="contract-header">
        <h3>合同编号: ${contract.contractNumber}</h3>
        <p>状态: ${contract.status === 'signed' ? '已签署' : '待签署'}</p>
        <p>签署日期: ${contract.signedAt ? new Date(contract.signedAt).toLocaleString() : '未签署'}</p>
      </div>

      <div class="contract-section">
        <h4>客户信息 (脱敏)</h4>
        <p>姓名: ${maskedCustomerName}</p>
        <p>邮箱: ${maskedCustomerEmail}</p>
        <p>电话: ${maskedCustomerPhone}</p>
        <p>BSB: ${maskedCustomerBsb}</p>
        <p>Account: ${maskedCustomerAccount}</p>
      </div>

      <div class="contract-section">
        <h4>租赁详情</h4>
        <p>设备: ${order.deviceName}</p>
        <p>租期: ${order.startDate} 至 ${order.endDate} (${order.rentalPeriod} 天)</p>
        <p>租金: $${order.totalAmount}</p>
        <p>押金: $${order.depositAmount}</p>
      </div>

      <div class="contract-section contract-content">
        <h4>合同内容</h4>
        <div class="contract-text">
          ${contract.content}
        </div>
      </div>

      <div class="contract-actions">
        <button class="button button-primary" onclick="window.print()">打印/下载PDF</button>
        <a class="button button-info" href="/staff/contracts">返回合同管理</a>
      </div>
    </div>
  `;

  return buildLayout('合同查看 - 电脑租赁管理系统', body, user);
}