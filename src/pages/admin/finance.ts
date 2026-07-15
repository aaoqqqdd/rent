import { buildLayout, formatCurrency } from '../../site';

export function renderAdminFinance(user: any, orders: any[] = []) {
  // 计算真实财务数据
  const totalRevenue = orders
    .filter(o => o.status === 'completed' || o.status === 'paid' || o.status === 'active')
    .reduce((sum, order) => sum + (order.totalAmount || order.total_amount || 0), 0)
  
  // 估算支出（押金退还等，暂时按收入的15%估算）
  const totalExpense = Math.round(totalRevenue * 0.15 * 100) / 100
  const netProfit = Math.round((totalRevenue - totalExpense) * 100) / 100

  const body = `
    <style>
      .finance-overview {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 32px;
      }
      .finance-card {
        background: var(--surface-secondary);
        padding: 24px;
        border-radius: var(--radius);
        border-left: 4px solid var(--primary);
      }
      .finance-card:nth-child(2) { border-left-color: var(--danger); }
      .finance-card:nth-child(3) { border-left-color: var(--success); }
      .finance-card h3 {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .finance-card .amount {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text);
      }
      .finance-sections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
      }
      .finance-section {
        padding: 24px;
        background: var(--surface-secondary);
        border-radius: var(--radius);
      }
      .finance-section h4 {
        margin-bottom: 12px;
        color: var(--text);
      }
      .finance-section p {
        color: var(--text-secondary);
        margin-bottom: 16px;
        font-size: 0.9rem;
      }
    </style>
    <div class="panel">
      <div class="section-title">
        <h2>财务管理</h2>
        <span class="section-note">管理系统收入、支出、对账和佣金发放。</span>
      </div>

      <div class="finance-overview">
        <div class="finance-card">
          <h3>总收入</h3>
          <p class="amount">${formatCurrency(totalRevenue)}</p>
        </div>
        <div class="finance-card">
          <h3>总支出</h3>
          <p class="amount">${formatCurrency(totalExpense)}</p>
        </div>
        <div class="finance-card">
          <h3>净利润</h3>
          <p class="amount">${formatCurrency(netProfit)}</p>
        </div>
      </div>

      <div class="finance-sections">
        <div class="finance-section">
          <h4>📊 收入统计</h4>
          <p>查看收入的图表和详细列表。</p>
          <a href="/admin/orders" class="button button-sm">查看订单</a>
        </div>
        <div class="finance-section">
          <h4>💸 支出管理</h4>
          <p>记录和管理各项系统支出。</p>
          <a href="/admin/orders" class="button button-sm">查看明细</a>
        </div>
        <div class="finance-section">
          <h4>✅ 对账记录</h4>
          <p>查看和核对所有交易记录。</p>
          <a href="/admin/orders" class="button button-sm">查看对账</a>
        </div>
        <div class="finance-section">
          <h4>📄 发票管理</h4>
          <p>生成、管理和发送客户发票。</p>
          <a href="/admin/orders" class="button button-sm">管理发票</a>
        </div>
        <div class="finance-section">
          <h4>💰 佣金发放记录</h4>
          <p>查看推荐佣金的计算和发放历史。</p>
          <a href="/admin/users" class="button button-sm">查看记录</a>
        </div>
      </div>
    </div>
  `;

  return buildLayout('财务管理 - 电脑租赁管理系统', body, user);
}