import { buildLayout, getSystemSettings, updateSystemSettings } from '../../site';

export function renderAdminSettings(user: any) {
  const settings = getSystemSettings(); // 获取当前系统设置

  const body = `
    <div class="panel">
      <div class="section-title"><h2>系统设置</h2><span class="section-note">配置系统各项参数，包括租赁条款、支付方式和推荐分成规则。</span></div>

      <form id="systemSettingsForm">
        <div class="form-group">
          <label for="rentalTerms">租赁条款</label>
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
        </div>

        <div class="form-group">
          <label for="emailTemplate">邮件通知模板</label>
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
      const rentalTermsContent = '${settings.rentalTerms}';
      const emailTemplateContent = '${settings.emailTemplate}';
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
        alert('设置已保存（演示）。请在控制台查看提交的数据。');
        
        // 实际场景中，你可能会这样做：
        /*
        fetch('/api/admin/settings', {
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
        */
      });
    </script>
  `;

  return buildLayout('系统设置 - 电脑租赁管理系统', body, user);
}