import { buildLayout, getSystemSettings, updateSystemSettings } from '../../site';

export function renderAdminSettings(user: any) {
  const settings = getSystemSettings(); // 获取当前系统设置

  const body = `
    <div class="panel">
      <div class="section-title"><h2>系统设置</h2><span class="section-note">配置系统各项参数，包括租赁条款、支付方式和推荐分成规则。</span></div>

      <form id="systemSettingsForm">
        <div class="form-group">
          <label for="rentalTerms">租赁条款</label>
          <div style="background: var(--info-light); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--info);">
             <strong style="color: #155e75; display: block; margin-bottom: 12px;">📋 租赁条款模板可用变量：</strong>
             <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
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
               </tbody>
             </table>
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
            <input type="checkbox" id="enableSquare" name="enableSquare" ${settings.paymentMethods.square ? 'checked' : ''}>
            <label for="enableSquare">启用 Square 支付</label>
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
             <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
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
      rentalTermsEditor.root.innerHTML = rentalTermsContent;
      emailTemplateEditor.root.innerHTML = emailTemplateContent;
      
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
            square: formData.has('enableSquare'),
            bankTransfer: formData.has('enableBankTransfer'),
            balancePayment: formData.has('enableBalancePayment'),
          },
          bankDetails: {
            accountName: formData.get('bankAccountName'),
            bsb: formData.get('bankBSB'),
            account: formData.get('bankAccount'),
          },
          emailTemplate: formData.get('emailTemplate'),
          referralSettings: {
            defaultRate: parseInt(formData.get('defaultReferralRate')),
            levelLimit: parseInt(formData.get('referralLevelLimit')),
            settlementPeriod: parseInt(formData.get('referralSettlementPeriod')),
          },
        };
        
        // 这里的 updateSystemSettings 是一个示意函数，实际应用中你需要实现它
        // 它可能是一个 fetch 调用，将 newSettings 发送到后端 API
        console.log('Saving new settings:', newSettings);
        
        // 发送到后端API保存
        fetch('/admin/settings/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings)
        })
        .then(response => response.json())
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
          alert('保存失败，请查看控制台获取详情。');
        });
      });
    </script>
  `;

  return buildLayout('系统设置 - 电脑租赁管理系统', body, user);
}