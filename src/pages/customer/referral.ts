import { buildLayout, getUserById, formatCurrency } from '../../site';

export function renderCustomerReferral(user: any, errorMessage?: string) {
  // 假设 user 对象中包含 referrerCode, referredUsers, commissionBalance, pendingCommission, withdrawnCommission
  // 实际应用中这些数据需要从后端获取
  const currentUser = getUserById(user.id); // 重新获取最新用户数据，包含推荐信息

  if (!currentUser) {
    return buildLayout('我的推荐 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>无法加载推荐信息。</p></div>', user);
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的推荐</h2><span class="section-note">邀请好友，赚取佣金。</span></div>
      ${errorMessage ? `<div class="alert alert-error">${errorMessage}</div>` : ''}

      <div class="form-group">
        <label class="form-label">我的推荐码</label>
        <div class="input-group">
          <input type="text" class="form-control" value="${currentUser.referrerCode || '暂无推荐码'}" readonly id="referrerCodeInput" />
          <button class="button button-secondary" onclick="copyReferrerCode()">复制</button>
        </div>
        <p class="form-text">分享此推荐码给您的朋友，他们注册或下单时填写您的推荐码，您将获得佣金。</p>
      </div>

      <div class="grid grid-3" style="margin-top: 30px;">
        <div class="card text-center">
          <h3>累计佣金</h3>
          <p class="text-large">${formatCurrency(currentUser.commissionBalance + currentUser.pendingCommission + currentUser.withdrawnCommission)}</p>
        </div>
        <div class="card text-center">
          <h3>待结算佣金</h3>
          <p class="text-large">${formatCurrency(currentUser.pendingCommission)}</p>
        </div>
        <div class="card text-center">
          <h3>已提现佣金</h3>
          <p class="text-large">${formatCurrency(currentUser.withdrawnCommission)}</p>
        </div>
      </div>

      <div style="margin-top: 30px;">
        <h3>佣金提现</h3>
        <form method="POST" action="/customer/referral/withdraw">
          <div class="form-group">
            <label class="form-label" for="withdrawAmount">提现金额</label>
            <input type="number" id="withdrawAmount" name="amount" class="form-control" min="1" max="${currentUser.commissionBalance}" step="0.01" required />
            <p class="form-text">当前可提现余额: ${formatCurrency(currentUser.commissionBalance)}</p>
          </div>
          <div class="form-group">
            <label class="form-label" for="bsb">BSB (银行代码)</label>
            <input type="text" id="bsb" name="bsb" class="form-control" value="${currentUser.bsb || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="accountNumber">Account Number (银行账号)</label>
            <input type="text" id="accountNumber" name="accountNumber" class="form-control" value="${currentUser.account_number || ''}" required />
          </div>
          <button type="submit" class="button button-primary" ${currentUser.commissionBalance <= 0 ? 'disabled' : ''}>申请提现</button>
        </form>
      </div>

      <div style="margin-top: 30px;">
        <h3>已推荐好友列表</h3>
        ${currentUser.referredUsers && currentUser.referredUsers.length > 0 ? `
          <table class="table">
            <thead>
              <tr>
                <th>好友名称</th>
                <th>注册日期</th>
                <th>订单数量</th>
                <th>贡献佣金</th>
              </tr>
            </thead>
            <tbody>
              ${currentUser.referredUsers.map((referredUser: any) => `
                <tr>
                  <td>${referredUser.name}</td>
                  <td>${referredUser.registeredAt}</td>
                  <td>${referredUser.orderCount}</td>
                  <td>${formatCurrency(referredUser.contributedCommission)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>您还没有成功推荐任何好友。</p>'}
      </div>
    </div>
    <script>
      function copyReferrerCode() {
        const referrerCodeInput = document.getElementById('referrerCodeInput');
        referrerCodeInput.select();
        document.execCommand('copy');
        alert('推荐码已复制到剪贴板！');
      }
    </script>
  `;

  return buildLayout('我的推荐 - 电脑租赁管理系统', body, user);
}