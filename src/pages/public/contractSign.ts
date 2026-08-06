/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractBySignToken, getOrderById, getDeviceById, getUserById, formatCurrency, getSystemSettings, loadSystemSettingsFromDB, renderContractVariables, getContractVariableData, findUserBySession, sanitizePlainText, splitPersonName, canUseAccountBalance } from '../../site';
import { Context } from 'hono';

export function readContractSignDraft(cookieHeader: string | undefined, token: string): Record<string, string> {
  const encoded = cookieHeader?.match(/(?:^|;\s*)contract_sign_draft=([^;]*)/)?.[1]
  if (!encoded) return {}
  try {
    const draft = JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>
    if (draft.token !== token) return {}
    return Object.fromEntries(['firstName', 'lastName', 'email', 'phoneCode', 'phone', 'referrer', 'createAccount']
      .filter(key => typeof draft[key] === 'string').map(key => [key, draft[key] as string]))
  } catch { return {} }
}

export function getBankRefundPrefill(user: any): { accountName: string; bsb: string; accountNumber: string } {
  if (!user) return { accountName: '', bsb: '', accountNumber: '' }
  return {
    accountName: String(user.accountName || user.account_name || user.name || ''),
    bsb: String(user.bsb || ''),
    accountNumber: String(user.accountNumber || user.account_number || user.account || ''),
  }
}

function splitContractPhone(value: string): { phoneCode: string; phone: string } {
  const compact = value.replace(/[\s()-]/g, '')
  const code = ['+886', '+852', '+853', '+86', '+61', '+44', '+82', '+81', '+65', '+1'].find(item => compact.startsWith(item))
  if (!code) return { phoneCode: '+61', phone: value }
  let phone = compact.slice(code.length)
  if (code === '+61' && phone && !phone.startsWith('0')) phone = `0${phone}`
  return { phoneCode: code, phone }
}

export function renderSigningProgress(step: number): string {
  const items = [['01', '同意协议'], ['02', '确认资料'], ['03', '选择支付']]
  return `<ol class="signing-steps" aria-label="合同签署进度">${items.map(([number, label], index) => {
    const itemStep = index + 1
    const state = itemStep < step ? 'complete' : itemStep === step ? 'current' : 'upcoming'
    const stateLabel = state === 'complete' ? '已完成' : state === 'current' ? '当前步骤' : '尚未开始'
    return `<li class="signing-step signing-step--${state}"${state === 'current' ? ' aria-current="step"' : ''}><span class="signing-step__number" aria-hidden="true">${number}</span><span class="signing-step__copy"><span class="signing-step__title">${label}</span><span class="signing-step__state">${stateLabel}</span></span></li>`
  }).join('')}</ol>`
}

export async function renderContractSignPage(c: Context, tokenOrNumber: string, step: number, errorMessage?: string, userInput: Record<string, string> = {}) {
  if (!Object.keys(userInput).length) userInput = readContractSignDraft(c.req.header('cookie'), tokenOrNumber)
  const escapeAttribute = (value: unknown) => sanitizePlainText(value, 500)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  tokenOrNumber = escapeAttribute(tokenOrNumber)
  errorMessage = errorMessage === 'EMAIL_EXISTS' ? errorMessage : (errorMessage ? escapeAttribute(errorMessage) : undefined)
  userInput = Object.fromEntries(Object.entries(userInput).map(([key, value]) => [key, escapeAttribute(value)]))
  const currentUser = c.get('user') || await findUserBySession(c, c.req.header('cookie') ?? null);
  const canUseBalance = canUseAccountBalance(currentUser)
  const bankRefundPrefill = getBankRefundPrefill(currentUser)
  if (currentUser) {
    const accountName = splitPersonName(currentUser.name)
    const accountPhone = splitContractPhone(String(currentUser.phone || ''))
    userInput = {
      firstName: userInput.firstName || accountName.firstName,
      lastName: userInput.lastName || accountName.lastName,
      email: userInput.email || String(currentUser.email || ''),
      phoneCode: userInput.phoneCode || accountPhone.phoneCode,
      phone: userInput.phone || accountPhone.phone,
      ...userInput,
    }
  }
  let contract = await getContractBySignToken(c, tokenOrNumber);
  

  // 在模板中使用的 `token` 变量，映射传入的 tokenOrNumber
  const token = tokenOrNumber;
  
  if (!contract) {
    return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>合同链接无效或已过期</h2><p>请联系工作人员获取新的签约链接。</p></div>');
  }


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

  const orderId = contract.rentalId || contract.rental_id;
  const order = await getOrderById(c, orderId);
  if (!order) return buildLayout('合同签署 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>合同关联的订单不存在，请联系我们。</p></div>');
  await loadSystemSettingsFromDB(c)
  const systemSettings = getSystemSettings();
  const [device, contractCustomer, variableData] = await Promise.all([
    getDeviceById(c, order.deviceId),
    currentUser ? Promise.resolve(currentUser) : (order.userId ? getUserById(c, order.userId) : Promise.resolve(null)),
    getContractVariableData(c, contract, order),
  ])
  const activeAgreementContent = renderContractVariables(systemSettings.rentalTerms, contract, order, device, contractCustomer, variableData);
  
  const agreementHtml = /<[^>]+>/.test(activeAgreementContent)
    ? activeAgreementContent
    : activeAgreementContent.replace(/\n/g, '<br>');

  let content = '';
  let title = '合同签署';

  const progressBar = renderSigningProgress(step)

  switch (step) {
    case 1:
      title = '步骤 1/3: 阅读并同意租赁协议';
      content = `
        <div class="panel">
          ${progressBar}
          <h2>阅读并同意租赁协议</h2>
          ${errorMessage ? `<div class="alert" style="background:#fee2e2;border-color:#fecaca;">${errorMessage}</div>` : ''}
          
          <p class="section-note">本步骤仅用于确认租赁协议。正式合同将在完成电子签署后生成。</p>
          <div class="contract-content signing-agreement">
            ${agreementHtml}
          </div>
          


          <form method="POST" action="/contract/sign?${tokenOrNumber === contract.contractNumber ? `number=${tokenOrNumber}` : `token=${tokenOrNumber}`}&step=1">
            <label class="form-check agreement-confirmation">
              <input type="checkbox" name="agreeTerms" required />
              <span>我已仔细阅读并完全同意上述所有租赁条款。</span>
            </label>
            <div class="record-actions"><button class="button" type="submit">同意并进入下一步</button></div>
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
          
          ${errorMessage ? `<div class="alert alert-danger"><strong>无法保存资料</strong><p>${errorMessage}</p>${!currentUser && errorMessage.includes('已注册') ? `<a class="button button-secondary" href="/login?redirect=${encodeURIComponent(`/contract/sign?token=${token}&step=2`)}">登录后继续</a>` : ''}</div>` : ''}

          <form method="POST" action="/contract/sign?token=${token}&step=2" id="sign-form" class="signing-form" novalidate>
            ${currentUser ? `
              <section class="recorded-account"><div class="recorded-account__header"><div><span class="mono">ACCOUNT LINKED</span><h3>已关联账户</h3></div><span class="badge badge-success">已登录</span></div><p>已自动填写账户资料，您可以在签署前修改；保存后将同步更新账户。</p></section>
            ` : ''}
            <div class="grid grid-2">
              <div class="form-group"><label class="form-label" for="firstName">名 / Given name</label><input id="firstName" class="form-control" name="firstName" value="${userInput.firstName ?? ''}" autocomplete="given-name" required><span class="field-error" data-error-for="firstName"></span></div>
              <div class="form-group"><label class="form-label" for="lastName">姓 / Family name</label><input id="lastName" class="form-control" name="lastName" value="${userInput.lastName ?? ''}" autocomplete="family-name" required><span class="field-error" data-error-for="lastName"></span></div>
              <div class="form-group"><label class="form-label" for="email">电子邮箱</label><input id="email" class="form-control" type="email" name="email" value="${userInput.email ?? ''}" autocomplete="email" required><span class="field-error" data-error-for="email"></span></div>
              ${currentUser ? '' : `<div class="form-group"><label class="form-label" for="referrer">推荐人代码（选填）</label><input id="referrer" class="form-control" name="referrer" value="${userInput.referrer ?? ''}" maxlength="64" placeholder="如有推荐人请填写"></div>`}
            </div>
            <div class="form-group"><label class="form-label" for="phone">联系电话</label><div class="phone-field"><select id="phoneCode" name="phoneCode" class="form-control" required><option value="+61" ${!userInput.phoneCode || userInput.phoneCode === '+61' ? 'selected' : ''}>+61 澳大利亚</option><option value="+86" ${userInput.phoneCode === '+86' ? 'selected' : ''}>+86 中国</option><option value="+1" ${userInput.phoneCode === '+1' ? 'selected' : ''}>+1 美国/加拿大</option><option value="+44" ${userInput.phoneCode === '+44' ? 'selected' : ''}>+44 英国</option><option value="+852" ${userInput.phoneCode === '+852' ? 'selected' : ''}>+852 香港</option><option value="+886" ${userInput.phoneCode === '+886' ? 'selected' : ''}>+886 台湾</option><option value="+65" ${userInput.phoneCode === '+65' ? 'selected' : ''}>+65 新加坡</option><option value="+82" ${userInput.phoneCode === '+82' ? 'selected' : ''}>+82 韩国</option><option value="+81" ${userInput.phoneCode === '+81' ? 'selected' : ''}>+81 日本</option></select><input id="phone" class="form-control" name="phone" value="${userInput.phone ?? ''}" autocomplete="tel-national" required placeholder="例如 0412 345 678"></div><span class="field-error" data-error-for="phone"></span></div>
            ${currentUser ? '' : `
              <label class="account-choice"><input type="checkbox" id="createAccountCheckbox" name="createAccount" ${userInput.createAccount === 'true' ? 'checked' : ''}><span><strong>注册正式账户</strong><small>勾选后设置自己的密码；不勾选将自动创建访客账户并在签署完成后显示临时密码。</small></span></label>
              <div id="passwordFields" class="grid grid-2" hidden><div class="form-group"><label class="form-label" for="password">设置密码</label><input id="password" class="form-control" type="password" name="password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s])\\S{8,}" title="至少 8 位，并同时包含字母、数字和符号" autocomplete="new-password"><small class="form-text">至少 8 位，必须包含字母、数字和符号。</small><span class="field-error" data-error-for="password"></span></div><div class="form-group"><label class="form-label" for="passwordConfirm">确认密码</label><input id="passwordConfirm" class="form-control" type="password" name="passwordConfirm" minlength="8" autocomplete="new-password"><span class="field-error" data-error-for="passwordConfirm"></span></div></div>
            `}
            <div class="form-group"><label class="form-label" for="esignSignature">电子签名（输入完整姓名）</label><input id="esignSignature" name="esignSignature" class="form-control" value="${userInput.esignSignature ?? ''}" autocomplete="name" required><span class="field-error" data-error-for="esignSignature"></span><small class="form-text">必须与上方填写的名和姓完全一致。</small></div>
            <div id="form-error-summary" class="form-error-summary" role="alert" hidden>请先修正标记的资料。</div>
            <div class="record-actions"><a href="/contract/sign?token=${token}&step=1" class="button button-secondary">返回上一步</a><button class="button" id="sign-info-submit" type="submit">保存信息并进入下一步</button></div>
          </form>
          <script>
            (() => {
              const form = document.getElementById('sign-form');
              const summary = document.getElementById('form-error-summary');
              const errorFor = (id) => form.querySelector('[data-error-for="' + id + '"]');
              const setError = (id, message) => { const input = document.getElementById(id); const target = errorFor(id); if (input) input.setAttribute('aria-invalid', String(Boolean(message))); if (target) target.textContent = message || ''; return !message; };
              const fullName = () => [document.getElementById('firstName')?.value.trim(), document.getElementById('lastName')?.value.trim()].filter(Boolean).join(' ');
              const phonePatterns = { '+61': /^0\\d{9}$/, '+86': /^1[3-9]\\d{9}$/, '+1': /^\\d{10}$/, '+44': /^7\\d{9}$/, '+852': /^[5689]\\d{7}$/, '+886': /^9\\d{8}$/, '+65': /^[89]\\d{7}$/, '+82': /^1[0-9]\\d{7,8}$/, '+81': /^[789]0\\d{8}$/ };
              const validate = () => {
                let valid = true;
                const firstName = document.getElementById('firstName'); const lastName = document.getElementById('lastName'); const email = document.getElementById('email');
                if (firstName) valid = setError('firstName', firstName.value.trim() ? '' : '请填写名。') && valid;
                if (lastName) valid = setError('lastName', lastName.value.trim() ? '' : '请填写姓。') && valid;
                if (email) valid = setError('email', email.validity.valid ? '' : '请输入有效的电子邮箱。') && valid;
                const phone = document.getElementById('phone'); const code = document.getElementById('phoneCode');
                if (phone && code) { const digits = phone.value.replace(/\\D/g, ''); valid = setError('phone', phonePatterns[code.value]?.test(digits) ? '' : '电话号码格式与所选国家代码不匹配。') && valid; }
                const signature = document.getElementById('esignSignature'); valid = setError('esignSignature', signature.value.trim() === fullName() ? '' : '电子签名必须与完整姓名完全一致。') && valid;
                const formalAccount = document.getElementById('createAccountCheckbox')?.checked; const password = document.getElementById('password'); const confirm = document.getElementById('passwordConfirm');
                if (formalAccount) { valid = setError('password', /^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])\\S{8,}$/.test(password.value) ? '' : '密码至少需要 8 位，并同时包含字母、数字和符号。') && valid; valid = setError('passwordConfirm', confirm.value === password.value ? '' : '两次输入的密码不一致。') && valid; }
                summary.hidden = valid; return valid;
              };
              const accountChoice = document.getElementById('createAccountCheckbox');
              const updateAccountFields = () => { const fields = document.getElementById('passwordFields'); const formal = Boolean(accountChoice?.checked); if (!fields) return; fields.hidden = !formal; fields.querySelectorAll('input').forEach(input => input.required = formal); };
              const saveDraft = () => {
                const draft = { token: ${JSON.stringify(token).replace(/</g, '\\u003c')}, firstName: document.getElementById('firstName')?.value || '', lastName: document.getElementById('lastName')?.value || '', email: document.getElementById('email')?.value || '', phoneCode: document.getElementById('phoneCode')?.value || '', phone: document.getElementById('phone')?.value || '', referrer: document.getElementById('referrer')?.value || '', createAccount: String(Boolean(accountChoice?.checked)) };
                document.cookie = 'contract_sign_draft=' + encodeURIComponent(JSON.stringify(draft)) + '; Path=/contract/sign; Max-Age=604800; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
              };
              accountChoice?.addEventListener('change', () => { updateAccountFields(); validate(); saveDraft(); });
              form.querySelectorAll('input, select').forEach(input => { input.addEventListener('input', () => { validate(); saveDraft(); }); input.addEventListener('change', () => { validate(); saveDraft(); }); });
              form.addEventListener('submit', event => { if (!validate()) { event.preventDefault(); form.querySelector('[aria-invalid="true"]')?.focus(); } });
              updateAccountFields();
            })();
          </script>
        </div>
      `;
      break;
    case 3:
      title = '步骤 3/3: 选择付款方式';
      const stripeFee = Math.round(Number(order.totalAmount) * 100 * 0.025) / 100;
      const stripeTotal = Number(order.totalAmount) + stripeFee;

      // 在步骤3中获取订单和设备信息

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
              ${systemSettings.paymentMethods.stripe ? `
              <label class="payment-option">
                <input type="radio" name="paymentMethod" value="stripe" required />
                <span><strong>信用卡支付（Stripe）</strong><small>支付 ${formatCurrency(stripeTotal)}，包含 ${formatCurrency(stripeFee)}（2.5%）手续费。Stripe 安全处理付款，网站不保存卡号、有效期或安全码。</small></span>
              </label>
              ` : ''}
              ${systemSettings.paymentMethods.bankTransfer ? `
              <label class="payment-option">
                <input type="radio" name="paymentMethod" value="bank_transfer" required />
                <span><strong>银行转账</strong><small>查看账户资料并提交转账凭证截图。</small></span>
              </label>
              ` : ''}
              ${systemSettings.paymentMethods.balancePayment && canUseBalance ? `
              <label class="payment-option">
                <input type="radio" name="paymentMethod" value="balance" required ${currentUser.balance >= order.totalAmount ? '' : 'disabled'} />
                <span><strong>账户余额支付</strong><small>当前余额 ${formatCurrency(currentUser.balance || 0)} ${currentUser.balance >= order.totalAmount ? '' : '（余额不足）'}</small></span>
              </label>
              ` : ''}
            </div>
            ${systemSettings.paymentMethods.bankTransfer ? `<aside id="bank-transfer-notice" class="bank-transfer-notice" hidden><div class="payment-fee-notice__header"><strong>银行转账资料</strong><span class="mono">AUD</span></div><dl><div><dt>银行</dt><dd>${escapeAttribute(systemSettings.bankDetails.bankName || '—')}</dd></div><div><dt>账户名</dt><dd>${escapeAttribute(systemSettings.bankDetails.accountName)}</dd></div><div><dt>BSB</dt><dd>${escapeAttribute(systemSettings.bankDetails.bsb)}</dd></div><div><dt>账号</dt><dd>${escapeAttribute(systemSettings.bankDetails.account)}</dd></div><div><dt>转账金额</dt><dd>${formatCurrency(order.totalAmount)}</dd></div></dl><div class="grid grid-2"><div class="form-group"><label class="form-label" for="transferReference">银行 Reference</label><input class="form-control bank-proof-input" id="transferReference" name="transferReference" maxlength="100" placeholder="银行交易 Reference"><span class="field-error" data-payment-error="transferReference"></span></div><div class="form-group"><label class="form-label" for="transferProofUrl">付款截图链接</label><input class="form-control bank-proof-input" id="transferProofUrl" name="transferProofUrl" type="url" placeholder="https://.../payment-proof.jpg"><span class="field-error" data-payment-error="transferProofUrl"></span></div></div><div class="form-group"><label class="form-label" for="transferNote">转账备注（选填）</label><textarea class="form-control" id="transferNote" name="transferNote" maxlength="500"></textarea><small class="form-text">请先把截图上传到可公开访问的 HTTPS 图床，再粘贴图片链接；提交后由管理员审核。</small></div></aside>` : ''}
            ${systemSettings.paymentMethods.stripe ? `
            <aside id="stripe-fee-notice" class="payment-fee-notice" hidden aria-live="polite">
              <div class="payment-fee-notice__header"><strong>信用卡支付手续费</strong><span class="mono">2.5%</span></div>
              <p>选择 Stripe 信用卡支付时，将在租金和押金合计金额上加收由支付提供商收取的手续费。付款由 Stripe 安全处理，本网站不保存信用卡卡号、有效期或安全码。</p>
              <dl>
                <div><dt>订单本金（含押金）</dt><dd>${formatCurrency(order.totalAmount)}</dd></div>
                <div><dt>Stripe 支付手续费</dt><dd>${formatCurrency(stripeFee)}</dd></div>
                <div class="payment-fee-notice__total"><dt>信用卡最终扣款</dt><dd>${formatCurrency(stripeTotal)}</dd></div>
              </dl>
              <p class="payment-fee-notice__warning">仅处理押金退款时，会同时退回实际退还押金对应的 2.5% 手续费；取消订单及其他退款不退手续费。</p>
            </aside>
            ` : ''}
            <div class="card" style="margin-top:20px; padding:16px;">
              <h3 style="margin-top:0;">退款接收方式</h3>
              ${canUseBalance ? `
              <label style="display:block; margin-bottom:10px;"><input type="radio" name="refundMethod" value="balance" checked> 退回账户余额（默认，到账更快）</label>
              <label style="display:block;"><input type="radio" name="refundMethod" value="original"> 原路退回</label>
              ` : `<input type="hidden" name="refundMethod" value="original"><div class="alert"><strong>退款将原路退回</strong><p>只有已登录的正式客户账户可以选择退款到账户余额；访客及未登录签署者不能使用余额。</p></div>`}
              <p class="text-muted">信用卡原路退回 Stripe；银行转账原路退回您填写的银行账户；余额付款仍退回余额。</p>
              <div id="bank-refund-fields" style="display:none; margin-top:14px;">
                <label class="form-label" for="refundAccountName">账户名</label>
                <input class="form-control" id="refundAccountName" name="refundAccountName" value="${escapeAttribute(bankRefundPrefill.accountName)}" autocomplete="name">
                <label class="form-label" for="refundBsb">BSB</label>
                <input class="form-control" id="refundBsb" name="refundBsb" value="${escapeAttribute(bankRefundPrefill.bsb)}" placeholder="062-001" maxlength="7" inputmode="numeric">
                <label class="form-label" for="refundAccountNumber">账号</label>
                <input class="form-control" id="refundAccountNumber" name="refundAccountNumber" value="${escapeAttribute(bankRefundPrefill.accountNumber)}" inputmode="numeric" autocomplete="off">
                <small class="form-text">${currentUser ? '已自动填写系统中保存的银行资料；如本次退款账户不同，可以直接修改。' : '请填写用于接收本次退款的银行账户资料。'}</small>
              </div>
            </div>
            <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
              <a href="/contract/sign?${tokenOrNumber === contract.contractNumber ? `number=${tokenOrNumber}` : `token=${tokenOrNumber}`}&step=2" class="button button-secondary">返回上一步</a>
              <button class="button" type="submit">确认并完成签约</button>
            </div>
          </form>
          <script>
            (() => {
              const form = document.querySelector('form[action*="step=3"]');
              const fields = document.getElementById('bank-refund-fields');
              const stripeFeeNotice = document.getElementById('stripe-fee-notice');
              const bankTransferNotice = document.getElementById('bank-transfer-notice');
              const bankProofInputs = Array.from(document.querySelectorAll('.bank-proof-input'));
              const bankInputs = fields.querySelectorAll('input');
              const update = () => {
                const payment = form.querySelector('input[name="paymentMethod"]:checked')?.value;
                const refund = form.querySelector('input[name="refundMethod"]:checked')?.value || form.querySelector('input[name="refundMethod"]')?.value;
                const show = payment === 'bank_transfer' && refund === 'original';
                fields.style.display = show ? 'block' : 'none';
                bankInputs.forEach(input => input.required = show);
                if (stripeFeeNotice) stripeFeeNotice.hidden = payment !== 'stripe';
                if (bankTransferNotice) bankTransferNotice.hidden = payment !== 'bank_transfer';
                bankProofInputs.forEach(input => input.required = payment === 'bank_transfer');
              };
              form.addEventListener('change', update);
              form.addEventListener('submit', event => {
                const payment = form.querySelector('input[name="paymentMethod"]:checked')?.value;
                if (payment !== 'bank_transfer') return;
                let valid = true;
                bankProofInputs.forEach(input => { const error = document.querySelector('[data-payment-error="' + input.id + '"]'); let message = input.value.trim() ? '' : (input.type === 'url' ? '请填写有效的 HTTPS 截图链接。' : '请填写银行 Reference。'); if (!message && input.type === 'url') { try { if (new URL(input.value).protocol !== 'https:') message = '截图链接必须使用 HTTPS。'; } catch { message = '请填写有效的 HTTPS 截图链接。'; } } input.setAttribute('aria-invalid', String(Boolean(message))); error.textContent = message; if (message) valid = false; });
                if (!valid) { event.preventDefault(); bankProofInputs.find(input => input.getAttribute('aria-invalid') === 'true')?.focus(); }
              });
              update();
            })();
          </script>
        </div>
      `;
      break;
    default:
      content = `<div class="panel"><h2>无效的步骤</h2><p>请从第一步开始签署合同。 <a href="/contract/sign?${tokenOrNumber === contract.contractNumber ? `number=${tokenOrNumber}` : `token=${tokenOrNumber}`}&step=1">点击这里返回第一步</a></p></div>`;
      break;
  }

  const signingPage = `<main class="signing-shell"><div class="entity-header signing-page-header"><div class="identity-strip mono"><span>E-SIGN / ${escapeAttribute(contract.contractNumber)}</span><span>SECURE SIGNING</span></div><div class="entity-heading"><div><p class="section-code">RENTAL AGREEMENT</p><h2 id="signing-page-title">租赁协议签署</h2><p>${escapeAttribute(device?.name || '租赁设备')} · ${escapeAttribute(order.startDate)} 至 ${escapeAttribute(order.endDate)}</p></div><span class="badge badge-warning">待签署</span></div></div>${content}</main>`
  return buildLayout(title, signingPage, currentUser);
}
