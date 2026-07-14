import { buildLayout, getOrders, getOrderById, getDeviceById, getUserById } from '../../site';

export async function renderStaffContractNew(c: Context, user: any, orderId: string, errorMessage?: string) {
  const order = await getOrderById(c, orderId)
  if (!order) {
    return buildLayout('新建合同 - 电脑租赁管理系统', '<div class="panel"><h2>订单未找到</h2><p>无法为不存在的订单创建合同。</p></div>', user)
  }
  const customer = await getUserById(c, order.userId)
  const device = await getDeviceById(c, order.deviceId)

  const defaultContractContent = `
    <h1>电脑租赁协议</h1>
    <p>本协议由以下双方于 ${new Date().toLocaleDateString()} 签订：</p>
    <p><strong>出租方：</strong> 电脑租赁公司</p>
    <p><strong>承租方：</strong> ${customer?.name ?? '未知客户'}</p>
    <h2>租赁设备</h2>
    <p><strong>设备名称：</strong> ${device?.name ?? '未知设备'}</p>
    <p><strong>型号：</strong> ${device?.model ?? 'N/A'}</p>
    <p><strong>序列号：</strong> ${device?.serialNumber ?? 'N/A'}</p>
    <h2>租赁期限</h2>
    <p><strong>起始日期：</strong> ${order.startDate}</p>
    <p><strong>结束日期：</strong> ${order.endDate}</p>
    <h2>租金与押金</h2>
    <p><strong>日租金：</strong> ${device?.dailyRate ?? 0} 元</p>
    <p><strong>总租金：</strong> ${order.totalAmount - order.depositAmount} 元</p>
    <p><strong>押金：</strong> ${order.depositAmount} 元</p>
    <p><strong>总计：</strong> ${order.totalAmount} 元</p>
    <h2>双方权利与义务</h2>
    <p>（此处填写详细条款，例如设备使用、维护、归还、违约责任等）</p>
    <h2>争议解决</h2>
    <p>本协议受[国家/地区]法律管辖。任何因本协议引起的争议应通过友好协商解决；协商不成，应提交至[仲裁机构/法院]解决。</p>
    <p>_________________________</p>
    <p>出租方签字</p>
    <p>_________________________</p>
    <p>承租方签字</p>
  `

  const body = `
    <div class="panel">
      <div class="section-title"><h2>为订单 #${order.orderNo} 创建租赁合同</h2><span class="section-note">编辑合同内容并生成。</span></div>
      ${errorMessage ? `<div class="alert alert-danger">${errorMessage}</div>` : ''}
      <form method="POST" action="/staff/orders/${order.id}/generate-contract">
        <label class="form-label">合同内容</label>
        <textarea class="form-control" name="contractContent" rows="20">${defaultContractContent}</textarea>
        <button class="button button-primary" type="submit" style="margin-top: 20px;">生成并发送合同</button>
      </form>
    </div>
  `
  return buildLayout('新建合同 - 电脑租赁管理系统', body, user)
}