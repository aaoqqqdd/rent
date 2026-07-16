import { buildLayout, getAllContracts, getOrderById, getUserById, getOrders, getDeviceById, getUsers } from '../../site'
import type { Context } from 'hono'

export async function renderStaffContracts(c: Context, user: any, status?: string, successMessage?: string, errorMessage?: string, searchTerm?: string) {
  let allContracts = await getAllContracts(c)
  const allOrders = await getOrders(c)
  const allUsers = await getUsers(c)

  const contractStatuses = ['pending_sign', 'signed', 'cancelled', 'completed']
  const rentalStatuses = ['active', 'pending_pickup', 'pending_return', 'completed', 'cancelled']

  if (status && contractStatuses.includes(status)) {
    allContracts = allContracts.filter((ct) => ct.status === status)
  }

  let filteredOrders = allOrders
  if (status && rentalStatuses.includes(status)) {
    filteredOrders = allOrders.filter((r: any) => r.status === status)
  } else if (!status) {
    filteredOrders = allOrders.filter((r: any) => ['active', 'pending_pickup', 'pending_return'].includes(r.status))
  }

  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim()
    allContracts = allContracts.filter((contract) => {
      if (contract.contractNumber?.toLowerCase().includes(searchLower)) return true
      const order = allOrders.find((o) => o.id === contract.rentalId)
      if (order?.orderNo?.toLowerCase().includes(searchLower)) return true
      const customer = order ? allUsers.find((u) => u.id === order.userId) : null
      if (customer?.name?.toLowerCase().includes(searchLower)) return true
      if (customer?.email?.toLowerCase().includes(searchLower)) return true
      if (customer?.phone?.toLowerCase().includes(searchLower)) return true
      return false
    })

    filteredOrders = filteredOrders.filter((order: any) => {
      const customer = allUsers.find((u) => u.id === order.userId)
      const device = order.deviceId ? allOrders.find((o) => o.id === order.deviceId) : null
      return [order.orderNo, order.id, customer?.name, customer?.email, device?.deviceName, order.startDate, order.endDate]
        .filter(Boolean)
        .some((value: any) => String(value).toLowerCase().includes(searchLower))
    })
  }

  const contractsWithDetails = await Promise.all(
    allContracts.map(async (contract) => {
      const order = await getOrderById(c, contract.rentalId)
      const customer = order ? await getUserById(c, order.userId) : null
      return { contract, order, customer }
    })
  )

  const ordersWithDetails = await Promise.all(
    filteredOrders.map(async (order: any) => {
      const customer = await getUserById(c, order.userId)
      const device = await getDeviceById(c, order.deviceId)
      return { ...order, customer, device }
    })
  )

  const activeRentals = ordersWithDetails

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同与租赁进度管理</h2><span class="section-note">统一管理所有租赁合同的签署状态和租赁进度。</span></div>

      ${successMessage ? `<div class="alert alert-success">${successMessage}</div>` : ''}
      ${errorMessage ? `<div class="alert alert-danger">${errorMessage}</div>` : ''}

      <!-- 统一的筛选按钮 - 包含合同和租赁状态 -->
      <h3 style="margin-top: 0; margin-bottom: 16px;">合同管理</h3>
      <div class="filter-tabs" style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="/staff/contracts" class="button ${!status ? 'button-primary' : 'button-secondary'}">全部合同</a>
        <a href="/staff/contracts?status=pending_sign" class="button ${status === 'pending_sign' ? 'button-primary' : 'button-secondary'}">待签署</a>
        <a href="/staff/contracts?status=signed" class="button ${status === 'signed' ? 'button-primary' : 'button-secondary'}">已签署</a>
        <a href="/staff/contracts?status=cancelled" class="button ${status === 'cancelled' ? 'button-primary' : 'button-secondary'}">已取消</a>
        <a href="/staff/contracts?status=completed" class="button ${status === 'completed' ? 'button-primary' : 'button-secondary'}">已完成</a>
        <a href="/staff/contracts?status=active" class="button ${status === 'active' ? 'button-primary' : 'button-secondary'}">当前租赁中</a>
        <a href="/staff/contracts?status=pending_pickup" class="button ${status === 'pending_pickup' ? 'button-primary' : 'button-secondary'}">待拿取</a>
        <a href="/staff/contracts?status=pending_return" class="button ${status === 'pending_return' ? 'button-primary' : 'button-secondary'}">待归还</a>
      </div>
      
      <!-- 搜索功能 -->
      <div class="search-bar" style="margin-bottom: 24px;">
        <form action="/staff/contracts" method="GET" style="display: flex; gap: 10px;">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索合同编号、订单编号、客户姓名/邮箱/电话..." value="${searchTerm || ''}" style="flex-grow: 1;" />
          ${status ? `<input type="hidden" name="status" value="${status}" />` : ''}
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>

      ${
        contractsWithDetails.length > 0
          ? `
        <table class="table">
          <thead>
            <tr>
              <th>合同编号</th>
              <th>订单编号</th>
              <th>客户</th>
              <th>状态</th>
              <th>签署日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${contractsWithDetails
              .map(({ contract, order, customer }) => {
                const canCancel = user && (user.role === 'ADMIN' || contract.created_by === user.id || contract.createdBy === user.id || contract.status === 'pending_sign');
                const statusLabel = contract.status === 'pending_sign' ? '待签署' : contract.status === 'signed' ? '已签署' : contract.status === 'cancelled' ? '已取消' : contract.status === 'draft' ? '草稿' : contract.status
                const signedAtText = contract.signedAt ? contract.signedAt : (contract.status === 'cancelled' ? '已取消' : '未签署')
                return `
                <tr>
                  <td>${contract.contractNumber}</td>
                  <td>${order?.orderNo ?? 'N/A'}</td>
                  <td>${customer?.name ?? '未知客户'}</td>
                  <td>${statusLabel}</td>
                  <td>${signedAtText}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/contract/view/${contract.id}">查看合同</a>
                    ${
                      contract.status === 'pending_sign'
                        ? `
                          <a class="button button-sm button-primary" href="/staff/contract/${contract.id}/remind">提醒签署</a>
                          <button class="button button-sm button-success" onclick="navigator.clipboard.writeText(window.location.origin + '/contract/sign?number=${contract.contractNumber}&step=1').then(()=>alert('合同签署链接已复制到剪贴板！'))">复制签署链接</button>
                          ${canCancel ? `<form action="/staff/contract/${contract.id}/cancel" method="post" style="display:inline;"><button type="submit" class="button button-sm button-danger" onclick="return confirm('确定要取消这份合同吗？');">取消</button></form>` : ''}
                        `
                        : ''
                    }
                    ${order?.status === 'active' ? `<a class="button button-sm button-info" href="/staff/orders/${contract.rentalId}">租赁详情</a>` : ''}
                  </td>
                </tr>
              `
              })
              .join('')}
          </tbody>
        </table>
      `
          : '<p>没有找到符合条件的合同记录。</p>'
      }

      <h3 style="margin-top: 48px; margin-bottom: 16px;">租赁管理</h3>
      ${
        activeRentals.length > 0
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
            ${activeRentals
              .map((order: any) => {
                const contract = allContracts.find((ct: any) => ct.rentalId === order.id || ct.rental_id === order.id)
                const hasSignedContract = contract?.status === 'signed'
                const statusText = order.status === 'pending_pickup' ? '待拿取' : order.status === 'pending_return' ? '待归还' : order.status === 'active' ? '当前租赁中' : order.status === 'completed' ? '已完成' : order.status === 'cancelled' ? '已取消' : order.status
                const rentalDays = order.startDate && order.endDate ? Math.max(1, Math.ceil((new Date(order.endDate).getTime() - new Date(order.startDate).getTime()) / (1000 * 60 * 60 * 24))) : '-'
                const actionButton = hasSignedContract
                  ? `<a class="button button-sm button-primary" href="/staff/orders/${order.id}">待拿取</a>`
                  : order.status === 'active' || order.status === 'pending_return'
                    ? `<button class="button button-sm button-warning" onclick="const amount = prompt('请输入退还押金金额', '${(order.depositAmount || 0).toFixed(2)}'); if (amount !== null) { const reason = prompt('请输入扣除原因（选填）', ''); window.location.href='/staff/orders/${order.id}/refund?amount=' + encodeURIComponent(amount) + '&reason=' + encodeURIComponent(reason || '') }">退还押金</button>`
                    : `<a class="button button-sm button-secondary" href="/staff/orders/${order.id}">待归还</a>`
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

  return buildLayout('合同与租赁进度管理 - 电脑租赁管理系统', body, user)
}