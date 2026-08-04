import { buildLayout, getOrderById, getUserById, getDeviceById, formatCurrency, getContractByOrderId, systemSettings } from '../../site'
import type { Context } from 'hono'

export async function renderStaffOrderDetail(c: Context, user: any, orderId: string, message?: string, type: 'success' | 'error' = 'error') {
  const order = await getOrderById(c, orderId)
  if (!order) {
    return buildLayout('订单详情 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>您请求的订单不存在。</p></div>', user)
  }
  const customer = await getUserById(c, order.userId)
  const device = await getDeviceById(c, order.deviceId)
  const contract = await getContractByOrderId(c, order.id)
  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : ''

  const body = `
    <div class="panel">
      <div class="section-title"><h2>订单详情 #${order.orderNo}</h2><span class="section-note">管理订单状态、设备分配、合同签署及支付。</span></div>
      ${alertMessage}
      <div class="grid grid-2">
        <div>
          <h3>订单信息</h3>
          <p><strong>订单状态:</strong> ${order.status}</p>
          <p><strong>下单时间:</strong> ${order.orderDate}</p>
          <p><strong>租期:</strong> ${order.startDate} 至 ${order.endDate}</p>
          <p><strong>总金额:</strong> ${formatCurrency(order.totalAmount)}</p>
          <p><strong>押金:</strong> ${formatCurrency(order.depositAmount)}</p>
          <p><strong>租金:</strong> ${formatCurrency(order.totalAmount - order.depositAmount)}</p>
          <p><strong>客户:</strong> ${customer?.name ?? '未知'} (${customer?.email ?? ''})</p>
          <p><strong>设备:</strong> ${device?.name ?? '未知'} (${device?.serialNumber ?? ''})</p>
        </div>
        <div>
          <h3>操作</h3>
          ${order.status === 'pending_approval' ? `
            <form method="POST" action="/staff/orders/${order.id}/approve" style="margin-bottom: 10px;">
              <button class="button button-primary" type="submit">批准订单</button>
            </form>
            <form method="POST" action="/staff/orders/${order.id}/reject">
              <button class="button button-danger" type="submit">拒绝订单</button>
            </form>
          ` : ''}
          ${order.status === 'approved' && !contract ? `
            <form method="POST" action="/staff/orders/${order.id}/generate-contract">
              <button class="button button-primary" type="submit">生成合同</button>
            </form>
          ` : ''}
          ${contract && contract.status === 'pending_sign' ? `
            <form method="POST" action="/staff/orders/${order.id}/remind-sign">
              <button class="button" type="submit">提醒客户签署合同</button>
            </form>
          ` : ''}
          ${order.status === 'pending_payment' ? `
            <form method="POST" action="/staff/orders/${order.id}/mark-paid">
              <button class="button button-primary" type="submit">标记为已支付</button>
            </form>
          ` : ''}
          ${order.status === 'active' ? `
            <form method="POST" action="/staff/orders/${order.id}/complete">
              <button class="button button-success" type="submit">标记为已完成</button>
            </form>
          ` : ''}
          ${order.status === 'active' || order.status === 'paid' ? `
            <form method="POST" action="/staff/orders/${order.id}/cancel">
              <button class="button button-danger" type="submit">取消订单</button>
            </form>
          ` : ''}
        </div>
      </div>

      ${contract ? `
        <div class="section-title" style="margin-top: 24px;"><h3>租赁合同</h3></div>
        <div class="contract-actions" style="margin-bottom: 16px; display: flex; gap: 12px;">
          <a class="button" href="/contract/view/${contract.id}" target="_blank">查看合同</a>
          ${contract.status === 'signed' ? `<span class="tag tag-success">已签署</span>` : `<span class="tag tag-warning">${contract.status === 'pending_sign' ? '待签署' : '草稿'}</span>`}
        </div>
      ` : '<p style="margin-top: 24px;">暂无相关租赁合同。</p>'}

      ${order.status === 'pending_payment' ? `
        <div class="section-title" style="margin-top: 24px;"><h3>支付信息</h3></div>
        <div class="payment-options" style="display: flex; gap: 20px; margin-top: 16px;">
          <div class="payment-card">
            <h4>银行转账</h4>
            <p><strong>银行名称:</strong> ${systemSettings.bankDetails.accountName}</p>
            <p><strong>BSB:</strong> ${systemSettings.bankDetails.bsb}</p>
            <p><strong>账号:</strong> ${systemSettings.bankDetails.account}</p>
            <p>客户需转账 ${formatCurrency(order.totalAmount)} 到以上账户。</p>
          </div>
          ${systemSettings.paymentMethods.stripe ? `<div class="payment-card"><h4>信用卡支付（Stripe）</h4><p>客户将通过 Stripe 托管结账页付款。</p></div>` : ''}
        </div>
      ` : ''}
    </div>
  `
  return buildLayout('订单详情 - 电脑租赁管理系统', body, user)
}
