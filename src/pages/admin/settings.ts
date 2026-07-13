import { buildLayout, getSystemSettings, updateSystemSettings } from '../../site';

export function renderAdminSettings(user: any) {
  const settings = getSystemSettings(); // 获取当前系统设置

  const body = `
    <div class="panel">
      <div class="section-title"><h2>系统设置</h2><span class="section-note">配置系统各项参数，包括租赁条款、支付方式和推荐分成规则。</span></div>

      <form id="systemSettingsForm">
        <div class="form-group">
          <label for="rentalTerms">租赁条款</label>
          <textarea id="rentalTerms" name="rentalTerms" rows="10" class="form-control">${settings.rentalTerms}</textarea>
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
          <textarea id="emailTemplate" name="emailTemplate" rows="5" class="form-control">${settings.emailTemplate}</textarea>
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
      document.getElementById('systemSettingsForm').addEventListener('submit', function(event) {
        event.preventDefault();
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
        // 假设 updateSystemSettings 是一个异步函数，通过 API 调用更新后端设置
        updateSystemSettings(newSettings).then(() => {
          alert('系统设置已保存成功！');
          window.location.reload();
        }).catch(error => {
          alert('保存失败: ' + error.message);
        });
      });
    </script>
  `;

  return buildLayout('系统设置 - 电脑租赁管理系统', body, user);
}