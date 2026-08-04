import { buildLayout, getOrders, getUserById, getDeviceById, getAllContracts, getUsers } from '../../site'
import type { Context } from 'hono'

export async function renderStaffRentalsTracking(c: Context, user: any, status?: string, searchTerm?: string) {
  const allOrders = await getOrders(c)
  const allContracts = await getAllContracts(c)
  const allUsers = await getUsers(c)

  const rentalStatuses = ['pending_pickup', 'pending_return', 'active', 'paid', 'approved']
  const allStatuses = [...rentalStatuses, 'completed', 'cancelled', 'expiring']
  
  // 根据URL参数筛选订单
  let filteredOrders = allOrders
  if (status && allStatuses.includes(status)) {
    filteredOrders = allOrders.filter((r: any) => r.status === status)
  } else if (status === 'expiring') {
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    filteredOrders = allOrders.filter((order: any) => {
      if (order.endDate) {
        const endDate = new Date(order.endDate);
        // 订单状态不是已完成或已取消，并且结束日期在未来7天内
        return order.status !== 'completed' && order.status !== 'cancelled' && endDate > now && endDate <= sevenDaysLater;
      }
      return false;
    });
  }

  const ordersWithDetails = await Promise.all(
    filteredOrders.map(async (order: any) => {
      const customer = await getUserById(c, order.userId)
      const device = order.deviceId ? await getDeviceById(c, order.deviceId) : null
      return { ...order, customer, device }
    })
  )

  // 搜索功能
  let finalOrders = ordersWithDetails;
  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim()
    finalOrders = ordersWithDetails.filter((order: any) => {
      return [order.orderNo, order.id, order.customer?.name, order.customer?.email, order.device?.name, order.startDate, order.endDate]
        .filter(Boolean)
        .some((value: any) => String(value).toLowerCase().includes(searchLower))
    })
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>当前租赁中</h2><span class="section-note">追踪租赁中订单，处理到期提醒和归还。</span></div>

      <!-- 筛选按钮 - 和合同页面保持一致的设计 -->
      <h3 style="margin-top: 0; margin-bottom: 16px;">租赁设备管理</h3>
      <div class="filter-tabs" style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="/staff/rentals/tracking" class="button ${!status ? 'button-primary' : 'button-secondary'}">全部订单</a>
        <a href="/staff/rentals/tracking?status=pending_pickup" class="button ${status === 'pending_pickup' ? 'button-primary' : 'button-secondary'}">待拿取</a>
        <a href="/staff/rentals/tracking?status=pending_return" class="button ${status === 'pending_return' ? 'button-primary' : 'button-secondary'}">待归还</a>
        <a href="/staff/rentals/tracking?status=expiring" class="button ${status === 'expiring' ? 'button-primary' : 'button-secondary'}">即将到期</a>
        <a href="/staff/rentals/tracking?status=completed" class="button ${status === 'completed' ? 'button-primary' : 'button-secondary'}">已完成</a>
      </div>
      
      <!-- 搜索功能 -->
      <div class="search-bar" style="margin-bottom: 24px;">
        <form action="/staff/rentals/tracking" method="GET" style="display: flex; gap: 10px;">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索合同编号、订单编号、客户姓名/邮箱/电话..." value="${searchTerm || ''}" style="flex-grow: 1;" />
          ${status ? `<input type="hidden" name="status" value="${status}" />` : ''}
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>

      ${
        finalOrders.length > 0
          ? `
        <table class="table">
          <thead>
            <tr>
              <th>合同编号</th>
              <th>订单编号</th>
              <th>客户</th>
              <th>状态</th>
              <th>租赁日期</th>
              <th>归还日期</th>
              <th>租赁天数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${finalOrders
              .map((order: any) => {
                const contract = allContracts.find((ct: any) => ct.rentalId === order.id || ct.rental_id === order.id)
                const hasSignedContract = contract?.status === 'signed'
                const statusText = order.status === 'pending_pickup' ? '待拿取' : 
                                  order.status === 'pending_return' ? '待归还' : 
                                  order.status === 'active' ? '当前租赁中' : 
                                  order.status === 'completed' ? '已完成' : 
                                  order.status === 'cancelled' ? '已取消' : 
                                  order.status;
                const rentalDays = order.startDate && order.endDate ? Math.max(1, Math.ceil((new Date(order.endDate).getTime() - new Date(order.startDate).getTime()) / (1000 * 60 * 60 * 24))) : '-'
                const actionButton = (() => {
                  // 合同已签署
                  if (hasSignedContract) {
                    // 订单状态为待拿取
                    if (order.status === 'pending_pickup') {
                      return `<button class="button button-sm button-primary" onclick="fetch('/staff/orders/${order.id}/pickup', { method: 'POST' }).then(() => window.location.reload())">已拿取</button>`;
                    }
                    // 订单状态为待归还
                    if (order.status === 'pending_return') {
                      return `<a class="button button-sm button-info" href="/staff/orders/${order.id}/inspection">归还验机</a>`;
                    }
                    // 订单状态为已完成
                    if (order.status === 'completed') {
                      return `<button class="button button-sm button-warning" onclick="const amount = prompt('请输入退还押金金额', '${(order.depositAmount || 0).toFixed(2)}'); if (amount !== null) { const reason = prompt('请输入扣除原因（选填）', ''); window.location.href='/staff/orders/${order.id}/refund?amount=' + encodeURIComponent(amount) + '&reason=' + encodeURIComponent(reason || '') }">退还押金</button>`;
                    }
                    // 其他已签署状态，例如刚签署完成，但订单状态还未更新为pending_pickup
                    return `<a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看订单</a>`;
                   }
                   // 合同未签署或已取消等情况
                   return `<a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看订单</a>`;
                 })();
                return `
                <tr>
                  <td>${contract?.contractNumber ?? '—'}</td>
                  <td>${order.orderNo}</td>
                  <td>${order.customer?.name ?? '待客户填写'}</td>
                  <td>${statusText}</td>
                  <td>${order.startDate ?? '—'}</td>
                  <td>${order.endDate ?? '—'}</td>
                  <td>${rentalDays}</td>
                  <td>${actionButton}</td>
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

  return buildLayout('当前租赁中 - 电脑租赁管理系统', body, user)
}
