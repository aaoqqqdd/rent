import { buildLayout, getUserById, getOrdersForUser, getDeviceById, formatCurrency } from '../../site';

export function renderAdminUserDetail(user: any, targetUserId: string) {
  const targetUser = getUserById(targetUserId)
  if (!targetUser) {
    return buildLayout('用户详情 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>您请求的用户不存在。</p></div>', user)
  }

  const orders = getOrdersForUser(targetUserId)

  const body = `
    <div class="panel">
      <div class="section-title"><h2>用户详情 - ${targetUser.name}</h2><span class="section-note">查看用户资料、订单历史及管理。</span></div>
      <div class="grid grid-2">
        <div>
          <h3>基本信息</h3>
          <p><strong>姓名:</strong> ${targetUser.name}</p>
          <p><strong>邮箱:</strong> ${targetUser.email}</p>
          <p><strong>角色:</strong> ${targetUser.role}</p>
          <p><strong>手机:</strong> ${targetUser.phone ?? 'N/A'}</p>
          <p><strong>注册日期:</strong> ${targetUser.registrationDate}</p>
          <p><strong>余额:</strong> ${formatCurrency(targetUser.balance)}</p>
        </div>
        <div>
          <h3>操作</h3>
          <a class="button" href="/admin/users/${targetUser.id}/edit">编辑用户信息</a>
          <form method="POST" action="/admin/users/${targetUser.id}/delete" onsubmit="return confirm('确定要删除此用户吗？');" style="margin-top: 10px;">
            <button class="button button-danger" type="submit">删除用户</button>
          </form>
        </div>
      </div>

      <div class="section-title" style="margin-top: 24px;"><h3>订单历史</h3></div>
      ${orders.length ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${orders.map((order) => {
              const device = getDeviceById(order.deviceId)
              return `<tr><td>${order.orderNo}</td><td>${device?.name ?? 'N/A'}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看订单</a></td></tr>`
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>此用户暂无订单历史。</p>'}
    </div>
  `
  return buildLayout('用户详情 - 电脑租赁管理系统', body, user)
}