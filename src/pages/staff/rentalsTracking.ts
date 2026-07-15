import { buildLayout, getAllRentals, getUserById, getDeviceById } from '../../site'
import type { Context } from 'hono'

export async function renderStaffRentalsTracking(c: Context, user: any) {
  const allRentals = await getAllRentals()

  const rentalsWithDetails = await Promise.all(
    allRentals.map(async (rental: any) => {
      const customer = await getUserById(c, rental.userId)
      const device = await getDeviceById(c, rental.deviceId)
      return { ...rental, customer, device }
    })
  )

  const body = `
    <div class="panel">
      <div class="section-title"><h2>租赁进度管理</h2><span class="section-note">追踪租赁中订单，处理到期提醒和归还。</span></div>

      <h3>当前租赁中</h3>
      ${
        rentalsWithDetails.filter((r: any) => r.status === 'active').length > 0
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
            ${rentalsWithDetails
              .filter((r: any) => r.status === 'active')
              .map((rental: any) => {
                return `
                <tr>
                  <td>${rental.orderNo}</td>
                  <td>${rental.customer?.name ?? '未知客户'}</td>
                  <td>${rental.device?.name ?? '未知设备'}</td>
                  <td>${rental.startDate} 至 ${rental.endDate}</td>
                  <td>${rental.status}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/staff/rentals/${rental.id}/remind">到期提醒</a>
                    <a class="button button-sm button-primary" href="/staff/rentals/${rental.id}/return-check">归还验收</a>
                    <a class="button button-sm button-danger" href="/staff/rentals/${rental.id}/overdue">逾期处理</a>
                  </td>
                </tr>
              `
              })
              .join('')}
          </tbody>
        </table>
      `
          : '<p>目前没有正在租赁的设备。</p>'
      }

      <h3 style="margin-top: 40px;">已完成/已取消租赁</h3>
      ${
        rentalsWithDetails.filter((r: any) => r.status !== 'active').length > 0
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
            ${rentalsWithDetails
              .filter((r: any) => r.status !== 'active')
              .map((rental: any) => {
                return `
                <tr>
                  <td>${rental.orderNo}</td>
                  <td>${rental.customer?.name ?? '未知客户'}</td>
                  <td>${rental.device?.name ?? '未知设备'}</td>
                  <td>${rental.startDate} 至 ${rental.endDate}</td>
                  <td>${rental.status}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/staff/orders/${rental.id}">查看详情</a>
                  </td>
                </tr>
              `
              })
              .join('')}
          </tbody>
        </table>
      `
          : '<p>没有历史租赁记录。</p>'
      }
    </div>
  `

  return buildLayout('租赁进度管理 - 电脑租赁管理系统', body, user)
}
