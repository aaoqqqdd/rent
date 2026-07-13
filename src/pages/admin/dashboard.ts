import { buildLayout } from '../../site';

export function renderAdminDashboard(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>管理员仪表盘</h2><span class="section-note">系统数据总览和关键指标。</span></div>
      <p>欢迎回来，${user.name}！</p>
      <p>这里是管理员仪表盘，更多功能正在开发中。</p>
    </div>
  `;
  return buildLayout('管理员仪表盘 - 电脑租赁管理系统', body, user);
}