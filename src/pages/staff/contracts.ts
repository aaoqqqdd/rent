/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getAllContracts, getOrders, getUsers, getDevices, isContractExpired, isContractFinalized, sanitizePlainText } from '../../site'
import type { Context } from 'hono'

export async function renderStaffContracts(c: Context, user: any, status?: string, successMessage?: string, errorMessage?: string, searchTerm?: string, staffId?: string) {
  const isAdmin = user.role === 'ADMIN'
  const basePath = isAdmin ? '/admin/contracts' : '/staff/contracts'
  let [allContracts, allOrders, allUsers, allDevices] = await Promise.all([getAllContracts(c), getOrders(c), getUsers(c), getDevices(c)])
  const ordersById = new Map(allOrders.map(order => [order.id, order]))
  const usersById = new Map(allUsers.map(account => [account.id, account]))
  const devicesById = new Map(allDevices.map(device => [device.id, device]))
  const staffAccounts = allUsers.filter(account => account.role === 'STAFF' && (!account.status || account.status === 'active') && (account.accountStatus ?? account.account_status ?? 'active') === 'active')
  const selectedStaffId = isAdmin && staffAccounts.some(account => account.id === staffId) ? staffId : undefined
  const ownerOnlyQuery = selectedStaffId ? `?staffId=${encodeURIComponent(selectedStaffId)}` : ''
  const ownerQuery = selectedStaffId ? `&staffId=${encodeURIComponent(selectedStaffId)}` : ''
  if (user.role !== 'ADMIN') allContracts = allContracts.filter(contract => (contract.createdBy || contract.created_by) === user.id)
  if (selectedStaffId) allContracts = allContracts.filter(contract => (contract.createdBy || contract.created_by) === selectedStaffId)
  const visibleOrderIds = new Set(allContracts.map(contract => contract.rentalId))
  const visibleOrders = user.role === 'ADMIN' && !selectedStaffId ? allOrders : allOrders.filter(order => visibleOrderIds.has(order.id))
  const escapeAttribute = (value: unknown) => sanitizePlainText(value, 200).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const contractStatuses = ['pending_sign', 'signed', 'cancelled', 'completed', 'expired']
  const rentalStatuses = ['draft', 'pending_approval', 'approved', 'pending_payment', 'paid', 'active', 'pending_pickup', 'pending_return', 'completed', 'cancelled']

  if (status && contractStatuses.includes(status)) {
    allContracts = allContracts.filter((ct) => status === 'expired' ? isContractExpired(ct) : ct.status === status && !isContractExpired(ct))
  }

  let filteredOrders = visibleOrders
  if (status && rentalStatuses.includes(status)) {
    filteredOrders = visibleOrders.filter((r: any) => r.status === status)
  } else if (!status) {
    filteredOrders = visibleOrders.filter((r: any) => !['cancelled'].includes(r.status))
  }

  if (searchTerm && searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim()
    allContracts = allContracts.filter((contract) => {
      if (contract.contractNumber?.toLowerCase().includes(searchLower)) return true
      const order = ordersById.get(contract.rentalId)
      if (order?.orderNo?.toLowerCase().includes(searchLower)) return true
      const customer = order ? usersById.get(order.userId) : null
      if (customer?.name?.toLowerCase().includes(searchLower)) return true
      if (customer?.email?.toLowerCase().includes(searchLower)) return true
      if (customer?.phone?.toLowerCase().includes(searchLower)) return true
      return false
    })

    filteredOrders = filteredOrders.filter((order: any) => {
      const customer = usersById.get(order.userId)
      const device = order.deviceId ? devicesById.get(order.deviceId) : null
      return [order.orderNo, order.id, customer?.name, customer?.email, device?.name, order.startDate, order.endDate]
        .filter(Boolean)
        .some((value: any) => String(value).toLowerCase().includes(searchLower))
    })
  }

  const contractsWithDetails = allContracts.map(contract => {
    const order = ordersById.get(contract.rentalId)
    return { contract, order, customer: order ? usersById.get(order.userId) : null }
  })

  const ordersWithDetails = filteredOrders.map((order: any) => ({
    ...order,
    customer: usersById.get(order.userId),
    device: devicesById.get(order.deviceId),
  }))

  const activeRentals = ordersWithDetails

  const body = `
    <div class="panel">
      <div class="section-title"><div><h2>合同与租赁进度管理</h2><span class="section-note">${isAdmin ? '查看全部员工创建的合同、签署状态和租赁进度。' : '管理自己负责的租赁合同、签署状态和租赁进度。'}</span></div><div class="record-actions"><a class="button" href="/staff/contracts/new">新建合同</a>${isAdmin ? '<a class="button button-secondary" href="/admin/templates">协议与模板</a><a class="button button-secondary" href="/admin/calendar">租赁日历</a>' : ''}</div></div>

      ${successMessage ? `<div class="page-notification page-notification--success">${successMessage}</div>` : ''}
      ${errorMessage ? `<div class="page-notification page-notification--error">${errorMessage}</div>` : ''}

      ${isAdmin ? `<form class="contract-owner-filter" action="${basePath}" method="get"><div class="form-group"><label class="form-label" for="contract-staff-filter">负责员工</label><select class="form-control" id="contract-staff-filter" name="staffId" onchange="this.form.submit()"><option value="">全部现有员工</option>${staffAccounts.map(account => `<option value="${escapeAttribute(account.id)}" ${selectedStaffId === account.id ? 'selected' : ''}>${escapeAttribute(account.name || account.email || account.id)}</option>`).join('')}</select><small class="form-text">员工账户请前往用户管理创建或停用。</small></div>${status ? `<input type="hidden" name="status" value="${escapeAttribute(status)}">` : ''}${searchTerm ? `<input type="hidden" name="searchTerm" value="${escapeAttribute(searchTerm)}">` : ''}</form>` : ''}

      <!-- 统一的筛选按钮 - 包含合同和租赁状态 -->
      <div class="subsection-heading"><div><p class="section-code">CONTRACTS</p><h3>合同管理</h3></div></div>
      <div class="filter-tabs">
        <a href="${basePath}${ownerOnlyQuery}" class="button ${!status ? 'button-primary' : 'button-secondary'}">全部合同</a>
        <a href="${basePath}?status=pending_sign${ownerQuery}" class="button ${status === 'pending_sign' ? 'button-primary' : 'button-secondary'}">待签署</a>
        <a href="${basePath}?status=signed${ownerQuery}" class="button ${status === 'signed' ? 'button-primary' : 'button-secondary'}">已签署</a>
        <a href="${basePath}?status=expired${ownerQuery}" class="button ${status === 'expired' ? 'button-primary' : 'button-secondary'}">已过期</a>
        <a href="${basePath}?status=cancelled${ownerQuery}" class="button ${status === 'cancelled' ? 'button-primary' : 'button-secondary'}">已取消</a>
        <a href="${basePath}?status=completed${ownerQuery}" class="button ${status === 'completed' ? 'button-primary' : 'button-secondary'}">已完成</a>
      </div>
      
      <!-- 搜索功能 -->
      <div class="search-bar">
        <form action="${basePath}" method="GET" class="search-form">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索合同编号、订单编号、客户姓名/邮箱/电话..." value="${searchTerm || ''}" />
          ${status ? `<input type="hidden" name="status" value="${status}" />` : ''}
          ${selectedStaffId ? `<input type="hidden" name="staffId" value="${escapeAttribute(selectedStaffId)}" />` : ''}
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>

      ${contractsWithDetails.length > 0
      ? `
        <table class="table">
          <thead>
            <tr>
              <th>合同编号</th>
              <th>订单编号</th>
              <th>客户</th>
              ${user.role === 'ADMIN' ? '<th>负责员工</th>' : ''}
              <th>状态</th>
              <th>签署日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${contractsWithDetails
        .map(({ contract, order, customer }) => {
          const expired = isContractExpired(contract)
          const canCancel = user && !expired && (user.role === 'ADMIN' || contract.created_by === user.id || contract.createdBy === user.id || contract.status === 'pending_sign');
          const statusLabel = expired ? '已过期' : contract.status === 'pending_sign' ? '待签署' : contract.status === 'signed' ? '已签署' : contract.status === 'cancelled' ? '已取消' : contract.status === 'draft' ? '草稿' : contract.status
          const statusClass = expired ? 'badge-danger' : contract.status === 'signed' ? 'badge-success' : contract.status === 'cancelled' ? 'badge-neutral' : 'badge-warning'
          const signedAtText = contract.signedAt ? contract.signedAt : (expired ? '签署期限已过' : contract.status === 'cancelled' ? '已取消' : '未签署')
          const showSigningProgress = contract.status === 'pending_sign' && !expired
          const canEditData = !expired && !['signed', 'completed', 'cancelled'].includes(contract.status)
          const canViewContract = isContractFinalized(contract)
          return `
                <tr>
                  <td>${contract.contractNumber}</td>
                  <td>${order?.orderNo ?? '付款后生成'}</td>
                  <td>${customer?.name ?? '未知客户'}${customer?.accountType === 'guest' ? ' <span class="badge badge-warning">访客/临时账户</span>' : ''}</td>
                  ${user.role === 'ADMIN' ? `<td>${usersById.get(contract.createdBy || contract.created_by || '')?.name || '未知'}</td>` : ''}
                  <td><span class="badge ${statusClass}">${statusLabel}</span>${showSigningProgress ? '<div class="inline-signing-progress"><span aria-hidden="true"></span><strong>等待客户签署</strong></div>' : ''}</td>
                  <td>${signedAtText}</td>
                  <td><div class="table-actions">
                    ${canViewContract ? `<a class="button button-sm button-secondary" href="/staff/orders/${contract.rentalId}" data-contract-url="/contract/view/${contract.id}">查看合同</a>` : ''}
                    ${canEditData ? `<a class="button button-sm button-secondary" href="${isAdmin ? `/admin/contracts/${contract.id}/data` : `/staff/contracts/${contract.id}/data`}">编辑资料</a>` : contract.status === 'signed' ? '<span class="section-note">电子签约记录已锁定</span>' : ''}
                    ${contract.status === 'pending_sign' && !expired
              ? `
                          <button type="button" class="button button-sm button-secondary contract-list-action copy-sign-link" data-sign-token="${contract.signToken}">复制链接</button>
                          ${canCancel ? `<form action="/staff/contract/${contract.id}/cancel" method="post" class="inline-form"><button type="submit" class="button button-sm contract-list-action contract-cancel-action" onclick="return confirm('确定取消合同 ${contract.contractNumber} 吗？取消后客户将无法继续签署。');">取消合同</button></form>` : ''}
                        `
              : ''
            }
                    ${order?.status === 'active' ? `<a class="button button-sm button-info" href="${isAdmin ? `/admin/orders/${contract.rentalId}` : `/staff/orders/${contract.rentalId}`}">租赁详情</a>` : ''}
                  </div></td>
                </tr>
              `
        })
        .join('')}
          </tbody>
        </table>
      `
      : '<div class="empty-state"><span class="empty-state-code mono">NO CONTRACTS</span><h3>没有符合条件的合同</h3><p>调整筛选条件或创建新的租赁合同。</p></div>'
    }

      <div class="subsection-heading subsection-heading-spaced"><div><p class="section-code">RENTALS</p><h3>租赁管理</h3></div></div>

      <div class="filter-tabs">
        <a href="${basePath}${ownerOnlyQuery}" class="button ${!status ? 'button-primary' : 'button-secondary'}">全部租赁</a>
        <a href="${basePath}?status=active${ownerQuery}" class="button ${status === 'active' ? 'button-primary' : 'button-secondary'}">当前租赁中</a>
        <a href="${basePath}?status=pending_pickup${ownerQuery}" class="button ${status === 'pending_pickup' ? 'button-primary' : 'button-secondary'}">待拿取</a>
        <a href="${basePath}?status=pending_return${ownerQuery}" class="button ${status === 'pending_return' ? 'button-primary' : 'button-secondary'}">待归还</a>
        <a href="${basePath}?status=completed${ownerQuery}" class="button ${status === 'completed' ? 'button-primary' : 'button-secondary'}">已完成</a>
      </div>
      
      <!-- 搜索功能 -->
      <div class="search-bar">
        <form action="${basePath}" method="GET" class="search-form">
          <input type="text" name="searchTerm" class="form-control" placeholder="搜索合同编号、订单编号、客户姓名/邮箱/电话..." value="${searchTerm || ''}" />
          ${status ? `<input type="hidden" name="status" value="${status}" />` : ''}
          ${selectedStaffId ? `<input type="hidden" name="staffId" value="${escapeAttribute(selectedStaffId)}" />` : ''}
          <button type="submit" class="button button-primary">搜索</button>
        </form>
      </div>

      ${activeRentals.length > 0
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
          const statusText: Record<string, string> = { draft: '草稿', pending_approval: '待审核', approved: '待付款', pending_payment: '待付款', paid: '已付款', active: '当前租赁中', pending_pickup: '待拿取', pending_return: '待归还', completed: '已完成', cancelled: '已取消' }
          const rentalDays = order.startDate && order.endDate ? Math.max(1, Math.ceil((new Date(order.endDate).getTime() - new Date(order.startDate).getTime()) / (1000 * 60 * 60 * 24))) : '-'
          const actionButton = hasSignedContract
            ? `<a class="button button-sm button-primary" href="${isAdmin ? `/admin/orders/${order.id}` : `/staff/orders/${order.id}`}">${order.status === 'pending_pickup' ? '待拿取' : order.status === 'pending_return' ? '待归还' : '查看租赁'}</a>`
            : order.status === 'active' || order.status === 'pending_return'
              ? `<a class="button button-sm button-info" href="/staff/orders/${order.id}/inspection">归还验机</a>`
              : `<a class="button button-sm button-secondary" href="${isAdmin ? `/admin/orders/${order.id}` : `/staff/orders/${order.id}`}">待归还</a>`
          return `
                <tr>
                  <td>${contract?.contractNumber ?? '—'}</td>
                  <td>${order.orderNo || '付款后生成'}</td>
                  <td>${order.customer?.name ?? '待客户填写'}</td>
                  <td>${statusText[order.status] ?? order.status ?? '未知状态'}</td>
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
      : '<div class="empty-state"><span class="empty-state-code mono">NO RENTALS</span><h3>没有符合条件的租赁记录</h3><p>更换状态筛选后再试。</p></div>'
    }


    </div>
    <div id="action-toast" class="action-toast" role="status" aria-live="polite" hidden></div>
    <script>
      (() => {
        const toast = document.getElementById('action-toast');
        const showToast = (message, failed = false) => {
          toast.textContent = message;
          toast.dataset.state = failed ? 'error' : 'success';
          toast.hidden = false;
          window.setTimeout(() => { toast.hidden = true; }, 2600);
        };
        document.querySelectorAll('.copy-sign-link').forEach((button) => {
          button.addEventListener('click', async () => {
            const link = window.location.origin + '/contract/sign?token=' + encodeURIComponent(button.dataset.signToken) + '&step=1';
            try {
              if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
              else { const field = document.createElement('textarea'); field.value = link; document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove(); }
              const original = button.textContent;
              button.textContent = '已复制';
              window.setTimeout(() => { button.textContent = original; }, 1800);
              showToast('签署链接已复制');
            } catch { showToast('复制失败，请进入签署进度页面手工复制', true); }
          });
        });
      })();
    </script>
  `

  return buildLayout('合同与租赁进度管理 - 电脑租赁管理系统', body, user)
}
