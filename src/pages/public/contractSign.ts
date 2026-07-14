import { buildLayout, getContractBySignToken, getOrderById, getDeviceById, formatCurrency, getSystemSettings, getContractTemplate, rentalTerms } from '../../site';
import { Context } from 'hono';

export async function renderContractSignPage(c: Context, token: string, step: number, errorMessage?: string, userInput: Record<string, string> = {}) {
  const contract = getContractBySignToken(token);
  if (!contract) {
    return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>合同链接无效或已过期</h2><p>请联系工作人员获取新的签约链接。</p></div>');
  }

  const order = getOrderById(contract.rentalId);
  if (!order) {
    return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>合同关联的订单不存在，请联系我们。</p></div>');
  }

  const device = getDeviceById(order.deviceId);
  const systemSettings = getSystemSettings();
  const contractTemplate = await getContractTemplate(c);
  const activeContractContent = contract.content || contractTemplate.content || systemSettings.rentalTerms;
  const contractHtml = /<[^>]+>/.test(activeContractContent)
    ? activeContractContent
    : activeContractContent.replace(/\n/g, '<br>');

  let content = '';
  let title = '合同签署';

  // 简单的进度条
  const progressBar = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f3f4f6; border-radius: 8px;">
      <div style="flex:1; text-align:center; padding: 8px; border-radius: 6px; ${step >= 1 ? 'background: #3b82f6; color: white;' : ''}">1. 同意协议</div>
      <div style="flex:1; text-align:center; padding: 8px; border-radius: 6px; ${step >= 2 ? 'background: #3b82f6; color: white;' : ''}">2. 填写信息</div>
      <div style="flex:1; text-align:center; padding: 8px; border-radius: 6px; ${step >= 3 ? 'background: #3b82f6; color: white;' : ''}">3. 选择支付</div>
    </div>
  `;

  switch (step) {
    case 1:
      title = '步骤 1/3: 阅读并同意租赁协议';
      content = `
        <div class="panel">
          ${progressBar}
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert" style="background:#fee2e2;border-color:#fecaca;">${errorMessage}</div>` : ''}
          
          <h3>${contractTemplate?.name ?? '租赁合同模板'}</h3>
          <div class="contract-content" style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; max-height: 360px; overflow-y: auto; margin-bottom: 20px; background: #f9fafb;">
            ${rentalTerms}
          </div>
          


          <form method="POST" action="/contract/sign?token=${token}&step=1">
            <label class="form-check" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" name="agreeTerms" required style="width: auto;"/> 
              <span>我已仔细阅读并完全同意上述所有租赁条款。</span>
            </label>
            <button class="button" type="submit" style="margin-top: 20px;">同意并进入下一步</button>
          </form>
        </div>
      `;
      break;
    case 2:
      title = '步骤 2/3: 填写您的信息';
      content = `
        <div class="panel">
          ${progressBar}
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert" style="background:#fee2e2;border-color:#fecaca;">${errorMessage}</div>` : ''}
          <form method="POST" action="/contract/sign?token=${token}&step=2">
            <div class="grid grid-2">
              <div class="form-group">
                <label class="form-label" for="name">姓名</label>
                <input id="name" class="form-control" name="name" value="${userInput.name ?? ''}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="email">电子邮箱</label>
                <input id="email" class="form-control" type="email" name="email" value="${userInput.email ?? ''}" required />
              </div>
            </div>
            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label" for="phone">联系电话</label>
              <div style="display: flex; gap: 12px; align-items: start;">
                <div style="width: 140px;">
                  <select id="phoneCode" name="phoneCode" class="form-control" style="width: 100%;" required onchange="validatePhoneNumber()">
                    <option value="+86" ${userInput.phoneCode === '+86' ? 'selected' : ''}>+86 中国</option>
                    <option value="+61" ${userInput.phoneCode === '+61' ? 'selected' : ''}>+61 澳大利亚</option>
                    <option value="+1" ${userInput.phoneCode === '+1' ? 'selected' : ''}>+1 美国/加拿大</option>
                    <option value="+44" ${userInput.phoneCode === '+44' ? 'selected' : ''}>+44 英国</option>
                    <option value="+852" ${userInput.phoneCode === '+852' ? 'selected' : ''}>+852 香港</option>
                    <option value="+886" ${userInput.phoneCode === '+886' ? 'selected' : ''}>+886 台湾</option>
                    <option value="+65" ${userInput.phoneCode === '+65' ? 'selected' : ''}>+65 新加坡</option>
                    <option value="+82" ${userInput.phoneCode === '+82' ? 'selected' : ''}>+82 韩国</option>
                    <option value="+81" ${userInput.phoneCode === '+81' ? 'selected' : ''}>+81 日本</option>
                  </select>
                </div>
                <div style="flex: 1;">
                  <input id="phone" class="form-control" name="phone" value="${userInput.phone ?? ''}" oninput="validatePhoneNumber()" required placeholder="请输入手机号码" />
                  <span id="phoneError" style="color: #ef4444; font-size: 14px; display: none;">电话号码格式不正确，请检查输入</span>
                </div>
              </div>
            </div>
            
            <!-- 推荐人代码输入框 -->
            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label" for="referrer">推荐人代码（选填）</label>
              <input id="referrer" class="form-control" name="referrer" value="${userInput.referrer ?? ''}" placeholder="如有推荐人请填写推荐码" />
              <p class="form-text" style="font-size: 12px; color: #6b7280; margin-top: 4px;">填写推荐人代码后将无法更改，系统会自动为推荐人计算佣金分成</p>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 24px; margin-bottom: 16px;">
              <input type="checkbox" id="createAccountCheckbox" name="createAccount" style="width: auto;" onchange="togglePasswordFields()" />
              <label for="createAccountCheckbox" style="margin: 0;">创建账户 (用于管理您的订单)</label>
            </div>

            <div id="passwordFields" style="display: none;">
              <div class="grid grid-2">
                <div class="form-group">
                  <label class="form-label" for="password">设置密码</label>
                  <input id="password" class="form-control" type="password" name="password" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="passwordConfirm">确认密码</label>
                  <input id="passwordConfirm" class="form-control" type="password" name="passwordConfirm" />
                </div>
              </div>
            </div>

            <script>
              function togglePasswordFields() {
                const checkbox = document.getElementById('createAccountCheckbox');
                const passwordFields = document.getElementById('passwordFields');
                const passwordInput = document.getElementById('password');
                const passwordConfirmInput = document.getElementById('passwordConfirm');

                if (checkbox.checked) {
                  passwordFields.style.display = 'block';
                  passwordInput.required = true;
                  passwordConfirmInput.required = true;
                } else {
                  passwordFields.style.display = 'none';
                  passwordInput.required = false;
                  passwordConfirmInput.required = false;
                }
              }

              function validatePhoneNumber() {
                const phoneCode = document.getElementById('phoneCode').value;
                const phoneNumber = document.getElementById('phone').value.trim();
                const phoneError = document.getElementById('phoneError');
                let isValid = false;
                
                // 根据不同国家的电话号码格式进行验证
                const phonePatterns = {
                  '+86': /^1[3-9]\d{9}$/, // 中国手机号: 11位
                  '+61': /^4\d{8}$/, // 澳大利亚手机号: 9位 (以4开头)
                  '+1': /^\d{10}$/, // 美国/加拿手机号: 10位
                  '+44': /^7\d{9}$/, // 英国手机号: 10位 (以7开头)
                  '+852': /^[569]\d{7}$/, // 香港手机号: 8位
                  '+886': /^9\d{8}$/, // 台湾手机号: 9位
                  '+65': /^[89]\d{7}$/, // 新加坡手机号: 8位
                  '+82': /^1[0-9]\d{7,8}$/, // 韩国手机号
                  '+81': /^[789]0\d{8}$/ // 日本手机号
                };
                
                const pattern = phonePatterns[phoneCode];
                if (pattern && pattern.test(phoneNumber)) {
                  isValid = true;
                }
                
                if (isValid || phoneNumber === '') {
                  phoneError.style.display = 'none';
                  return true;
                } else {
                  phoneError.style.display = 'block';
                  return false;
                }
              }

              // 表单提交前验证
              document.querySelector('form').addEventListener('submit', function(e) {
                if (!validatePhoneNumber()) {
                  e.preventDefault();
                  alert('请输入正确格式的电话号码');
                }
              });
              
              // 页面加载时也调用一次，以防浏览器记住勾选状态
              document.addEventListener('DOMContentLoaded', function() {
                togglePasswordFields();
              });
            </script>
            
            <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
              <a href="/contract/sign?token=${token}&step=1" class="button-secondary">返回上一步</a>
              <button class="button" type="submit">保存信息并进入下一步</button>
            </div>
          </form>
        </div>
      `;
      break;
    case 3:
      title = '步骤 3/3: 选择付款方式';
      content = `
        <div class="panel">
          ${progressBar}
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert" style="background:#fee2e2;border-color:#fecaca;">${errorMessage}</div>` : ''}
          
          <div class="alert">
            <strong>应付总额: ${formatCurrency(order.totalAmount)}</strong> (租金 + 押金)
          </div>

          <form method="POST" action="/contract/sign?token=${token}&step=3">
            <div class="payment-options" style="display: flex; flex-direction: column; gap: 15px;">
              ${systemSettings.paymentMethods.square ? `
              <label class="card" style="cursor: pointer; padding: 16px;">
                <input type="radio" name="paymentMethod" value="square" required />
                <strong style="margin-left: 8px;">信用卡支付 (Square)</strong>
                <p class="text-muted" style="margin: 4px 0 0 24px;">通过 Square 安全支付网关，支持 Visa, MasterCard, AMEX 等。</p>
              </label>
              ` : ''}
              ${systemSettings.paymentMethods.bankTransfer ? `
              <label class="card" style="cursor: pointer; padding: 16px;">
                <input type="radio" name="paymentMethod" value="bank_transfer" required />
                <strong style="margin-left: 8px;">银行转账</strong>
                <p class="text-muted" style="margin: 4px 0 0 24px;">请转账至 BSB: ${systemSettings.bankDetails.bsb}, Account: ${systemSettings.bankDetails.account}。转账后请上传凭证。</p>
              </label>
              ` : ''}
            </div>
            <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
              <a href="/contract/sign?token=${token}&step=2" class="button-secondary">返回上一步</a>
              <button class="button" type="submit">确认并完成签约</button>
            </div>
          </form>
        </div>
      `;
      break;
    default:
      content = '<div class="panel"><h2>无效的步骤</h2><p>请从第一步开始签署合同。 <a href="/contract/sign?token=${token}&step=1">点击这里返回第一步</a></p></div>';
      break;
  }

  return buildLayout(title, content);
}