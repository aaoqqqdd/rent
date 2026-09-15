/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getSystemSettings } from '../../site';

export function renderAdminSettings(user: any, stripe: any = {}, email: any = {}, notify: any = {}, coupons: any[] = [], turnstile: any = {}, square: any = {}, tallyWebhookConfigured: boolean = false) {
  const settings = getSystemSettings(); // 获取当前系统设置
  const feedbackRewards = settings.feedbackRewards || { enabled: false, rewardType: 'BALANCE', balanceAmount: 5, balanceAmountMin: 5, balanceAmountMax: 5, couponDiscountType: 'fixed', couponDiscountValue: 5, couponDiscountValueMin: 5, couponDiscountValueMax: 5, couponMinimumOrderAmount: 0, couponExpiresDays: 30 };
  const escAttr = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const ts = {
    configured: Boolean(turnstile.configured),
    usingEnvFallback: Boolean(turnstile.usingEnvFallback),
    siteKey: turnstile.siteKey || '',
    secretKeyMasked: turnstile.secretKeyMasked || '',
  };
  const nc = {
    emailProvider: notify.emailProvider || 'resend',
    resend: notify.resend || { from: '', apiKeyMasked: '', configured: false, usingEnvFallback: false },
    brevo: notify.brevo || { from: '', apiKeyMasked: '', configured: false },
    mailersend: notify.mailersend || { from: '', apiKeyMasked: '', configured: false },
    webhook: notify.webhook || { enabled: false, urlMasked: '', configured: false },
  };

  const body = `
    <div class="panel">
      <div class="section-title"><h2>系统设置</h2><span class="section-note">配置邮件、公司资料、租赁规则、支付方式和推荐分成。</span></div>

      <form id="systemSettingsForm" class="asset-editor">
        <section class="form-section">
          <div class="form-section-title"><span class="mono">SMTP</span><div><h3>邮件 SMTP 配置</h3><p>用于邮箱验证、收据、合同、退款和其他通知。密码加密保存，留空表示保留原密码。<a href="/admin/email-templates">完整邮件变量索引</a>。</p></div></div>
          <div class="grid grid-2">
            <div><label class="form-label" for="companyName">公司名称</label><input id="companyName" name="companyName" class="form-control" value="${settings.companyDetails.name}"></div>
            <div><label class="form-label" for="companyAbn">公司 ABN</label><input id="companyAbn" name="companyAbn" class="form-control" value="${settings.companyDetails.abn}" placeholder="11 位 ABN"></div>
            <div><label class="form-label" for="gstIncluded">GST 设置</label><select id="gstIncluded" name="gstIncluded" class="form-control"><option value="true" ${settings.companyDetails.gstIncluded ? 'selected' : ''}>价格包含 GST</option><option value="false" ${!settings.companyDetails.gstIncluded ? 'selected' : ''}>价格不含 GST</option></select></div>
            <div><label class="form-label" for="companyAddress">公司地址</label><input id="companyAddress" name="companyAddress" class="form-control" value="${settings.companyDetails.address}"></div>
            <div><label class="form-label" for="companyContact">公司联系人</label><input id="companyContact" name="companyContact" class="form-control" value="${settings.companyDetails.contact}"></div>
            <div><label class="form-label" for="companyPhone">公司电话</label><input id="companyPhone" name="companyPhone" class="form-control" value="${settings.companyDetails.phone}"></div>
            <div><label class="form-label" for="companyEmail">公司邮箱</label><input type="email" id="companyEmail" name="companyEmail" class="form-control" value="${settings.companyDetails.email}"></div>
            <div><label class="form-label" for="companyWebsite">公司网站</label><input type="url" id="companyWebsite" name="companyWebsite" class="form-control" value="${settings.companyDetails.website}" placeholder="https://"></div>
            <div><label class="form-label" for="companyLogo">公司 Logo URL</label><input type="url" id="companyLogo" name="companyLogo" class="form-control" value="${settings.companyDetails.logo}" placeholder="https://"></div>
            <div class="form-group"><label class="form-label" for="pickupLocations">自取/归还地点</label><textarea id="pickupLocations" name="pickupLocations" class="form-control" rows="4" placeholder="每行一个地点">${settings.companyDetails.pickupLocations.join('\n')}</textarea><small class="form-text">员工新建合同时只能从这些地点中选择；管理员仍可临时编辑。</small></div>
              <div class="form-group"><label class="form-label" for="deliveryAreas">配送区域</label><textarea id="deliveryAreas" name="deliveryAreas" class="form-control" rows="4" placeholder="每行一个区域">${(settings.companyDetails.deliveryAreas || []).join('\n')}</textarea><small class="form-text">官网会显示这些区域；每行一个 suburb 或区域名称。</small></div>
              <div class="form-group"><label class="form-label" for="deliveryNote">配送说明</label><input id="deliveryNote" name="deliveryNote" class="form-control" value="${settings.companyDetails.deliveryNote || ''}" placeholder="例如：配送范围和运费以审核确认为准"><small class="form-text">官网申请页、租赁指南和设备详情会读取这段说明。</small></div>
            <div class="form-group"><label class="form-label" for="unavailableDates">不可用日期</label><textarea id="unavailableDates" name="unavailableDates" class="form-control" rows="4" placeholder="2026-12-25\n2026-12-26">${settings.rentalRules.unavailableDates.join('\n')}</textarea><small class="form-text">每行一个 YYYY-MM-DD；这些日期不能取货或归还。</small></div>
            <div class="form-group"><label class="form-label" for="unavailableTimeSlots">按日期设置不可用时间段</label><textarea id="unavailableTimeSlots" name="unavailableTimeSlots" class="form-control" rows="4" placeholder="2026-12-25: afternoon, evening_service">${Object.entries(settings.rentalRules.unavailableTimeSlots || {}).map(([date, slots]) => `${date}: ${(slots as string[]).join(', ')}`).join('\n')}</textarea><small class="form-text">每行格式：日期: 时间段；例如 2026-12-25: afternoon, evening_service。可用时间段：morning_service、morning、afternoon、evening_service。</small></div>
            <div class="grid grid-2"><div><label class="form-label" for="minimumRentalDays">最短租赁天数</label><input id="minimumRentalDays" name="minimumRentalDays" type="number" min="1" step="1" class="form-control" value="${settings.rentalRules.minimumRentalDays}"></div><div><label class="form-label" for="bufferDays">设备周转缓冲天数</label><input id="bufferDays" name="bufferDays" type="number" min="0" step="1" class="form-control" value="${settings.rentalRules.bufferDays}"><small class="form-text">自动扩展订单前后不可预约的缓冲时间。</small></div></div>
          </div>
          <div class="checkbox-group"><input type="checkbox" id="clearEmailTransport"><label for="clearEmailTransport">清除已保存的 SMTP 配置</label></div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">AUTH</span><div><h3>注册安全设置</h3><p>关闭时仍可发送验证邮件，但注册后不会阻止用户直接进入系统。</p></div></div>
          <div class="checkbox-group"><input type="checkbox" id="requireEmailVerification" ${settings.registrationSettings?.requireEmailVerification ? 'checked' : ''}><label for="requireEmailVerification">强制新注册用户验证邮箱</label></div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">TALLY</span><div><h3>Tally 客户反馈与奖励</h3><p>请在 Tally 的 Share → Embed 中复制 <code>https://tally.so/embed/...</code> 地址。反馈表单必须添加名为 <code>feedbackToken</code> 的 Hidden field，并在 Tally 后台的 Webhook 设置中把地址指向 <code>/webhooks/tally</code>。当前 Webhook 密钥状态：<strong>${tallyWebhookConfigured ? '已配置（环境变量 TALLY_WEBHOOK_SECRET）' : '未配置 — 反馈提交后的 Webhook 会被拒绝，需在 Cloudflare Worker 环境变量中设置 TALLY_WEBHOOK_SECRET'}</strong>。</p></div></div>
          <div class="form-group"><label class="form-label" for="tallyFormUrl">Tally Embed URL</label><input class="form-control" type="url" id="tallyFormUrl" name="tallyFormUrl" value="${escAttr(settings.tallyFormUrl)}" placeholder="https://tally.so/embed/xxxxxxxx"><small class="form-text">保存后访问 <a href="/feedback" target="_blank" rel="noopener">/feedback</a> 预览（需已登录正式客户账号）。</small></div>
          <div class="checkbox-group"><input type="checkbox" id="feedbackRewardEnabled" ${feedbackRewards.enabled ? 'checked' : ''}><label for="feedbackRewardEnabled">提交反馈后自动发放奖励</label></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="feedbackRewardType">奖励类型</label><select class="form-control" id="feedbackRewardType"><option value="BALANCE" ${feedbackRewards.rewardType === 'BALANCE' ? 'selected' : ''}>账户余额</option><option value="COUPON" ${feedbackRewards.rewardType === 'COUPON' ? 'selected' : ''}>一次性优惠码</option><option value="GIFT_CARD" ${feedbackRewards.rewardType === 'GIFT_CARD' ? 'selected' : ''}>外部礼品卡兑换码</option></select></div>
            <div class="form-group"><label class="form-label" for="feedbackBalanceAmountMin">余额奖励范围（AUD）</label><div class="grid grid-2"><input class="form-control" id="feedbackBalanceAmountMin" type="number" min="0.01" max="10000" step="0.01" value="${feedbackRewards.balanceAmountMin ?? feedbackRewards.balanceAmount}" placeholder="最低金额"><input class="form-control" id="feedbackBalanceAmountMax" type="number" min="0.01" max="10000" step="0.01" value="${feedbackRewards.balanceAmountMax ?? feedbackRewards.balanceAmount}" placeholder="最高金额"></div></div>
            <div class="form-group"><label class="form-label" for="feedbackCouponDiscountType">优惠码类型</label><select class="form-control" id="feedbackCouponDiscountType"><option value="fixed" ${feedbackRewards.couponDiscountType === 'fixed' ? 'selected' : ''}>固定金额</option><option value="percent" ${feedbackRewards.couponDiscountType === 'percent' ? 'selected' : ''}>百分比</option></select></div>
            <div class="form-group"><label class="form-label" for="feedbackCouponDiscountValueMin">优惠值范围</label><div class="grid grid-2"><input class="form-control" id="feedbackCouponDiscountValueMin" type="number" min="0.01" max="10000" step="0.01" value="${feedbackRewards.couponDiscountValueMin ?? feedbackRewards.couponDiscountValue}" placeholder="最低优惠"><input class="form-control" id="feedbackCouponDiscountValueMax" type="number" min="0.01" max="10000" step="0.01" value="${feedbackRewards.couponDiscountValueMax ?? feedbackRewards.couponDiscountValue}" placeholder="最高优惠"></div></div>
            <div class="form-group"><label class="form-label" for="feedbackCouponMinimumOrderAmount">最低使用金额（AUD）</label><input class="form-control" id="feedbackCouponMinimumOrderAmount" type="number" min="0" max="1000000" step="0.01" value="${feedbackRewards.couponMinimumOrderAmount || 0}"><small class="form-text">填 0 表示不限制最低订单金额。</small></div>
            <div class="form-group"><label class="form-label" for="feedbackCouponExpiresDays">优惠码有效期（天）</label><input class="form-control" id="feedbackCouponExpiresDays" type="number" min="1" max="365" step="1" value="${feedbackRewards.couponExpiresDays}"></div>
          </div>
          <p class="form-text">礼品卡奖励不会调用 Square 发卡 API；请先在 <a href="/admin/feedback-gift-cards">礼品卡库存</a> 录入外部兑换码，系统按先进先出发放。发放记录（含失败原因和重试）请查看 <a href="/admin/feedback-rewards">反馈奖励记录</a>。</p>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">BOT</span><div><h3>Cloudflare Turnstile 人机验证</h3><p>当前状态：${ts.configured ? (ts.usingEnvFallback ? '已配置（使用环境变量 TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY）' : '已配置') : '未配置'}。用于注册页拦截机器人。在 Cloudflare 控制台「Turnstile」中创建站点获取密钥。Secret Key 加密保存，留空表示保留原值。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="turnstileSiteKey">Site Key</label><input class="form-control" id="turnstileSiteKey" name="turnstileSiteKey" value="${ts.siteKey}" placeholder="0x4AAAAAAA..."></div>
            <div class="form-group"><label class="form-label" for="turnstileSecretKey">Secret Key</label><input class="form-control" type="password" id="turnstileSecretKey" name="turnstileSecretKey" placeholder="${ts.secretKeyMasked || '0x4AAAAAAA...'}" autocomplete="new-password"></div>
          </div>
          <div class="checkbox-group"><input type="checkbox" id="clearTurnstileConfig" name="clearTurnstileConfig"><label for="clearTurnstileConfig">清除已保存的 Turnstile 配置（改回使用环境变量）</label></div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">PUSH</span><div><h3>通知渠道</h3><p>邮件服务商用于发送所有系统邮件（验证、收据、合同、退款、协议更新等），Resend / Brevo / MailerSend 三选一，都提供免费额度。通用 Webhook 用于把发给员工和管理员的通知同步推送一份。所有密钥加密保存，留空表示保留原值。</p></div></div>
          <div class="form-group">
            <label class="form-label" for="emailProvider">当前生效的邮件服务商</label>
            <select class="form-control" id="emailProvider">
              <option value="resend" ${nc.emailProvider === 'resend' ? 'selected' : ''}>Resend（每月 3000 封 / 每天 100 封免费）</option>
              <option value="brevo" ${nc.emailProvider === 'brevo' ? 'selected' : ''}>Brevo（每天 300 封免费）</option>
              <option value="mailersend" ${nc.emailProvider === 'mailersend' ? 'selected' : ''}>MailerSend（每月 3000 封免费）</option>
            </select>
            <small class="form-text">下面三组凭据可以都填写，实际发信只会使用这里选中的服务商。</small>
          </div>

          <h4 class="form-subheading">Resend 邮件 API</h4>
          <p class="form-text">当前状态：${nc.resend.configured ? (nc.resend.usingEnvFallback ? '已配置（使用环境变量 RESEND_API_KEY）' : '已配置') : '未配置'}</p>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="resendApiKey">Resend API Key</label><input class="form-control" type="password" id="resendApiKey" placeholder="${nc.resend.apiKeyMasked || 're_...'}" autocomplete="new-password"></div>
            <div class="form-group"><label class="form-label" for="resendFrom">发件邮箱</label><input class="form-control" type="text" id="resendFrom" value="${nc.resend.from || ''}" placeholder="PC Rental &lt;noreply@example.com&gt;"></div>
          </div>
          <div class="checkbox-group"><input type="checkbox" id="resendClear"><label for="resendClear">清除已保存的 Resend API Key</label></div>

          <h4 class="form-subheading">Brevo 邮件 API</h4>
          <p class="form-text">当前状态：${nc.brevo.configured ? '已配置' : '未配置'}。在 Brevo 后台「SMTP & API」页面创建 API Key。</p>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="brevoApiKey">Brevo API Key</label><input class="form-control" type="password" id="brevoApiKey" placeholder="${nc.brevo.apiKeyMasked || 'xkeysib-...'}" autocomplete="new-password"></div>
            <div class="form-group"><label class="form-label" for="brevoFrom">发件邮箱</label><input class="form-control" type="text" id="brevoFrom" value="${nc.brevo.from || ''}" placeholder="PC Rental &lt;noreply@example.com&gt;"></div>
          </div>
          <div class="checkbox-group"><input type="checkbox" id="brevoClear"><label for="brevoClear">清除已保存的 Brevo API Key</label></div>

          <h4 class="form-subheading">MailerSend 邮件 API</h4>
          <p class="form-text">当前状态：${nc.mailersend.configured ? '已配置' : '未配置'}。发件邮箱需先在 MailerSend 完成域名验证。</p>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="mailersendApiKey">MailerSend API Key</label><input class="form-control" type="password" id="mailersendApiKey" placeholder="${nc.mailersend.apiKeyMasked || 'mlsn....'}" autocomplete="new-password"></div>
            <div class="form-group"><label class="form-label" for="mailersendFrom">发件邮箱</label><input class="form-control" type="text" id="mailersendFrom" value="${nc.mailersend.from || ''}" placeholder="PC Rental &lt;noreply@example.com&gt;"></div>
          </div>
          <div class="checkbox-group"><input type="checkbox" id="mailersendClear"><label for="mailersendClear">清除已保存的 MailerSend API Key</label></div>

          <h4 class="form-subheading">通用 Webhook</h4>
          <div class="checkbox-group"><input type="checkbox" id="webhookEnabled" ${nc.webhook.enabled ? 'checked' : ''}><label for="webhookEnabled">启用通用 Webhook</label></div>
          <p class="form-text">当前状态：${nc.webhook.configured ? `已配置（${nc.webhook.urlMasked}）` : '未配置'}。支持 Discord / Slack / 钉钉 / 飞书 的机器人 Webhook，其他地址会收到通用 JSON。</p>
          <div class="form-group"><label class="form-label" for="webhookUrl">Webhook 地址（HTTPS）</label><input class="form-control" type="password" id="webhookUrl" placeholder="${nc.webhook.urlMasked || 'https://...'}" autocomplete="new-password"></div>
          <div class="checkbox-group"><input type="checkbox" id="webhookClear"><label for="webhookClear">清除 Webhook 配置</label></div>

          <div class="form-actions" style="margin-top:16px;">
            <button type="button" class="button button-secondary" id="notifyChannelsTest">发送测试推送</button>
            <span class="form-text" id="notifyChannelsTestResult"></span>
          </div>
          <p class="form-text">请先保存配置再测试。</p>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">RATE</span><div><h3>价格策略配置</h3><p>用于计算租金与押金的策略文本。</p></div></div>
          <div class="form-group"><textarea id="priceStrategy" name="priceStrategy" rows="5" class="form-control">${settings.priceStrategy}</textarea></div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">PAY</span><div><h3>支付方式配置</h3><p>启用或停用面向客户的支付渠道，并设置支付手续费。</p></div></div>
          <div class="form-group">
            <label class="form-label" for="processingFeeRate">支付手续费比例（%）</label>
            <input class="form-control" id="processingFeeRate" name="processingFeeRate" type="number" min="0" max="100" step="0.01" value="${(Number(settings.paymentMethods.processingFeeRate ?? 0.025) * 100).toFixed(2)}">
            <small class="form-text">Stripe 手续费按租金及立即支付的时段服务费（不含押金）计算；押金预授权、释放和长期押金扣款不加手续费。</small>
          </div>
          <div class="form-group">
            <label class="form-label" for="squareProcessingFeeRate">Square 礼品卡手续费比例（%）</label>
            <input class="form-control" id="squareProcessingFeeRate" name="squareProcessingFeeRate" type="number" min="0" max="100" step="0.01" value="${(Number(settings.paymentMethods.squareProcessingFeeRate ?? 0.022) * 100).toFixed(2)}">
            <small class="form-text">Square 礼品卡手续费按租金及服务费（不含押金）计算；审核通过后实际提交 Square 时按此比例收取。</small>
          </div>
          <div class="checkbox-group"><input type="checkbox" id="enableStripe" name="enableStripe" ${settings.paymentMethods.stripe ? 'checked' : ''}><label for="enableStripe">启用 Stripe 信用卡支付</label></div>
          <div class="checkbox-group"><input type="checkbox" id="enableSquare" name="enableSquare" ${settings.paymentMethods.square ? 'checked' : ''}><label for="enableSquare">启用 Square 礼品卡支付</label></div>
          <div class="checkbox-group"><input type="checkbox" id="enableBankTransfer" name="enableBankTransfer" ${settings.paymentMethods.bankTransfer ? 'checked' : ''}><label for="enableBankTransfer">启用银行转账</label></div>
          <div class="checkbox-group"><input type="checkbox" id="enableBalancePayment" name="enableBalancePayment" ${settings.paymentMethods.balancePayment ? 'checked' : ''}><label for="enableBalancePayment">启用余额支付</label></div>
          <div class="checkbox-group"><input type="checkbox" id="enableAlipay" name="enableAlipay" ${settings.paymentMethods.alipay ? 'checked' : ''}><label for="enableAlipay">启用支付宝人民币付款</label></div>
          <div class="checkbox-group"><input type="checkbox" id="enableWechat" name="enableWechat" ${settings.paymentMethods.wechat ? 'checked' : ''}><label for="enableWechat">启用微信支付人民币付款</label></div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">API</span><div><h3>Stripe API 配置</h3><p>当前状态：${stripe.configured ? `已配置（${stripe.mode === 'live' ? '正式模式' : '测试模式'}）` : '未配置'}。Webhook 地址：<code>/webhooks/stripe</code>。私密密钥留空会保留现有值。</p></div></div>
          <div class="form-group"><label class="form-label" for="stripePublishableKey">Publishable Key</label><input class="form-control" id="stripePublishableKey" name="stripePublishableKey" value="${stripe.publishableKey || ''}" placeholder="pk_test_... 或 pk_live_..."></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="stripeSecretKey">Secret Key</label><input class="form-control" type="password" id="stripeSecretKey" name="stripeSecretKey" placeholder="${stripe.secretKeyMasked || 'sk_test_...'}" autocomplete="new-password"></div>
            <div class="form-group"><label class="form-label" for="stripeWebhookSecret">Webhook Signing Secret</label><input class="form-control" type="password" id="stripeWebhookSecret" name="stripeWebhookSecret" placeholder="${stripe.webhookSecretMasked || 'whsec_...'}" autocomplete="new-password"></div>
          </div>
          <div class="checkbox-group"><input type="checkbox" id="clearStripeConfig" name="clearStripeConfig"><label for="clearStripeConfig">清除已保存的 Stripe 配置</label></div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">SQUARE</span><div><h3>Square API 配置</h3><p>当前状态：${square.configured ? `已配置（${square.environment === 'production' ? '正式环境' : '沙盒环境'}）` : '未配置'}。用于 Square 礼品卡付款、客户资料和设备商品同步。Webhook 地址：<code>/webhooks/square</code>。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="squareApplicationId">Application ID</label><input class="form-control" id="squareApplicationId" value="${escAttr(square.applicationId)}" placeholder="sq0idp-..."></div>
            <div class="form-group"><label class="form-label" for="squareLocationId">Location ID</label><input class="form-control" id="squareLocationId" value="${escAttr(square.locationId)}" placeholder="L..."></div>
            <div class="form-group"><label class="form-label" for="squareAccessToken">Access Token</label><input class="form-control" type="password" id="squareAccessToken" placeholder="${square.accessTokenMasked || '留空保留现有值'}" autocomplete="new-password"></div>
            <div class="form-group"><label class="form-label" for="squareEnvironment">环境</label><select class="form-control" id="squareEnvironment"><option value="sandbox" ${square.environment !== 'production' ? 'selected' : ''}>Sandbox 沙盒</option><option value="production" ${square.environment === 'production' ? 'selected' : ''}>Production 正式</option></select></div>
            <div class="form-group"><label class="form-label" for="squareWebhookUrl">Webhook URL</label><div style="display:flex;gap:8px;align-items:center"><input class="form-control" type="url" id="squareWebhookUrl" value="${escAttr(square.webhookUrl)}" readonly aria-describedby="squareWebhookUrlHelp"><button type="button" class="button button-secondary" id="copySquareWebhookUrl">复制</button></div><small class="form-text" id="squareWebhookUrlHelp">系统已自动生成，点击“复制”后粘贴到 Square Developer Console 的 Webhooks 设置。</small></div>
            <div class="form-group"><label class="form-label" for="squareWebhookSignatureKey">Webhook Signature Key（可选）</label><input class="form-control" type="password" id="squareWebhookSignatureKey" placeholder="${square.webhookSignatureKeyMasked || '留空保留现有值'}" autocomplete="new-password"></div>
          </div>
          <p class="form-text">Square Web Payments SDK 只会把礼品卡令牌发送到本站；Access Token 和 Webhook Signature Key 会加密保存。</p>
          <div class="checkbox-group"><input type="checkbox" id="clearSquareConfig"><label for="clearSquareConfig">清除已保存的 Square 配置</label></div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">BANK</span><div><h3>银行转账账户信息</h3><p>客户选择银行转账时会看到这些账户信息，供其转账使用。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label for="bankName" class="form-label">银行名称</label><input type="text" id="bankName" name="bankName" class="form-control" value="${settings.bankDetails.bankName}" placeholder="例如: Commonwealth Bank"></div>
            <div class="form-group"><label for="bankAccountName" class="form-label">账户名称</label><input type="text" id="bankAccountName" name="bankAccountName" class="form-control" value="${settings.bankDetails.accountName}" placeholder="请输入账户名称"></div>
            <div class="form-group"><label for="bankBSB" class="form-label">BSB</label><input type="text" id="bankBSB" name="bankBSB" class="form-control" value="${settings.bankDetails.bsb}" placeholder="例如: 062-001"></div>
            <div class="form-group"><label for="bankAccount" class="form-label">银行账号</label><input type="text" id="bankAccount" name="bankAccount" class="form-control" value="${settings.bankDetails.account}" placeholder="请输入银行账号"></div>
          </div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">RMB</span><div><h3>人民币收款码</h3><p>请输入公开 HTTPS 图片地址。客户付款后提交 Reference 和付款截图，管理员审核后订单才会变为已付款。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="alipayQrUrl">支付宝收款码 URL</label><input class="form-control" id="alipayQrUrl" name="alipayQrUrl" type="url" value="${settings.rmbPayment.alipayQrUrl}" placeholder="https://.../alipay-qr.png"></div>
            <div class="form-group"><label class="form-label" for="wechatQrUrl">微信收款码 URL</label><input class="form-control" id="wechatQrUrl" name="wechatQrUrl" type="url" value="${settings.rmbPayment.wechatQrUrl}" placeholder="https://.../wechat-qr.png"></div>
          </div>
        </section>

        <section class="form-section">
          <div class="form-section-title"><span class="mono">REF</span><div><h3>推荐分成规则</h3><p>控制推荐返佣比例、层级深度和结算周期。</p></div></div>
          <div class="grid grid-3">
            <div class="form-group"><label class="form-label" for="defaultReferralRate">默认推荐分成比例 (%)</label><input type="number" id="defaultReferralRate" name="defaultReferralRate" class="form-control" value="${settings.referralSettings.defaultRate}" min="0" max="100"></div>
            <div class="form-group"><label class="form-label" for="referralLevelLimit">推荐层级限制</label><input type="number" id="referralLevelLimit" name="referralLevelLimit" class="form-control" value="${settings.referralSettings.levelLimit}" min="0"></div>
            <div class="form-group"><label class="form-label" for="referralSettlementPeriod">分成结算周期 (天)</label><input type="number" id="referralSettlementPeriod" name="referralSettlementPeriod" class="form-control" value="${settings.referralSettings.settlementPeriod}" min="1"></div>
          </div>
        </section>

        <div class="form-actions form-actions-right">
          <button type="submit" class="button button-primary">保存设置</button>
        </div>
      </form>
    </div>

    <script>
      (function() {
        const form = document.getElementById('systemSettingsForm');
        if (!form || form.dataset.settingsReady === 'true') return;
        form.dataset.settingsReady = 'true';
        form.addEventListener('submit', function(event) {
        event.preventDefault();

        const formData = new FormData(this);
        const inputValue = (id) => document.getElementById(id)?.value || '';
        const newSettings = {
          priceStrategy: formData.get('priceStrategy'),
          paymentMethods: {
            stripe: formData.has('enableStripe'),
            square: formData.has('enableSquare'),
            bankTransfer: formData.has('enableBankTransfer'),
            balancePayment: formData.has('enableBalancePayment'),
            alipay: formData.has('enableAlipay'),
            wechat: formData.has('enableWechat'),
            processingFeeRate: Number(formData.get('processingFeeRate') || 0) / 100,
            squareProcessingFeeRate: Number(formData.get('squareProcessingFeeRate') || 0) / 100,
          },
          stripeConfig: {
            publishableKey: formData.get('stripePublishableKey'),
            secretKey: formData.get('stripeSecretKey'),
            webhookSecret: formData.get('stripeWebhookSecret'),
            clear: formData.has('clearStripeConfig'),
          },
          squareConfig: {
            applicationId: inputValue('squareApplicationId'),
            locationId: inputValue('squareLocationId'),
            accessToken: inputValue('squareAccessToken'),
            environment: inputValue('squareEnvironment') || 'sandbox',
            webhookUrl: inputValue('squareWebhookUrl'),
            webhookSignatureKey: inputValue('squareWebhookSignatureKey'),
            clear: document.getElementById('clearSquareConfig')?.checked || false,
          },
          turnstileConfig: {
            siteKey: formData.get('turnstileSiteKey'),
            secretKey: formData.get('turnstileSecretKey'),
            clear: formData.has('clearTurnstileConfig'),
          },
          emailTransport: {
            host: inputValue('smtpHost'),
            port: inputValue('smtpPort'),
            user: inputValue('smtpUser'),
            password: inputValue('smtpPassword'),
            from: inputValue('smtpFrom'),
            encryption: inputValue('smtpEncryption') || 'tls',
            clear: document.getElementById('clearEmailTransport')?.checked || false,
          },
          notifyChannels: {
            emailProvider: document.getElementById('emailProvider').value,
            resendApiKey: document.getElementById('resendApiKey').value,
            resendFrom: document.getElementById('resendFrom').value,
            resendClear: document.getElementById('resendClear').checked,
            brevoApiKey: document.getElementById('brevoApiKey').value,
            brevoFrom: document.getElementById('brevoFrom').value,
            brevoClear: document.getElementById('brevoClear').checked,
            mailersendApiKey: document.getElementById('mailersendApiKey').value,
            mailersendFrom: document.getElementById('mailersendFrom').value,
            mailersendClear: document.getElementById('mailersendClear').checked,
            webhookEnabled: document.getElementById('webhookEnabled').checked,
            webhookUrl: document.getElementById('webhookUrl').value,
            webhookClear: document.getElementById('webhookClear').checked,
          },
          registrationSettings: {
            requireEmailVerification: document.getElementById('requireEmailVerification').checked,
          },
          tallyFormUrl: inputValue('tallyFormUrl'),
          feedbackRewards: {
            enabled: document.getElementById('feedbackRewardEnabled').checked,
            rewardType: inputValue('feedbackRewardType'),
            balanceAmountMin: Number(inputValue('feedbackBalanceAmountMin') || 0),
            balanceAmountMax: Number(inputValue('feedbackBalanceAmountMax') || 0),
            couponDiscountType: inputValue('feedbackCouponDiscountType'),
            couponDiscountValueMin: Number(inputValue('feedbackCouponDiscountValueMin') || 0),
            couponDiscountValueMax: Number(inputValue('feedbackCouponDiscountValueMax') || 0),
            couponMinimumOrderAmount: Number(inputValue('feedbackCouponMinimumOrderAmount') || 0),
            couponExpiresDays: Number(inputValue('feedbackCouponExpiresDays') || 30),
          },
          bankDetails: {
            bankName: formData.get('bankName'),
            accountName: formData.get('bankAccountName'),
            bsb: formData.get('bankBSB'),
            account: formData.get('bankAccount'),
          },
          rmbPayment: {
            alipayQrUrl: formData.get('alipayQrUrl'),
            wechatQrUrl: formData.get('wechatQrUrl'),
          },
          companyDetails: {
            name: formData.get('companyName'),
            abn: formData.get('companyAbn'),
            gstIncluded: formData.get('gstIncluded') === 'true',
            address: formData.get('companyAddress'),
            contact: formData.get('companyContact'),
            phone: formData.get('companyPhone'),
            email: formData.get('companyEmail'),
            website: formData.get('companyWebsite'),
            logo: formData.get('companyLogo'),
            pickupLocations: String(formData.get('pickupLocations') || '').split(/\\n+/).map(value => value.trim()).filter(Boolean),
                      deliveryAreas: String(formData.get('deliveryAreas') || '').split(/\\n+/).map(value => value.trim()).filter(Boolean),
                      deliveryNote: String(formData.get('deliveryNote') || '').trim(),
          },
          rentalRules: {
            unavailableDates: String(formData.get('unavailableDates') || '').split(/\\n+/).map(value => value.trim()).filter(Boolean),
            unavailableTimeSlots: String(formData.get('unavailableTimeSlots') || '').split(/\\n+/).reduce((result, line) => { const [date, values] = line.split(':'); const slots = String(values || '').split(',').map(value => value.trim()).filter(value => ['morning_service', 'morning', 'afternoon', 'evening_service'].includes(value)); if (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(date || '').trim()) && slots.length) result[String(date).trim()] = slots; return result; }, {}),
            minimumRentalDays: Number(formData.get('minimumRentalDays') || 1),
            bufferDays: Number(formData.get('bufferDays') || 0),
          },
          referralSettings: {
            defaultRate: parseInt(formData.get('defaultReferralRate')),
            levelLimit: parseInt(formData.get('referralLevelLimit')),
            settlementPeriod: parseInt(formData.get('referralSettlementPeriod')),
          },
        };
        
        // 发送到后端API保存
        fetch('/admin/settings/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings)
        })
        .then(async response => {
          const rawText = await response.text();
          let data = {};
          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            data = { error: rawText || '保存失败' };
          }
          if (!response.ok) throw new Error(data.error || '保存失败');
          return data;
        })
        .then(data => {
          if (data.success) {
            alert('系统设置已保存成功！');
            // Reload from D1 so the form always displays the persisted values,
            // rather than the browser's pre-submit values.
            window.location.reload();
          } else {
            alert('保存失败: ' + data.error);
          }
        })
        .catch(error => {
          console.error('Error saving settings:', error);
          alert('保存失败: ' + (error instanceof Error ? error.message : '请查看控制台获取详情。'));
        });
        });
      })();
    </script>
    <script>
      (function() {
        const input = document.getElementById('squareWebhookUrl');
        const button = document.getElementById('copySquareWebhookUrl');
        if (!input || !button || button.dataset.ready === 'true') return;
        button.dataset.ready = 'true';
        button.addEventListener('click', async function() {
          try {
            await navigator.clipboard.writeText(input.value);
          } catch (_) {
            input.focus();
            input.select();
            document.execCommand('copy');
          }
          const original = button.textContent;
          button.textContent = '已复制';
          window.setTimeout(() => { button.textContent = original || '复制'; }, 1500);
        });
      })();
    </script>
    <script>
      (function() {
        const button = document.getElementById('notifyChannelsTest');
        if (!button || button.dataset.ready === 'true') return;
        button.dataset.ready = 'true';
        const result = document.getElementById('notifyChannelsTestResult');
        button.addEventListener('click', function() {
          button.disabled = true;
          result.textContent = '发送中…';
          fetch('/admin/notify-channels/test', { method: 'POST' })
            .then(async function(response) {
              const data = await response.json().catch(function() { return {}; });
              if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
              return data;
            })
            .then(function(data) {
              const rows = (data.results || []);
              if (!rows.length) { result.textContent = '没有已启用的推送渠道。'; return; }
              result.textContent = rows.map(function(r) { return r.channel + ': ' + (r.ok ? 'OK' : '失败 (' + r.detail + ')'); }).join('　');
            })
            .catch(function(error) { result.textContent = '测试失败：' + error.message; })
            .finally(function() { button.disabled = false; });
        });
      })();
    </script>
  `;

  return buildLayout('系统设置 - 电脑租赁管理系统', body, user);
}
