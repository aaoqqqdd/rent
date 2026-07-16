import { buildLayout, getUserById, formatCurrency } from '../../site';
import { Context } from 'hono';

function desensitizeName(name: string): string {
  const n = name || ''
  if (n.length <= 1) return n
  return `${n[0]}${'*'.repeat(Math.min(2, n.length - 1))}`
}

export async function renderCustomerReferral(c: Context, user: any, errorMessage?: string) {
  // 从数据库获取完整的用户信息和佣金统计
  const currentUser = await c.env.RENT.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  
  if (!currentUser) {
    return buildLayout('我的推荐 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>无法加载推荐信息。</p></div>', user);
  }

  // 获取该用户的所有佣金记录
  const commissionRecords = await c.env.RENT.prepare(`
    SELECT * FROM commission_records WHERE referrer_id = ?
  `).bind(user.id).all();
  
  type CommissionRecord = { amount: number; status: string }

  const records = (commissionRecords.results || []) as CommissionRecord[]

  // 计算佣金统计
  const totalCommission = records.reduce((sum, record) => sum + (record.amount || 0), 0)
  const pendingCommission = records
    .filter((record) => record.status === 'pending')
    .reduce((sum, record) => sum + (record.amount || 0), 0)
  const settledCommission = records
    .filter((record) => record.status === 'settled')
    .reduce((sum, record) => sum + (record.amount || 0), 0)
  const withdrawnCommission = records
    .filter((record) => record.status === 'withdrawn')
    .reduce((sum, record) => sum + (record.amount || 0), 0)
  
  // 获取已推荐的好友列表
  const referredUsers = await c.env.RENT.prepare(`
    SELECT 
      u.name, 
      u.createdAt as registeredAt,
      COUNT(r.id) as orderCount,
      SUM(cr.amount) as contributedCommission
    FROM users u
    LEFT JOIN orders r ON u.id = r.userId
    LEFT JOIN commission_records cr ON u.id = cr.userId
    WHERE u.referrerId = ?
    GROUP BY u.id
  `).bind(user.id).all();

  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的推荐</h2><span class="section-note">邀请好友，赚取佣金。</span></div>
      ${errorMessage ? `<div class="alert alert-error">${errorMessage}</div>` : ''}

      ${!currentUser.referralCode ? `
        <div style="margin-bottom: 30px; padding: 24px; background: var(--surface-secondary); border-radius: 12px; text-align: center;">
          <h3>加入推荐计划</h3>
          <p style="color: var(--text-secondary); margin: 16px 0;">加入我们的推荐计划，获取专属推荐码，邀请好友租赁电脑，赚取丰厚佣金！</p>
          <form method="POST" action="/customer/referral/join" style="display: inline-block;">
            <button type="submit" class="button button-primary">立即加入</button>
          </form>
        </div>
      ` : `
        <div style="margin-bottom: 30px;">
          <div class="form-group">
            <label class="form-label">我的推荐码</label>
            <div class="input-group">
              <input type="text" class="form-control" value="${currentUser.referralCode}" readonly id="referrerCodeInput" />
              <button class="button button-secondary" onclick="copyReferrerCode()">复制</button>
            </div>
            <p class="form-text">分享此推荐码给您的朋友，他们在签署合同时填写您的推荐码，您将获得系统自动计算的佣金分成。</p>
          </div>
          
          <form method="POST" action="/customer/referral/leave" style="margin-top: 16px;">
            <button type="submit" class="button button-danger" onclick="return confirm('确定要退出推荐计划吗？退出后您的推荐码将失效，且无法再获得新的佣金。')">退出推荐计划</button>
          </form>
        </div>
      `}

      ${currentUser.referralCode ? `

      <div class="grid grid-3" style="margin-top: 30px;">
        <div class="card text-center">
          <h3>累计佣金</h3>
          <p class="text-large">${formatCurrency(totalCommission)}</p>
        </div>
        <div class="card text-center">
          <h3>待结算佣金</h3>
          <p class="text-large">${formatCurrency(pendingCommission)}</p>
        </div>
        <div class="card text-center">
          <h3>已提现佣金</h3>
          <p class="text-large">${formatCurrency(withdrawnCommission)}</p>
        </div>
      </div>

      <div style="margin-top: 30px;">
        <h3>佣金提现</h3>
        <form method="POST" action="/customer/referral/withdraw">
          <div class="form-group">
            <label class="form-label" for="withdrawAmount">提现金额</label>
            <input type="number" id="withdrawAmount" name="amount" class="form-control" min="1" max="${currentUser.commission_balance}" step="0.01" required />
            <p class="form-text">当前可提现余额: ${formatCurrency(currentUser.commission_balance)}</p>
          </div>
          <div class="form-group">
            <label class="form-label" for="bsb">BSB (银行代码)</label>
            <input type="text" id="bsb" name="bsb" class="form-control" value="${currentUser.bsb || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="accountNumber">Account Number (银行账号)</label>
            <input type="text" id="accountNumber" name="account_number" class="form-control" value="${currentUser.account_number || ''}" required />
          </div>
          <button type="submit" class="button button-primary" ${currentUser.commission_balance <= 0 ? 'disabled' : ''}>申请提现</button>
        </form>
      </div>

      <div style="margin-top: 30px;">
        <h3>已推荐好友列表</h3>
        ${referredUsers.results && referredUsers.results.length > 0 ? `
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
              ${referredUsers.results.map((referredUser: any) => `
                <tr>
                  <td>${desensitizeName(referredUser.name)}</td>
                  <td>${referredUser.registeredAt}</td>
                  <td>${referredUser.orderCount}</td>
                  <td>${formatCurrency(referredUser.contributedCommission || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>您还没有成功推荐任何好友。</p>'}
      </div>
    ` : ''}
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