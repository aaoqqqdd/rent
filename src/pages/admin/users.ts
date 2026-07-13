import { buildLayout, getUsers } from '../../site';

export function renderAdminUsers(user: any) {
  const users = getUsers()
  const body = `
    <div class="panel">
      <h2>用户管理</h2>
      <div style="margin-bottom: 20px;">
        <a class="button button-primary" href="/admin/users/new">添加新用户</a>
      </div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>姓名</th><th>邮箱</th><th>角色</th><th>注册日期</th><th>操作</th></tr></thead><tbody>
          ${users.map((u) => `
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td>${u.role}</td>
              <td>${u.registrationDate}</td>
              <td>
                <a class="link-button" href="/admin/users/${u.id}">查看</a>
                <a class="link-button" href="/admin/users/${u.id}/edit">编辑</a>
              </td>
            </tr>
          `).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('用户管理 - 电脑租赁管理系统', body, user)
}