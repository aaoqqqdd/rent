import { buildLayout, getOrders, getUserById, getDeviceById } from '../../site'
import type { Context } from 'hono'

export async function renderStaffRentalsTracking(c: Context, user: any, status?: string) {
  const allOrders = await getOrders(c)

  const ordersWithDetails = await Promise.all(
    allOrders.map(async (order: any) => {
      const customer = await getUserById(c, order.userId)
      const device = await getDeviceById(c, order.deviceId)
      return { ...order, customer, device }
    })
  )

  // 根据URL参数筛选订单
  const filteredOrders = status 
    ? ordersWithDetails.filter((r: any) => r.status === status)
    : ordersWithDetails.filter((r: any) => ['active', 'paid', 'approved'].includes(r.status));

  const body = `
    <div class="panel">
      <div class="section-title"><h2>租赁进度管理</h2><span class="section-note">追踪租赁中订单，处理到期提醒和归还。</span></div>

      <!-- 筛选按钮 - 和合同页面保持一致的设计 -->
      <div class="filter-tabs" style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="/staff/rentals/tracking" class="button ${!status ? 'button-primary' : 'button-secondary'}">全部租赁中</a>
        <a href="/staff/rentals/tracking?status=completed" class="button ${status === 'completed' ? 'button-primary' : 'button-secondary'}">已完成</a>
        <a href="/staff/rentals/tracking?status=cancelled" class="button ${status === 'cancelled' ? 'button-primary' : 'button-secondary'}">已取消</a>
      </div>

      ${
        filteredOrders.length > 0
          ? `
        <table class="table">
          <thead>
            <tr>
              <th>订单编号</th>
              <th>客户</th>
              <th>设备</th>
              <th>租期</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders
              .map((order: any) => {
                // 显示友好的中文状态标签
                const statusText = order.status === 'completed' ? '已完成' : 
                                  order.status === 'cancelled' ? '已取消' : 
                                  order.status;
                return `
                <tr>
                  <td>${order.orderNo}</td>
                  <td>${order.customer?.role === 'CUSTOMER' ? order.customer?.name : '待客户填写'}</td>
                  <td>${order.device?.name ?? '未知设备'}</td>
                  <td>${order.startDate} 至 ${order.endDate}</td>
                  <td>${statusText}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看详情</a>
                    ${['active', 'paid', 'approved'].includes(order.status) ? `
                    <a class="button button-sm button-primary" href="/staff/orders/${order.id}/return-check">归还验收</a>
                    <a class="button button-sm button-danger" href="/staff/orders/${order.id}/overdue">逾期处理</a>
                    ` : ''}
                  </td>
                </tr>
              `
              })
              .join('')}
          </tbody>
        </table>
      `
          : '<p>目前没有符合条件的租赁记录。</p>'
      }
    </div>
  `

  return buildLayout('租赁进度管理 - 电脑租赁管理系统', body, user)
}