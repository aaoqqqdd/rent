import { buildLayout, getDeviceById, formatCurrency, getOrders, getUsers } from '../../site';
import { Context } from 'hono';

export async function renderStaffDeviceDetail(c: Context, user: any, deviceId: string) {
  const device = await getDeviceById(c, deviceId)
  if (!device) {
    return buildLayout('设备详情 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求的设备不存在。</p></div>', user)
  }

  const orders = (await getOrders(c)).filter(order => order.deviceId === device.id)
  const usersData = await getUsers(c)

  const body = `
    <div class="panel">
      <div class="section-title"><h2>设备详情 - ${device.name}</h2><span class="section-note">查看设备详细信息、租赁历史及管理。</span></div>
      <div class="grid grid-2">
        <div>
          <h3>基本信息</h3>
          <p><strong>设备名称:</strong> ${device.name}</p>
          <p><strong>型号:</strong> ${device.model}</p>
          <p><strong>序列号:</strong> ${device.serialNumber}</p>
          <p><strong>日租金:</strong> ${formatCurrency(device.pricePerDay ?? device.dailyRate ?? 0)}</p>
          <p><strong>状态:</strong> ${device.status}</p>
        </div>
        <div>
          <h3>操作</h3>
          <a class="button" href="/staff/devices/${device.id}/edit">编辑设备信息</a>
          <form method="POST" action="/staff/devices/${device.id}/delete" onsubmit="return confirm('确定要删除此设备吗？');" style="margin-top: 10px;">
            <button class="button button-danger" type="submit">删除设备</button>
          </form>
        </div>
      </div>

      <div class="section-title" style="margin-top: 24px;"><h3>租赁历史</h3></div>
      ${orders.length ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>客户</th><th>租期</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${orders.map((order) => {
              const customer = usersData.find(u => u.id === order.userId)
              return `<tr><td>${order.orderNo}</td><td>${customer?.name ?? 'N/A'}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${order.status}</td><td><a class="link-button" href="/staff/orders/${order.id}">查看订单</a></td></tr>`
            }).join('')}
          </tbody></table>
        </div>
      ` : '<p>此设备暂无租赁历史。</p>'}
    </div>
  `
  return buildLayout('设备详情 - 电脑租赁管理系统', body, user)
}
