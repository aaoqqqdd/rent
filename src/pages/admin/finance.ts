import { buildLayout } from '../../site';

export function renderAdminFinance(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>财务管理</h2><span class="section-note">管理系统收入、支出、对账和佣金发放。</span></div>

      <div class="finance-overview">
        <div class="card">
          <h3>总收入</h3>
          <p class="amount">$12,345.67</p>
        </div>
        <div class="card">
          <h3>总支出</h3>
          <p class="amount">$2,345.67</p>
        </div>
        <div class="card">
          <h3>净利润</h3>
          <p class="amount">$10,000.00</p>
        </div>
      </div>

      <div class="finance-sections">
        <div class="section">
          <h4>收入统计</h4>
          <p>这里将展示收入的图表和详细列表。</p>
          <a href="#" class="button button-sm button-primary">查看详情</a>
        </div>
        <div class="section">
          <h4>支出管理</h4>
          <p>记录和管理各项系统支出。</p>
          <a href="#" class="button button-sm button-primary">管理支出</a>
        </div>
        <div class="section">
          <h4>对账记录</h4>
          <p>查看和核对所有交易记录。</p>
          <a href="#" class="button button-sm button-primary">查看对账</a>
        </div>
        <div class="section">
          <h4>发票管理</h4>
          <p>生成、管理和发送客户发票。</p>
          <a href="#" class="button button-sm button-primary">管理发票</a>
        </div>
        <div class="section">
          <h4>佣金发放记录</h4>
          <p>查看推荐佣金的计算和发放历史。</p>
          <a href="#" class="button button-sm button-primary">查看记录</a>
        </div>
      </div>
    </div>
  `;

  return buildLayout('财务管理 - 电脑租赁管理系统', body, user);
}