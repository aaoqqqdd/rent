import { buildLayout, getContractBySignToken, getContractByContractNumber, getOrderById, getDeviceById, formatCurrency, getSystemSettings, getContractTemplate, rentalTerms, findUserBySession } from '../../site';
import { Context } from 'hono';

export async function renderContractSignPage(c: Context, tokenOrNumber: string, step: number, errorMessage?: string, userInput: Record<string, string> = {}) {
  console.log('renderContractSignPage called with tokenOrNumber:', tokenOrNumber); // 添加日志
  const currentUser = await findUserBySession(c, c.req.header('cookie') ?? null);
  let contract = await getContractBySignToken(c, tokenOrNumber);
  
  // 如果通过token找不到，尝试用合同编号查找（支持新的链接格式）
  if (!contract) {
    contract = await getContractByContractNumber(c, tokenOrNumber);
  }

  // 在模板中使用的 `token` 变量，映射传入的 tokenOrNumber
  const token = tokenOrNumber;
  
  if (!contract) {
    console.error('Contract not found for tokenOrNumber:', tokenOrNumber); // 添加日志
    return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>合同链接无效或已过期</h2><p>请联系工作人员获取新的签约链接。</p></div>');
  }

  console.log('Contract found:', contract); // 添加日志，查看合同详情

  // 检查合同是否已过期
  const signExpiresAt = contract.signExpiresAt || contract.sign_expires_at;
  if (signExpiresAt && contract.status === 'pending_sign') {
    const now = new Date();
    const expiryDate = new Date(signExpiresAt);
    if (now > expiryDate) {
      // 将过期合同状态更新为已取消
      await import('../../site').then(site => site.updateContractStatusInDB(c, contract.id, 'cancelled'));
      return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>合同链接已过期</h2><p>该签约链接已超过有效期，请联系工作人员重新生成新的签约链接。</p></div>');
    }
  }

  // 如果合同已经被取消，也显示过期提示
  if (contract.status === 'cancelled') {
    return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>合同链接已失效</h2><p>该合同已被取消或已过期，请联系工作人员获取新的签约链接。</p></div>');
  }

  // 统一处理rentalId和rental_id字段，确保能正确获取订单ID
  // const orderId = contract.rentalId || contract.rental_id;
  // console.log('Attempting to fetch order with orderId:', orderId, 'from contract.rentalId:', contract.rentalId, 'or contract.rental_id:', contract.rental_id); // 添加日志
  // const order = await getOrderById(c, orderId);
  // if (!order) {
  //   console.error('Order not found for orderId:', orderId);
  //   return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>合同关联的订单不存在，请联系我们。</p></div>');
  // }

  let order = null; // 声明 order 变量
  let device = null; // 声明 device 变量

  const systemSettings = getSystemSettings();
  const contractTemplate = await getContractTemplate(c);
  
  // 替换 activeContractContent 中的变量
  const replaceVariables = (content: string, order: any, device: any, user: any) => {
    if (!content) return '';
    let replacedContent = content;
    if (order) {
      replacedContent = replacedContent.replace(/{{orderNo}}/g, order.orderNo);
      replacedContent = replacedContent.replace(/{{startDate}}/g, new Date(order.startDate).toLocaleDateString());
      replacedContent = replacedContent.replace(/{{endDate}}/g, new Date(order.endDate).toLocaleDateString());
      replacedContent = replacedContent.replace(/{{rentalPeriod}}/g, order.rentalPeriod);
      replacedContent = replacedContent.replace(/{{totalAmount}}/g, formatCurrency(order.totalAmount));
      replacedContent = replacedContent.replace(/{{depositAmount}}/g, formatCurrency(order.depositAmount));
      replacedContent = replacedContent.replace(/{{dailyRate}}/g, formatCurrency(order.dailyRate));
    }
    if (device) {
      replacedContent = replacedContent.replace(/{{deviceName}}/g, device.name);
      replacedContent = replacedContent.replace(/{{deviceModel}}/g, device.model);
      replacedContent = replacedContent.replace(/{{deviceSerial}}/g, device.serialNumber);
    }
    if (user) {
      replacedContent = replacedContent.replace(/{{userName}}/g, user.name);
      replacedContent = replacedContent.replace(/{{userEmail}}/g, user.email);
      replacedContent = replacedContent.replace(/{{userPhone}}/g, user.phone);
    }
    return replacedContent;
  };

  const activeContractContent = replaceVariables(contract.content || contractTemplate.content || systemSettings.rentalTerms, order, device, currentUser);
  
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
          <h2>阅读并同意租赁协议</h2>
          ${errorMessage ? `<div class="alert" style="background:#fee2e2;border-color:#fecaca;">${errorMessage}</div>` : ''}
          
          <div class="contract-content" style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; max-height: 360px; overflow-y: auto; margin-bottom: 20px; background: #f9fafb;">
            ${contractHtml}
          </div>
          


          <form method="POST" action="/contract/sign?${tokenOrNumber === contract.contractNumber ? `number=${tokenOrNumber}` : `token=${tokenOrNumber}`}&step=1">
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
          
          ${errorMessage ? `
            <div id="error-container" class="alert" style="background:#fee2e2;border-color:#fecaca;">
              ${errorMessage === 'EMAIL_EXISTS' ? 
                `
                <p><strong>此电子邮箱已被注册。</strong></p>
                <p>您可以选择直接继续，合同将自动关联到您的账户下；或者您可以选择登录后继续。</p>
                <div style="margin-top: 16px;">
                  <button type="button" class="button" onclick="continueWithExistingEmail()">直接继续</button>
                  <a href="/login?redirect=/contract/sign?token=${token}%26step=2" class="button-secondary" style="margin-left: 12px;">立即登录</a>
                </div>
                ` : 
                errorMessage
              }
            </div>
          ` : ''}

          <form method="POST" action="/contract/sign?token=${token}&step=2" id="sign-form">
            <input type="hidden" name="force_continue" id="force_continue" value="false" />
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
                  <select id="phoneCode" name="phoneCode" class="form-control" style="width: 100%;" required onchange="validatePhoneNumber(); updatePlaceholder()">
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
                  <input id="phone" class="form-control" name="phone" value="${userInput.phone ?? ''}" oninput="validatePhoneNumber(); updatePlaceholder()" required placeholder="请输入手机号码" />
                  <span id="phoneError" style="color: #ef4444; font-size: 14px; display: none;"></span>
                </div>
              </div>
            </div>
            
            <!-- 推荐人代码输入框 -->
            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label" for="referrer">推荐人代码（选填）</label>
              <input id="referrer" class="form-control" name="referrer" value="${userInput.referrer ?? ''}" placeholder="如有推荐人请填写推荐码" />
              <p class="form-text" style="font-size: 12px; color: #6b7280; margin-top: 4px;">填写推荐人代码后将无法更改，系统会自动为推荐人计算佣金分成</p>
            </div>
            
            <div id="create-account-section" style="display: flex; align-items: center; gap: 10px; margin-top: 24px; margin-bottom: 16px;">
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
              function continueWithExistingEmail() {
                document.getElementById('force_continue').value = 'true';
                document.getElementById('sign-form').submit();
              }

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
                const rawPhone = phoneNumber.replace(/\D/g, '');
                let phoneToValidate = rawPhone;

                if (phoneCode === '+86') {
                  if (rawPhone.startsWith('86') && rawPhone.length === 13) {
                    phoneToValidate = rawPhone.slice(2);
                  } else if (rawPhone.length === 11) {
                    phoneToValidate = rawPhone;
                  } else {
                    phoneToValidate = '';
                  }
                } else {
                  phoneToValidate = rawPhone;
                }
                
                // 每个国家的详细手机号格式要求
                const phonePatterns = {
                  '+86': /^1[3-9]\d{9}$/, // 中国：11位，必须以13-19开头
                  '+61': /^0\d{9}$/, // 澳大利亚：手机以0开头，共10位
                  '+1': /^\d{10}$/, // 美国/加拿大：10位手机号
                  '+44': /^7\d{9}$/, // 英国：手机以7开头，共10位
                  '+852': /^[5689]\d{7}$/, // 香港：手机以5/6/8/9开头，共8位
                  '+853': /^6\d{7}$/, // 澳门：手机以6开头，共8位
                  '+886': /^9\d{8}$/, // 台湾：手机以9开头，共9位
                  '+65': /^[89]\d{7}$/, // 新加坡：手机以8/9开头，共8位
                  '+82': /^1[0-9]\d{7,8}$/, // 韩国：手机以1开头，共9-10位
                  '+81': /^[789]0\d{8}$/ // 日本：手机以70/80/90开头，共10位
                };
                
                // 错误提示信息
                const errorMessages = {
                  '+86': '中国手机号需要11位，必须以13-19开头',
                  '+61': '澳大利亚手机号需要10位，必须以0开头',
                  '+1': '美国/加拿大手机号需要10位数字',
                  '+44': '英国手机号需要10位，必须以7开头',
                  '+852': '香港手机号需要8位，必须以5、6、8或9开头',
                  '+853': '澳门手机号需要8位，必须以6开头',
                  '+886': '台湾手机号需要9位，必须以9开头',
                  '+65': '新加坡手机号需要8位，必须以8/9开头',
                  '+82': '韩国手机号需要9-10位，必须以1开头',
                  '+81': '日本手机号需要10位，必须以70/80/90开头'
                };
                
                const pattern = phonePatterns[phoneCode];
                
                if (phoneNumber === '') {
                  phoneError.style.display = 'none';
                  return true;
                }
                
                const testResult = pattern ? pattern.test(phoneToValidate) : false;
                if (testResult) {
                  phoneError.style.display = 'none';
                  phoneError.textContent = '';
                  return true;
                } else {
                  phoneError.style.display = 'block';
                  phoneError.textContent = errorMessages[phoneCode] || '电话号码格式不正确';
                  return false;
                }
              }

              document.addEventListener('DOMContentLoaded', function() {
                togglePasswordFields();
                const errorMessage = "${errorMessage}";
                if (errorMessage === 'EMAIL_EXISTS') {
                  // 隐藏创建账户和密码字段
                  const createAccountSection = document.getElementById('create-account-section');
                  if(createAccountSection) createAccountSection.style.display = 'none';
                  
                  const passwordFields = document.getElementById('passwordFields');
                  if(passwordFields) passwordFields.style.display = 'none';
                }
              });

              function updatePlaceholder() {
                const phoneCode = document.getElementById('phoneCode').value;
                const phoneInput = document.getElementById('phone');
                const placeholders = {
                  '+86': '请输入11位手机号（以13-19开头）',
                  '+61': '请输入10位手机号（以0开头）',
                  '+1': '请输入10位手机号码',
                  '+44': '请输入10位手机号（以7开头）',
                  '+852': '请输入8位手机号（以5、6、8或9开头）',
                  '+853': '请输入8位手机号（以6开头）',
                  '+886': '请输入9位手机号（以9开头）',
                  '+65': '请输入8位手机号（以8/9开头）',
                  '+82': '请输入9-10位手机号（以1开头）',
                  '+81': '请输入10位手机号（以70/80/90开头）'
                };
                phoneInput.placeholder = placeholders[phoneCode] || '请输入电话号码';
              }

              // 页面加载时初始化占位符
              document.addEventListener('DOMContentLoaded', function() {
                updatePlaceholder();
              });

              document.getElementById('sign-form').addEventListener('submit', function(e) {
                if (!validatePhoneNumber()) {
                  e.preventDefault();
                  // 错误信息已在 validatePhoneNumber 中显示，无需额外 alert
                }
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

      // 在步骤3中获取订单和设备信息
      const orderId = contract.rentalId || contract.rental_id;
      console.log('Attempting to fetch order with orderId:', orderId, 'from contract.rentalId:', contract.rentalId, 'or contract.rental_id:', contract.rental_id); // 添加日志
      order = await getOrderById(c, orderId);
      if (!order) {
        console.error('Order not found for orderId:', orderId);
        return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>合同关联的订单不存在，请联系我们。</p></div>');
      }
      device = await getDeviceById(c, order.deviceId);

      content = `
        <div class="panel">
          ${progressBar}
          <h2>${title}</h2>
          ${errorMessage ? `<div class="alert" style="background:#fee2e2;border-color:#fecaca;">${errorMessage}</div>` : ''}
          
          <div class="alert">
            <strong>应付总额: ${formatCurrency(order.totalAmount)}</strong> (租金 + 押金)
          </div>

          <form method="POST" action="/contract/sign?${tokenOrNumber === contract.contractNumber ? `number=${tokenOrNumber}` : `token=${tokenOrNumber}`}&step=3">
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
              ${systemSettings.paymentMethods.balancePayment && currentUser ? `
              <label class="card" style="cursor: pointer; padding: 16px;">
                <input type="radio" name="paymentMethod" value="balance" required ${currentUser.balance >= order.totalAmount ? '' : 'disabled'} />
                <strong style="margin-left: 8px;">账户余额支付</strong>
                <p class="text-muted" style="margin: 4px 0 0 24px;">当前账户余额: ${formatCurrency(currentUser.balance || 0)} ${currentUser.balance >= order.totalAmount ? '' : '（余额不足）'}</p>
              </label>
              ` : ''}
            </div>
            <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
              <a href="/contract/sign?${tokenOrNumber === contract.contractNumber ? `number=${tokenOrNumber}` : `token=${tokenOrNumber}`}&step=2" class="button-secondary">返回上一步</a>
              <button class="button" type="submit">确认并完成签约</button>
            </div>
          </form>
        </div>
      `;
      break;
    default:
      content = '<div class="panel"><h2>无效的步骤</h2><p>请从第一步开始签署合同。 <a href="/contract/sign?${tokenOrNumber === contract.contractNumber ? `number=${tokenOrNumber}` : `token=${tokenOrNumber}`}&step=1">点击这里返回第一步</a></p></div>';
      break;
  }

  return buildLayout(title, content, currentUser);
}