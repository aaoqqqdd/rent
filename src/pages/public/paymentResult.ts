import { buildLayout, getOrderById, getContractByOrderId, formatCurrency } from '../../site';

export function renderPaymentResult(orderId: string, status: 'success' | 'fail', user: any) {
  const order = getOrderById(orderId);
  const contract = order ? getContractByOrderId(order.id) : null;

  let title = '';
  let message = '';
  let icon = '';
  let buttonText = '查看订单详情';
  let buttonLink = `/customer/orders/${orderId}`;

  if (status === 'success') {
    title = '支付成功！';
    message = `您的订单 #${order?.orderNo ?? 'N/A'} 已成功支付 ${formatCurrency(order?.totalAmount ?? 0)}。`;
    icon = '✅';
  } else {
    title = '支付失败';
    message = `您的订单 #${order?.orderNo ?? 'N/A'} 支付未能成功。请重试或选择其他支付方式。`;
    icon = '❌';
    buttonText = '返回订单支付';
    buttonLink = `/customer/orders/${orderId}`; // Assuming user can retry payment from order detail
  }

  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 500px; text-align: center;">
        <div style="font-size: 4rem; margin-bottom: 20px;">${icon}</div>
        <h2>${title}</h2>
        <p>${message}</p>
        ${contract ? `<p>合同编号: ${contract.contractNumber}</p>` : ''}
        <a class="button button-primary" href="${buttonLink}" style="margin-top: 20px;">${buttonText}</a>
        ${contract ? `<a class="button button-secondary" href="/contract/view/${contract.id}" style="margin-top: 10px;">查看合同</a>` : ''}
      </div>
    </div>
  `;

  return buildLayout('支付结果 - 电脑租赁管理系统', body, user);
}