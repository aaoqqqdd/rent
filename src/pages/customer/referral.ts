/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById, formatCurrency } from '../../site';
import { Context } from 'hono';

function desensitizeName(name: string): string {
  const n = name || ''
  if (n.length <= 1) return n
  return `${n[0]}${'*'.repeat(Math.min(2, n.length - 1))}`
}

export async function renderCustomerReferral(c: Context, user: any, message?: string, type?: 'success' | 'error' | 'info') {
  // 使用统一归一化读取，确保 snake_case 数据库字段能被页面正确识别。
  const currentUser = await getUserById(c, user.id);
  
  if (!currentUser) {
    return buildLayout('我的推荐 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>无法加载推荐信息。</p></div>', user);
  }

  // 获取该用户的所有佣金记录
  const commissionRecords = await c.env.RENT.prepare(`
    SELECT * FROM commission_records WHERE referrer_id = ?
  `).bind(user.id).all();
  
  type CommissionRecord = { amount: number; status: string }

  const records = (commissionRecords.results || []) as CommissionRecord[]
  const commissionBalance = Number(currentUser.commissionBalance || 0)

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
  const tableInfo = await c.env.RENT.prepare('PRAGMA table_info(users)').all() as any;
  const userColumns = (tableInfo.results || []).map((column: any) => column.name);
  const hasReferrerIdSnake = userColumns.includes('referrer_id');
  const hasReferrerIdCamel = userColumns.includes('referrerId');

  let referredUsersQuery = `
    SELECT 
      u.name, 
      u.created_at as registeredAt,
      COUNT(r.id) as orderCount,
      SUM(cr.amount) as contributedCommission
    FROM users u
          LEFT JOIN orders r ON u.id = r.userId
          LEFT JOIN commission_records cr ON u.id = cr.customer_id
  `;

  const whereClauses: string[] = [];
  if (hasReferrerIdSnake) whereClauses.push('u.referrer_id = ?');
  if (hasReferrerIdCamel) whereClauses.push('u.referrerId = ?');

  if (whereClauses.length > 0) {
    referredUsersQuery += `WHERE ${whereClauses.join(' OR ')} `;
  } else {
    referredUsersQuery += 'WHERE 1 = 0 ';
  }

  referredUsersQuery += 'GROUP BY u.id';

  const referredUserBindings = hasReferrerIdSnake && hasReferrerIdCamel
    ? [user.id, user.id]
    : [user.id];

  const referredUsers = await c.env.RENT.prepare(referredUsersQuery).bind(...referredUserBindings).all();

  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的推荐</h2><span class="section-note">邀请好友，赚取佣金。</span></div>
      ${message ? `<div class="page-notification page-notification--${type || 'info'}">${message}</div>` : ''}

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
            <p class="form-text">分享此推荐码给您的朋友，他们在签署合同或注册时填写您的推荐码，您将获得系统自动计算的佣金分成。</p>
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
        <form method="POST" action="/customer/referral/withdraw" id="withdrawForm">
          <div class="form-group">
            <label class="form-label" for="withdrawAmount">提现金额</label>
            <input type="number" id="withdrawAmount" name="amount" class="form-control" min="0.01" max="${commissionBalance}" step="0.01" required />
            <p class="form-text">当前可提现余额: ${formatCurrency(commissionBalance)}</p>
          </div>
          
          <div class="form-group">
            <label class="form-label">提现方式</label>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; border: 1px solid var(--border); border-radius: 8px;">
                <input type="radio" name="withdrawMethod" value="balance" checked onchange="toggleBankDetails()" />
                <div>
                  <strong>划入账户余额</strong>
                  <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 14px;">无最低金额限制，即时到账</p>
                </div>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; border: 1px solid var(--border); border-radius: 8px;">
                <input type="radio" name="withdrawMethod" value="bank_transfer" onchange="toggleBankDetails()" ${commissionBalance >= 100 ? '' : 'disabled'} />
                <div>
                  <strong>银行转账</strong>
                  <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 14px;">最低提现金额100澳元，1-2个工作日到账</p>
                </div>
              </label>
            </div>
          </div>
          
          <div id="bankDetailsSection" style="display: none;">
            <div class="form-group">
              <label class="form-label" for="accountName">银行账户名称</label>
              <input type="text" id="accountName" name="account_name" class="form-control" value="${currentUser.name || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="bsb">BSB (银行代码)</label>
              <input type="text" id="bsb" name="bsb" class="form-control" value="${currentUser.bsb || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="accountNumber">Account Number (银行账号)</label>
              <input type="text" id="accountNumber" name="account_number" class="form-control" value="${currentUser.account_number || ''}" />
            </div>
          </div>
          
          <button type="submit" class="button button-primary" ${commissionBalance <= 0 ? 'disabled' : ''}>申请提现</button>
        </form>
        <script>
          function toggleBankDetails() {
            const method = document.querySelector('input[name="withdrawMethod"]:checked').value;
            const bankSection = document.getElementById('bankDetailsSection');
            const amountInput = document.getElementById('withdrawAmount');
            const bankInputs = bankSection.querySelectorAll('input');
            
            if (method === 'bank_transfer') {
              bankSection.style.display = 'block';
              amountInput.min = 100;
              amountInput.step = 1;
              amountInput.setAttribute('placeholder', '请输入整数金额');
              bankInputs.forEach(input => input.required = true);
            } else {
              bankSection.style.display = 'none';
              amountInput.min = 0.01;
              amountInput.step = 0.01;
              amountInput.removeAttribute('placeholder');
              bankInputs.forEach(input => input.required = false);
            }
          }

          function validateWithdrawAmount() {
            const method = document.querySelector('input[name="withdrawMethod"]:checked').value;
            const amountInput = document.getElementById('withdrawAmount');
            const amount = Number(amountInput.value);
            const isInteger = Number.isInteger(amount);

            if (method === 'bank_transfer') {
              if (!isInteger || amount < 100) {
                amountInput.setCustomValidity('银行转账提现金额必须为大于 100 的整数');
                return false;
              }
            } else if (!Number.isFinite(amount) || amount <= 0) {
              amountInput.setCustomValidity('余额提现金额必须大于 0');
              return false;
            }

            amountInput.setCustomValidity('');
            return true;
          }

          document.getElementById('withdrawForm').addEventListener('submit', function (event) {
            if (!validateWithdrawAmount()) {
              event.preventDefault();
            }
          });

          document.getElementById('withdrawAmount').addEventListener('input', validateWithdrawAmount);
          document.querySelectorAll('input[name="withdrawMethod"]').forEach((input) => {
            input.addEventListener('change', toggleBankDetails);
          });

          window.addEventListener('load', function () {
            toggleBankDetails();
            validateWithdrawAmount();
          });
        </script>
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
