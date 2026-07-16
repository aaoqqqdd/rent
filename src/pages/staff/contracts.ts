import { buildLayout, getAllContracts, getOrderById, getUserById, getOrders, getDeviceById, getUsers } from '../../site'
import type { Context } from 'hono'

export async function renderStaffContracts(c: Context, user: any, status?: string, successMessage?: string, errorMessage?: string, searchTerm?: string) {
  // 获取所有合同和订单数据，融合合同管理和租赁进度管理
  let allContracts = await getAllContracts(c)
  const allOrders = await getOrders(c)
  const allUsers = await getUsers(c) // 获取所有用户用于搜索

  // 根据状态筛选合同
  if (status) {
    // 如果是合同状态（pending_sign/signed/completed/cancelled），只筛选合同
    if (status === 'pending_sign' || status === 'signed' || status === 'completed' || status === 'cancelled') {
      allContracts = allContracts.filter((ct) => ct.status === status)
    } else {
      // 如果是租赁状态（active），合同部分不显示，只筛选租赁订单
      allContracts = []
    }
  }

  // 如果有搜索关键词，过滤合同
  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim()
    allContracts = allContracts.filter(contract => {
      // 检查合同编号
      if (contract.contractNumber?.toLowerCase().includes(searchLower)) return true
      
      // 关联订单，检查订单编号
      const order = allOrders.find(o => o.id === contract.rentalId)
      if (order?.orderNo?.toLowerCase().includes(searchLower)) return true
      
      // 关联用户，检查姓名、邮箱、电话
      const customer = order ? allUsers.find(u => u.id === order.userId) : null
      if (customer?.name?.toLowerCase().includes(searchLower)) return true
      if (customer?.email?.toLowerCase().includes(searchLower)) return true
      if (customer?.phone?.toLowerCase().includes(searchLower)) return true
      
      return false
    })
  }

  // 处理合同详情
  const contractsWithDetails = await Promise.all(
    allContracts.map(async (contract) => {
      const order = await getOrderById(c, contract.rentalId)
      const customer = order ? await getUserById(c, order.userId) : null
      return { contract, order, customer }
    })
  )

  // 处理租赁订单详情（用于租赁进度部分）
  let filteredOrders = allOrders
  if (status && ['active', 'completed', 'cancelled'].includes(status)) {
    filteredOrders = allOrders.filter((r: any) => r.status === status)
  }
  const ordersWithDetails = await Promise.all(
    filteredOrders.map(async (order: any) => {
      const customer = await getUserById(c, order.userId)
      const device = await getDeviceById(c, order.deviceId)
      return { ...order, customer, device }
    })
  )

  // 根据筛选状态显示对应的租赁部分
  let activeRentals = []
  let completedRentals = []
  let cancelledRentals = []
  let otherHistoricalRentals = []
  
  if (status === 'active') {
    activeRentals = ordersWithDetails
  } else if (status === 'completed') {
    completedRentals = ordersWithDetails
  } else if (status === 'cancelled') {
    cancelledRentals = ordersWithDetails
  } else {
    // 无状态筛选时显示所有分类
    activeRentals = ordersWithDetails.filter((r: any) => r.status === 'active')
    completedRentals = ordersWithDetails.filter((r: any) => r.status === 'completed')
    cancelledRentals = ordersWithDetails.filter((r: any) => r.status === 'cancelled')
    otherHistoricalRentals = ordersWithDetails.filter((r: any) => r.status !== 'active' && r.status !== 'completed' && r.status !== 'cancelled')
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同与租赁进度管理</h2><span class="section-note">统一管理所有租赁合同的签署状态和租赁进度。</span></div>

      ${successMessage ? `<div class="alert alert-success">${successMessage}</div>` : ''}
      ${errorMessage ? `<div class="alert alert-danger">${errorMessage}</div>` : ''}

      <!-- 统一的筛选按钮 - 包含合同和租赁状态 -->
      <h3 style="margin-top: 0; margin-bottom: 16px;">合同与租赁管理</h3>
      <div class="filter-tabs" style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="/staff/contracts" class="button ${!status ? 'button-primary' : 'button-secondary'}">全部合同</a>
        <a href="/staff/contracts?status=pending_sign" class="button ${status === 'pending_sign' ? 'button-primary' : 'button-secondary'}">待签署</a>
        <a href="/staff/contracts?status=signed" class="button ${status === 'signed' ? 'button-primary' : 'button-secondary'}">已签署</a>
        <a href="/staff/contracts?status=cancelled" class="button ${status === 'cancelled' ? 'button-primary' : 'button-secondary'}">已取消</a>
        <a href="/staff/contracts?status=completed" class="button ${status === 'completed' ? 'button-primary' : 'button-secondary'}">已完成</a>
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
                const canCancel = user && (user.role === 'ADMIN' || contract.created_by === user.id || contract.createdBy === user.id)
                return `
                <tr>
                  <td>${contract.contractNumber}</td>
                  <td>${order?.orderNo ?? 'N/A'}</td>
                  <td>${customer?.name ?? '未知客户'}</td>
                  <td>${contract.status}</td>
                  <td>${contract.signedAt ?? '未签署'}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/staff/contract/view/${contract.id}">查看合同</a>
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

      <!-- 租赁进度管理部分 -->
      <h3 style="margin-top: 48px; margin-bottom: 16px;">当前租赁中</h3>
      ${
        activeRentals.length > 0
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
            ${activeRentals
              .map((order: any) => {
                return `
                <tr>
                  <td>${order.orderNo}</td>
                  <td>${order.customer?.name ?? '待客户填写'}</td>
                  <td>${order.device?.name ?? '未知设备'}</td>
                  <td>${order.startDate} 至 ${order.endDate}</td>
                  <td>${order.status}</td>
                  <td>
                    <a class="button button-sm button-secondary" href="/staff/orders/${order.id}">查看详情</a>
                    <a class="button button-sm button-primary" href="/staff/orders/${order.id}/return-check">归还验收</a>
                    <a class="button button-sm button-danger" href="/staff/orders/${order.id}/overdue">逾期处理</a>
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


    </div>
  `

  return buildLayout('合同与租赁进度管理 - 电脑租赁管理系统', body, user)
}