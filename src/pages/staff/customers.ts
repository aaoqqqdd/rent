import { buildLayout, getUsers } from '../../site';

export function renderStaffCustomers(user: any) {
  const customers = getUsers().filter(u => u.role === 'customer')
  const body = `
    <div class="panel">
      <h2>客户管理</h2>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>姓名</th><th>邮箱</th><th>手机</th><th>注册日期</th><th>操作</th></tr></thead><tbody>
          ${customers.map((customer) => `
            <tr>
              <td>${customer.name}</td>
              <td>${customer.email}</td>
              <td>${customer.phone ?? 'N/A'}</td>
              <td>${customer.registrationDate}</td>
              <td>
                <a class="link-button" href="/staff/customers/${customer.id}">查看</a>
                <a class="link-button" href="/staff/customers/${customer.id}/edit">编辑</a>
              </td>
            </tr>
          `).join('')}
        </tbody></table>
      </div>
    </div>
  `
  return buildLayout('客户管理 - 电脑租赁管理系统', body, user)
}