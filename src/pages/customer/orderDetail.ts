import { buildLayout, getOrderById, getDeviceById, formatCurrency, getContractByOrderId, systemSettings } from '../../site';

export function renderCustomerOrderDetail(user: any, orderId: string, message?: string, type: 'success' | 'error' = 'error') {
  const order = getOrderById(orderId)
  if (!order || order.userId !== user.id) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在或无权访问。</p></div>', user)
  }
  const device = getDeviceById(order.deviceId)
  const contract = getContractByOrderId(order.id)
  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : ''

  const body = `
    <div class="panel">
      <div class="section-title"><h2>订单详情 #${order.orderNo}</h2><span class="section-note">查看订单状态、设备信息、租金明细及合同。</span></div>
      ${alertMessage}
      <div class="grid grid-2">
        <div>
          <h3>订单信息</h3>
          <p><strong>订单状态:</strong> ${order.status}</p>
          <p><strong>下单时间:</strong> ${order.orderDate}</p>
          <p><strong>租期:</strong> ${order.startDate} 至 ${order.endDate}</p>
          <p><strong>总金额:</strong> ${formatCurrency(order.totalAmount)}</p>
          <p><strong>押金:</strong> ${formatCurrency(order.depositAmount)}</p>
          <p><strong>租金:</strong> ${formatCurrency(order.totalAmount - order.depositAmount)}</p>
        </div>
        <div>
          <h3>设备信息</h3>
          <p><strong>设备名称:</strong> ${device?.name ?? '未知设备'}</p>
          <p><strong>设备型号:</strong> ${device?.model ?? 'N/A'}</p>
          <p><strong>序列号:</strong> ${device?.serialNumber ?? 'N/A'}</p>
          <p><strong>日租金:</strong> ${formatCurrency(device?.dailyRate ?? 0)}</p>
        </div>
      </div>

      ${contract ? `
        <div class="section-title" style="margin-top: 24px;"><h3>租赁合同</h3></div>
        <div class="contract-actions" style="margin-bottom: 16px; display: flex; gap: 12px;">
          <a class="button" href="/contract/view/${contract.id}" target="_blank">查看合同</a>
          ${contract.status === 'pending_sign' ? `<a class="button button-primary" href="/contract/sign/${contract.id}">签署合同</a>` : ''}
        </div>
      ` : '<p style="margin-top: 24px;">暂无相关租赁合同。</p>'}

      ${order.status === 'pending_payment' ? `
        <div class="section-title" style="margin-top: 24px;"><h3>支付信息</h3></div>
        <div class="payment-options" style="display: flex; gap: 20px; margin-top: 16px;">
          <div class="payment-card">
            <h4>银行转账</h4>
            <p><strong>银行名称:</strong> ${systemSettings.bankDetails.accountName}</p>
            <p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p>
            <p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>
            <p>请转账 ${formatCurrency(order.totalAmount)} 到以上账户，并在备注中填写订单号 ${order.orderNo}。</p>
            <button class="button" onclick="alert('请完成银行转账后联系客服确认。')">我已转账</button>
          </div>
          <div class="payment-card">
            <h4>信用卡支付 (Square)</h4>
            <p>通过 Square 安全支付网关使用信用卡支付。</p>
            <form id="square-payment-form" method="POST" action="/customer/pay-square">
              <input type="hidden" name="orderId" value="${order.id}" />
              <div id="payment-form">
                <div id="card-container"></div>
                <button id="card-button" class="button button-primary" type="submit">支付 ${formatCurrency(order.totalAmount)}</button>
              </div>
            </form>
            <script type="text/javascript" src="https://js.squareupsandbox.com/v2/paymentform"></script>
            <script type="text/javascript">
              const payments = Square.payments('${systemSettings.squareConfig.applicationId}', '${systemSettings.squareConfig.locationId}');
              let card;
              async function initializeCard() {
                card = await payments.card({
                  elementId: 'card-container'
                });
                await card.attach('#card-container');
              }
              async function tokenize(paymentMethod) {
                const tokenResult = await paymentMethod.tokenize();
                if (tokenResult.status === 'OK') {
                  return tokenResult.token;
                } else {
                  let errorMessage = 'Tokenization failed with status: ' + tokenResult.status;
                  if (tokenResult.errors) {
                    errorMessage += '\\nErrors: ' + JSON.stringify(tokenResult.errors);
                  }
                  throw new Error(errorMessage);
                }
              }
              document.addEventListener('DOMContentLoaded', async function() {
                await initializeCard();
                const form = document.getElementById('square-payment-form');
                form.addEventListener('submit', async function(event) {
                  event.preventDefault();
                  try {
                    const token = await tokenize(card);
                    const hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.name = 'token';
                    hiddenInput.value = token;
                    form.appendChild(hiddenInput);
                    form.submit();
                  } catch (e) {
                    alert('支付失败: ' + e.message);
                  }
                });
              });
            </script>
          </div>
        </div>
      ` : ''}
    </div>
  `
  return buildLayout('订单详情 - 电脑租赁管理系统', body, user)
}