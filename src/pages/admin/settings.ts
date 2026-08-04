/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, getSystemSettings, updateSystemSettings } from '../../site';

export function renderAdminSettings(user: any, stripe: any = {}) {
  const settings = getSystemSettings(); // 获取当前系统设置

  const body = `
    <div class="panel">
      <div class="section-title"><h2>系统设置</h2><span class="section-note">配置系统各项参数，包括租赁条款、支付方式和推荐分成规则。</span></div>

      <form id="systemSettingsForm">
        <div class="form-group">
          <label>公司税务信息</label>
          <div class="grid grid-2">
            <div><label class="form-label" for="companyAbn">公司 ABN</label><input id="companyAbn" name="companyAbn" class="form-control" value="${settings.companyDetails.abn}" placeholder="11 位 ABN"></div>
            <div><label class="form-label" for="gstIncluded">GST 设置</label><select id="gstIncluded" name="gstIncluded" class="form-control"><option value="true" ${settings.companyDetails.gstIncluded ? 'selected' : ''}>价格包含 GST</option><option value="false" ${!settings.companyDetails.gstIncluded ? 'selected' : ''}>价格不含 GST</option></select></div>
            <div><label class="form-label" for="companyAddress">公司地址</label><input id="companyAddress" name="companyAddress" class="form-control" value="${settings.companyDetails.address}"></div>
            <div><label class="form-label" for="companyContact">公司联系人</label><input id="companyContact" name="companyContact" class="form-control" value="${settings.companyDetails.contact}"></div>
            <div><label class="form-label" for="companyPhone">公司电话</label><input id="companyPhone" name="companyPhone" class="form-control" value="${settings.companyDetails.phone}"></div>
            <div><label class="form-label" for="companyEmail">公司邮箱</label><input type="email" id="companyEmail" name="companyEmail" class="form-control" value="${settings.companyDetails.email}"></div>
          </div>
        </div>
        <div class="form-group">
          <label for="rentalTerms">租赁条款</label>
          <div style="background: var(--info-light); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--info);">
             <strong style="color: #155e75; display: block; margin-bottom: 12px;">📋 租赁条款模板可用变量：</strong>
             <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
               <table style="width: 100%; border-collapse: collapse; background: white;">
                 <thead>
                   <tr style="background: var(--primary-light);">
                     <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">变量名</th>
                     <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">数据来源</th>
                     <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">说明</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${contract_number}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统生成</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">合同编号</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${company_address}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">公司地址</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${company_phone}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">公司电话</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${company_contact}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统设置</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">公司联系人</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${customer_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">承租方姓名</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备名称</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${start_date}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁起始日</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${end_date}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">员工填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁结束日</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${total_rent}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统计算</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租金总额</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace;">\${deposit_amount}</td><td style="padding: 6px 12px;">员工填写</td><td style="padding: 6px 12px;">押金金额</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${device_condition}</td><td>员工填写</td><td>出租时设备状况</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${device_accessories}</td><td>员工填写</td><td>配件列表</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${late_fee_per_day}</td><td>员工填写</td><td>每日逾期费用</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${repair_cost}</td><td>员工后续填写</td><td>损坏维修金额</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${pickup_location}</td><td>员工填写</td><td>取货地点</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${return_location}</td><td>员工填写</td><td>归还地点</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${company_abn}</td><td>系统设置</td><td>公司 ABN</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${gst_included}</td><td>系统设置</td><td>是否含 GST</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${esign_ip}</td><td>系统记录</td><td>电子签约 IP</td></tr>
                   <tr><td style="padding:6px 12px;font-family:monospace;">\${esign_device}</td><td>系统记录</td><td>签约设备</td></tr>
                 </tbody>
               </table>
             </div>
           </div>
          <div id="rentalTermsEditor" style="height: 250px;"></div>
          <textarea id="rentalTerms" name="rentalTerms" style="display:none;"></textarea>
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
          <div style="background: var(--info-light); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--info);">
             <strong style="color: #155e75; display: block; margin-bottom: 12px;">📧 邮件通知模板可用变量：</strong>
             <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
               <table style="width: 100%; border-collapse: collapse; background: white;">
                 <thead>
                   <tr style="background: var(--primary-light);">
                     <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">变量名</th>
                     <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">数据来源</th>
                     <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--border);">说明</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${user_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">收件人姓名</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${user_email}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">客户填写</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">收件人邮箱</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${order_no}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统生成</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">订单编号</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${contract_number}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统生成</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">合同编号</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${device_name}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">设备表</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">租赁设备名称</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace; border-bottom: 1px solid var(--border);">\${sign_link}</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">系统生成</td><td style="padding: 6px 12px; border-bottom: 1px solid var(--border);">合同签署链接</td></tr>
                   <tr><td style="padding: 6px 12px; font-family: monospace;">\${expire_time}</td><td style="padding: 6px 12px;">系统设置</td><td style="padding: 6px 12px;">签署链接有效期</td></tr>
                 </tbody>
               </table>
             </div>
           </div>
          <div id="emailTemplateEditor" style="height: 150px;"></div>
          <textarea id="emailTemplate" name="emailTemplate" style="display:none;"></textarea>
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

        <button type="submit" class="button button-primary">保存设置</button>
      </form>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        // 初始化 Quill 编辑器
        const rentalTermsEditor = new Quill('#rentalTermsEditor', {
          theme: 'snow',
          modules: {
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['link', 'image'],
              ['clean']
            ]
          }
        });
        const emailTemplateEditor = new Quill('#emailTemplateEditor', {
          theme: 'snow',
          modules: {
            toolbar: [['bold', 'italic'], ['link']]
          }
        });

        // 将数据库中的内容加载到编辑器
        const rentalTermsContent = ${JSON.stringify(settings.rentalTerms)};
        const emailTemplateContent = ${JSON.stringify(settings.emailTemplate)};
        if (rentalTermsContent) {
          rentalTermsEditor.root.innerHTML = rentalTermsContent;
        }
        if (emailTemplateContent) {
          emailTemplateEditor.root.innerHTML = emailTemplateContent;
        }
        
        // 隐藏的 textarea 用于表单提交
        const rentalTermsTextarea = document.getElementById('rentalTerms');
        const emailTemplateTextarea = document.getElementById('emailTemplate');
        rentalTermsTextarea.value = rentalTermsContent;
        emailTemplateTextarea.value = emailTemplateContent;


      document.getElementById('systemSettingsForm').addEventListener('submit', function(event) {
        event.preventDefault();
        
        // 提交前，将编辑器内容同步到隐藏的 textarea
        rentalTermsTextarea.value = rentalTermsEditor.root.innerHTML;
        emailTemplateTextarea.value = emailTemplateEditor.root.innerHTML;

        const formData = new FormData(this);
        const newSettings = {
          rentalTerms: formData.get('rentalTerms'),
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
            accountName: formData.get('bankAccountName'),
            bsb: formData.get('bankBSB'),
            account: formData.get('bankAccount'),
          },
          companyDetails: {
            abn: formData.get('companyAbn'),
            gstIncluded: formData.get('gstIncluded') === 'true',
            address: formData.get('companyAddress'),
            contact: formData.get('companyContact'),
            phone: formData.get('companyPhone'),
            email: formData.get('companyEmail'),
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
          let data: any = {};
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
      });
    </script>
  `;

  return buildLayout('系统设置 - 电脑租赁管理系统', body, user);
}
