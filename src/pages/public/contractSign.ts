import { buildLayout, getContractById, getOrderById, getDeviceById, getUserById, formatCurrency } from '../../site';

export function renderContractSign(contractId: string, step: number, errorMessage?: string) {
  const contract = getContractById(contractId);
  if (!contract) {
    return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>合同未找到</h2><p>您请求的合同不存在。</p></div>');
  }
  const order = getOrderById(contract.rentalId);
  if (!order) {
    return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>合同关联的订单不存在。</p></div>');
  }
  const device = getDeviceById(order.deviceId);
  const customer = getUserById(order.userId);

  let content = '';
  let title = '合同签署';

  switch (step) {
    case 1:
      title = '步骤 1/4: 租赁协议';
      content = `
        <div class="panel">
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
          <div class="contract-content" style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; max-height: 400px; overflow-y: scroll; margin-bottom: 20px;">
            ${contract.content}
          </div>
          <form method="POST" action="/contract/sign/${contract.id}?s=1">
            <label class="form-check">
              <input type="checkbox" name="agreeTerms" required /> 我已阅读并同意以上租赁协议条款
            </label>
            <button class="button button-primary" type="submit" style="margin-top: 20px;">下一步</button>
          </form>
        </div>
      `;
      break;
    case 2:
      title = '步骤 2/4: 租赁详情';
      content = `
        <div class="panel">
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
          <h3>设备信息</h3>
          <p><strong>设备名称:</strong> ${device?.name ?? '未知设备'}</p>
          <p><strong>型号:</strong> ${device?.model ?? 'N/A'}</p>
          <p><strong>序列号:</strong> ${device?.serialNumber ?? 'N/A'}</p>
          <p><strong>日租金:</strong> ${formatCurrency(device?.dailyRate ?? 0)}</p>

          <h3>租期与费用</h3>
          <p><strong>租期:</strong> ${order.startDate} 至 ${order.endDate}</p>
          <p><strong>总租金:</strong> ${formatCurrency(order.totalAmount - order.depositAmount)}</p>
          <p><strong>押金:</strong> ${formatCurrency(order.depositAmount)}</p>
          <p><strong>总计:</strong> ${formatCurrency(order.totalAmount)}</p>

          <form method="POST" action="/contract/sign/${contract.id}?s=2">
            <label class="form-label">配送方式</label>
            <select class="form-control" name="deliveryMethod">
              <option value="pickup">自取</option>
              <option value="delivery">快递配送</option>
            </select>
            <button class="button button-primary" type="submit" style="margin-top: 20px;">下一步</button>
          </form>
        </div>
      `;
      break;
    case 3:
      title = '步骤 3/4: 填写客户信息';
      content = `
        <div class="panel">
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
          <form method="POST" action="/contract/sign/${contract.id}?s=3">
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${customer?.name ?? ''}" required />
            <label class="form-label">邮箱</label>
            <input class="form-control" type="email" name="email" value="${customer?.email ?? ''}" required />
            <label class="form-label">联系电话</label>
            <input class="form-control" name="phone" value="${customer?.phone ?? ''}" />
            <label class="form-label">BSB (银行代码)</label>
            <input class="form-control" name="bsb" value="${customer?.bsb ?? ''}" />
            <label class="form-label">Account Number (银行账号)</label>
            <input class="form-control" name="account" value="${customer?.account ?? ''}" />
            <label class="form-label">推荐人ID/推荐码 (选填)</label>
            <input class="form-control" name="referrer" value="" />
            <div style="margin-top: 12px; margin-bottom: 20px;">
              <label class="form-check">
                <input type="checkbox" name="registerNewAccount" id="registerNewAccount" /> 注册为新账户
              </label>
            </div>
            <div id="newAccountFields" style="display: none;">
              <label class="form-label">设置密码</label>
              <input class="form-control" type="password" name="password" />
              <label class="form-label">确认密码</label>
              <input class="form-control" type="password" name="passwordConfirm" />
            </div>
            <button class="button button-primary" type="submit" style="margin-top: 20px;">下一步</button>
          </form>
          <script>
            document.getElementById('registerNewAccount').addEventListener('change', function() {
              document.getElementById('newAccountFields').style.display = this.checked ? 'block' : 'none';
            });
          </script>
        </div>
      `;
      break;
    case 4:
      title = '步骤 4/4: 选择付款方式';
      content = `
        <div class="panel">
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
          <form method="POST" action="/contract/sign/${contract.id}?s=4">
            <div class="payment-options" style="display: flex; flex-direction: column; gap: 15px;">
              <label class="payment-option-card">
                <input type="radio" name="paymentMethod" value="square" required />
                <div>
                  <h4>信用卡支付 (Square)</h4>
                  <p>通过 Square 安全支付网关使用信用卡支付。</p>
                </div>
              </label>
              <label class="payment-option-card">
                <input type="radio" name="paymentMethod" value="bank_transfer" required />
                <div>
                  <h4>银行转账</h4>
                  <p>请转账至指定账户，并上传转账凭证。</p>
                </div>
              </label>
              ${customer && customer.balance > 0 ? `
                <label class="payment-option-card">
                  <input type="radio" name="paymentMethod" value="balance" required />
                  <div>
                    <h4>余额支付</h4>
                    <p>使用账户余额 ${formatCurrency(customer.balance)} 支付。</p>
                  </div>
                </label>
              ` : ''}
            </div>
            <button class="button button-primary" type="submit" style="margin-top: 20px;">确认并支付</button>
          </form>
        </div>
      `;
      break;
    default:
      content = '<div class="panel"><h2>无效的步骤</h2><p>请从第一步开始签署合同。</p></div>';
      break;
  }

  return buildLayout(title, content);
}