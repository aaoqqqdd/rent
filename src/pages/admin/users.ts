import { buildLayout } from '../../site';

export async function renderAdminUsers(user: any, c: any) {
  const { getUsersAsync } = await import('../../site')
  const allUsers = await getUsersAsync(c);

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>用户管理</h2>
        <span class="section-note">查看、添加、编辑和管理所有系统用户。</span>
        <a href="/admin/users/new" class="button" style="margin-left: auto;">添加新用户</a>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>姓名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${allUsers.map(u => `
              <tr>
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.role}</td>
                <td>${u.status}</td>
                <td>
                  <a class="link-button" href="/admin/users/${u.id}">查看详情</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return buildLayout('用户管理 - 电脑租赁管理系统', body, user);
}