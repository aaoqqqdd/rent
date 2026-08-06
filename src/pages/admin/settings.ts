/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getSystemSettings } from '../../site';

export function renderAdminSettings(user: any, stripe: any = {}) {
  const settings = getSystemSettings(); // 获取当前系统设置
  const emailTemplateJson = JSON.stringify(settings.emailTemplate).replace(/</g, '\\u003c')
  const emailVariables = ['user_name', 'user_email', 'order_no', 'contract_number', 'device_name', 'sign_link', 'expire_time']
  const emailVariableIndex = `<section class="contract-variable-group"><h5>邮件通知</h5><div class="variable-chip-list">${emailVariables.map(name => `<code>\${${name}}</code>`).join('')}</div></section>`

  const body = `
    <div class="panel">
      <div class="section-title"><h2>系统设置</h2><span class="section-note">配置公司资料、支付方式和推荐分成规则。</span></div>

      <div class="template-settings-notice">
        <div><strong>协议与合同模板已集中管理</strong><p>用户协议、租赁协议和正式合同模板现在分别在独立页面编辑。</p></div>
        <a href="/admin/templates" class="button button-secondary">前往协议与模板</a>
      </div>

      <form id="systemSettingsForm">
        <div class="form-group">
          <label>公司税务信息</label>
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
          </div>
        </div>
        <div class="form-group">
          <label for="priceStrategy">价格策略配置</label>
          <textarea id="priceStrategy" name="priceStrategy" rows="5" class="form-control">${settings.priceStrategy}</textarea>
        </div>

        <div class="form-group">
          <label>支付方式配置</label>
          <div class="checkbox-group">
            <input type="checkbox" id="enableStripe" name="enableStripe" ${settings.paymentMethods.stripe ? 'checked' : ''}>
            <label for="enableStripe">启用 Stripe 信用卡支付</label>
          </div>

          <div style="margin-top: 24px; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #cbd5e1;">
            <h4 style="margin-top:0;">Stripe API 配置</h4>
            <p class="section-note">当前状态：${stripe.configured ? `已配置（${stripe.mode === 'live' ? '正式模式' : '测试模式'}）` : '未配置'}。Webhook 地址：<code>/webhooks/stripe</code></p>
            <label class="form-label" for="stripePublishableKey">Publishable Key</label>
            <input class="form-control" id="stripePublishableKey" name="stripePublishableKey" value="${stripe.publishableKey || ''}" placeholder="pk_test_... 或 pk_live_...">
            <label class="form-label" for="stripeSecretKey">Secret Key</label>
            <input class="form-control" type="password" id="stripeSecretKey" name="stripeSecretKey" placeholder="${stripe.secretKeyMasked || 'sk_test_...'}" autocomplete="new-password">
            <label class="form-label" for="stripeWebhookSecret">Webhook Signing Secret</label>
            <input class="form-control" type="password" id="stripeWebhookSecret" name="stripeWebhookSecret" placeholder="${stripe.webhookSecretMasked || 'whsec_...'}" autocomplete="new-password">
            <label style="display:flex; gap:8px; align-items:center; margin-top:12px;"><input type="checkbox" name="clearStripeConfig"> 清除已保存的 Stripe 配置</label>
            <p class="section-note">私密密钥留空会保留现有值，保存后不会再次显示完整内容。</p>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="enableBankTransfer" name="enableBankTransfer" ${settings.paymentMethods.bankTransfer ? 'checked' : ''}>
            <label for="enableBankTransfer">启用银行转账</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="enableBalancePayment" name="enableBalancePayment" ${settings.paymentMethods.balancePayment ? 'checked' : ''}>
            <label for="enableBalancePayment">启用余额支付</label>
          </div>
          
          <!-- 银行转账账户信息设置 -->
          <div style="margin-top: 24px; padding: 24px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 1px solid #bae6fd;">
            <h4 style="margin: 0 0 20px 0; color: #0369a1; display: flex; align-items: center; gap: 8px;">
              🏦 银行转账账户信息
            </h4>
            <div class="grid grid-2">
              <div>
                <label for="bankName" class="form-label">银行名称</label>
                <input type="text" id="bankName" name="bankName" class="form-control" value="${settings.bankDetails.bankName}" placeholder="例如: Commonwealth Bank">
              </div>
              <div>
                <label for="bankAccountName" class="form-label">账户名称</label>
                <input type="text" id="bankAccountName" name="bankAccountName" class="form-control" value="${settings.bankDetails.accountName}" placeholder="请输入账户名称">
              </div>
              <div>
                <label for="bankBSB" class="form-label">BSB 码</label>
                <input type="text" id="bankBSB" name="bankBSB" class="form-control" value="${settings.bankDetails.bsb}" placeholder="例如: 062-001">
              </div>
              <div>
                <label for="bankAccount" class="form-label">银行账号</label>
                <input type="text" id="bankAccount" name="bankAccount" class="form-control" value="${settings.bankDetails.account}" placeholder="请输入银行账号">
              </div>
            </div>
            <p style="margin: 16px 0 0 0; color: #0c4a6e; font-size: 0.9rem;">
              💡 这些银行账户信息将会在用户选择银行转账时显示，供客户转账使用。
            </p>
          </div>
        </div>

        <div class="form-group">
          <label for="emailTemplate">邮件通知模板</label>
          <details class="variable-index"><summary>完整邮件变量索引（${emailVariables.length} 项）</summary>${emailVariableIndex}</details>
          <input type="hidden" id="emailTemplateKind" name="kind" value="email">
          <div class="editor-mode-toggle">
            <button type="button" id="emailTemplateModeHtml" class="active">可视编辑</button>
            <button type="button" id="emailTemplateModeMd">Markdown</button>
          </div>
          <div class="editor-card">
            <div id="emailTemplateEditor" class="quill-editor"></div>
          </div>
          <textarea id="emailTemplateMarkdown" class="markdown-editor" placeholder="请输入 Markdown 内容"></textarea>
          <textarea id="emailTemplate" name="emailTemplate" style="display:none;"></textarea>
          <div class="template-controls">
            <button type="button" id="emailTemplatePreviewButton" class="button button-secondary">预览变量替换</button>
            <span class="section-note">预览当前邮件模板并替换示例变量。</span>
          </div>
          <div id="emailTemplatePreview" class="template-preview"></div>
        </div>

        <div class="form-group">
          <label for="defaultReferralRate">默认推荐分成比例 (%)</label>
          <input type="number" id="defaultReferralRate" name="defaultReferralRate" class="form-control" value="${settings.referralSettings.defaultRate}" min="0" max="100">
        </div>

        <div class="form-group">
          <label for="referralLevelLimit">推荐层级限制</label>
          <input type="number" id="referralLevelLimit" name="referralLevelLimit" class="form-control" value="${settings.referralSettings.levelLimit}" min="0">
        </div>

        <div class="form-group">
          <label for="referralSettlementPeriod">分成结算周期 (天)</label>
          <input type="number" id="referralSettlementPeriod" name="referralSettlementPeriod" class="form-control" value="${settings.referralSettings.settlementPeriod}" min="1">
        </div>

        <div class="form-actions form-actions-right">
          <button type="submit" class="button button-primary">保存设置</button>
        </div>
      </form>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const emailTemplateEditor = window.createRichTextEditor('#emailTemplateEditor', {
          theme: 'snow',
          modules: {
            toolbar: [
              [{ font: [] }, { size: ['small', false, 'large', 'huge'] }, 'bold', 'italic', 'underline', 'strike', { color: [] }, { background: [] }],
              [{ header: [1, 2, 3, false] }, { list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }, { align: [] }, 'blockquote', 'code-block', 'link', 'clean']
            ]
          }
        });

        const emailTemplateMarkdown = document.getElementById('emailTemplateMarkdown');
        const emailTemplateModeHtml = document.getElementById('emailTemplateModeHtml');
        const emailTemplateModeMd = document.getElementById('emailTemplateModeMd');
        const emailTemplateKindInput = document.getElementById('emailTemplateKind');
        const emailTemplatePreviewButton = document.getElementById('emailTemplatePreviewButton');
        const emailTemplatePreview = document.getElementById('emailTemplatePreview');

        function switchEmailTemplateMode(toMd) {
          if (!emailTemplateEditor || !emailTemplateMarkdown || !emailTemplateModeHtml || !emailTemplateModeMd) return;
          if (toMd) {
            emailTemplateMarkdown.value = window.htmlToMarkdown(emailTemplateEditor.root.innerHTML);
            emailTemplateMarkdown.style.display = 'block';
            emailTemplateEditor.root.parentElement.style.display = 'none';
            emailTemplateModeMd.classList.add('active');
            emailTemplateModeHtml.classList.remove('active');
          } else {
            emailTemplateEditor.root.innerHTML = window.markdownToHtml(emailTemplateMarkdown.value);
            emailTemplateMarkdown.style.display = 'none';
            emailTemplateEditor.root.parentElement.style.display = 'block';
            emailTemplateModeMd.classList.remove('active');
            emailTemplateModeHtml.classList.add('active');
          }
        }

        async function updateEmailTemplatePreview(event) {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
          if (!emailTemplatePreview) return;
          emailTemplatePreview.textContent = '正在生成预览...';
          try {
            const kind = String(emailTemplateKindInput ? emailTemplateKindInput.value : 'email').trim();
            const content = emailTemplateMarkdown && emailTemplateMarkdown.style.display === 'block'
              ? window.markdownToHtml(emailTemplateMarkdown.value)
              : emailTemplateEditor.root.innerHTML;
            const response = await fetch('/admin/templates/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ kind, content })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || '预览失败');
            emailTemplatePreview.innerHTML = result.html || '<p>无预览内容</p>';
          } catch (error) {
            emailTemplatePreview.textContent = error instanceof Error ? error.message : '预览失败';
          }
        }

        emailTemplateModeHtml?.addEventListener('click', function () { switchEmailTemplateMode(false); });
        emailTemplateModeMd?.addEventListener('click', function () { switchEmailTemplateMode(true); });
        emailTemplatePreviewButton?.addEventListener('click', function(event) { updateEmailTemplatePreview(event); });

        // 将数据库中的内容加载到编辑器
        const emailTemplateContent = ${emailTemplateJson};
        if (emailTemplateContent) {
          emailTemplateEditor.root.innerHTML = emailTemplateContent;
          if (emailTemplateMarkdown) {
            emailTemplateMarkdown.value = window.htmlToMarkdown(emailTemplateContent);
            emailTemplateMarkdown.style.display = 'none';
          }
        }

        switchEmailTemplateMode(false);
        
        // 隐藏的 textarea 用于表单提交
        const emailTemplateTextarea = document.getElementById('emailTemplate');
        emailTemplateTextarea.value = emailTemplateContent;


        document.getElementById('systemSettingsForm').addEventListener('submit', function(event) {
        event.preventDefault();
        
        // 提交前，将编辑器内容同步到隐藏的 textarea
        const emailContent = emailTemplateMarkdown && emailTemplateMarkdown.style.display === 'block'
          ? window.markdownToHtml(emailTemplateMarkdown.value)
          : emailTemplateEditor.root.innerHTML;
        emailTemplateTextarea.value = emailContent;

        const formData = new FormData(this);
        const newSettings = {
          priceStrategy: formData.get('priceStrategy'),
          paymentMethods: {
            stripe: formData.has('enableStripe'),
            bankTransfer: formData.has('enableBankTransfer'),
            balancePayment: formData.has('enableBalancePayment'),
          },
          stripeConfig: {
            publishableKey: formData.get('stripePublishableKey'),
            secretKey: formData.get('stripeSecretKey'),
            webhookSecret: formData.get('stripeWebhookSecret'),
            clear: formData.has('clearStripeConfig'),
          },
          bankDetails: {
            bankName: formData.get('bankName'),
            accountName: formData.get('bankAccountName'),
            bsb: formData.get('bankBSB'),
            account: formData.get('bankAccount'),
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
          },
          emailTemplate: formData.get('emailTemplate'),
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
            updateEmailTemplatePreview?.();
          } else {
            alert('保存失败: ' + data.error);
          }
        })
        .catch(error => {
          console.error('Error saving settings:', error);
          alert('保存失败: ' + (error instanceof Error ? error.message : '请查看控制台获取详情。'));
        });
      });
      });
    </script>
  `;

  return buildLayout('系统设置 - 电脑租赁管理系统', body, user);
}
