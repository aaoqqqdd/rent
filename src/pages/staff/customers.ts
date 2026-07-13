import { buildLayout, getUsers } from '../../site';

export function renderStaffCustomers(user: any, searchTerm: string = '') {
  const customers = getUsers().filter(u => u.role === 'CUSTOMER');

  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase();
    return customer.name.toLowerCase().includes(searchLower) ||
           customer.email.toLowerCase().includes(searchLower) ||
           (customer.phone ?? '').toLowerCase().includes(searchLower);
  });

  const body = `
    <div class="panel">
      <div class="section-title"><h2>客户管理</h2><span class="section-note">管理所有注册客户。</span></div>
      <div class="search-bar" style="margin-bottom: 20px;">
        <form action="/staff/customers" method="GET" style="display: flex; gap: 10px;">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索客户姓名、邮箱或手机..." value="${searchTerm}" style="flex-grow: 1;" />
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>
      <div class="table-wrapper">
        <table class="table"><thead><tr><th>姓名</th><th>邮箱</th><th>手机</th><th>注册日期</th><th>操作</th></tr></thead><tbody>
          ${filteredCustomers.map((customer) => `
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
  `;
  return buildLayout('客户管理 - 电脑租赁管理系统', body, user);
}