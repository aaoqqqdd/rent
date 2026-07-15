import { buildLayout, getOrderById, getContractByOrderId, formatCurrency } from '../../site';

export async function renderPaymentResult(orderId: string, status: 'success' | 'fail', user: any) {
  const order = await getOrderById(orderId);
  const contract = order ? await getContractByOrderId(order.id) : null;

  let title = '';
  let message = '';
  let icon = '';
  let buttonText = '查看订单详情';
  let buttonLink = `/customer/orders/${orderId}`;
  let cardClass = '';

  if (status === 'success') {
    title = '支付成功！';
    message = `您的订单 <strong>#${order?.orderNo ?? 'N/A'}</strong> 已成功支付 <strong>${formatCurrency(order?.totalAmount ?? 0)}</strong>。`;
    icon = `
      <div class="icon-wrapper success">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    `;
    cardClass = 'success';
  } else {
    title = '支付失败';
    message = `您的订单 <strong>#${order?.orderNo ?? 'N/A'}</strong> 支付未能成功。请重试或选择其他支付方式。`;
    icon = `
      <div class="icon-wrapper danger">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    `;
    cardClass = 'danger';
    buttonText = '返回订单支付';
    buttonLink = `/customer/orders/${orderId}`;
  }

  const body = `
    <style>
      .payment-result-card {
        background: var(--surface);
        border-radius: var(--radius-lg);
        padding: 40px 36px;
        border: 1px solid var(--border);
        box-shadow: var(--shadow-lg);
        max-width: 480px;
        width: 100%;
        text-align: center;
      }
      .icon-wrapper {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
      }
      .icon-wrapper.success {
        background: var(--success-light);
        color: var(--success);
      }
      .icon-wrapper.danger {
        background: var(--danger-light);
        color: var(--danger);
      }
      .icon-wrapper svg {
        width: 32px;
        height: 32px;
      }
      .payment-result-card h2 {
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--text);
      }
      .payment-result-card p {
        color: var(--text-secondary);
        font-size: 0.95rem;
        line-height: 1.6;
        margin-bottom: 24px;
      }
      .button-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 24px;
      }
    </style>
    <div class="page-centered">
      <div class="payment-result-card ${cardClass}">
        ${icon}
        <h2>${title}</h2>
        <p>${message}</p>
        ${contract ? `<p style="font-size: 0.85rem; color: var(--text-tertiary);">合同编号: <span class="mono">${contract.contractNumber}</span></p>` : ''}
        <div class="button-group">
          <a class="button" href="${buttonLink}">${buttonText}</a>
          ${contract ? `<a class="button button-secondary" href="/contract/view/${contract.id}">查看合同</a>` : ''}
        </div>
      </div>
    </div>
  `;

  return buildLayout('支付结果 - 电脑租赁管理系统', body, user);
}