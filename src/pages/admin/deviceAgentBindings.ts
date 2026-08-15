import { buildLayout, getDevices, sanitizePlainText } from '../../site'

export async function renderAdminDeviceAgentBindings(c: any, user: any) {
  const devices = await getDevices(c)
  const now = Date.now()
  const esc = (value: unknown) => sanitizePlainText(String(value ?? '—'), 200)
  const status = (device: any) => device.agent_status === 'online' ? '在线' : device.agent_token_hash ? '已绑定' : '未绑定'
  const rows = devices.map((device: any) => {
    const expiry = device.agent_setup_code_expires_at ? new Date(device.agent_setup_code_expires_at).getTime() : 0
    const codeStatus = expiry > now ? `待输入 · ${esc(device.agent_setup_code_expires_at)}` : device.agent_setup_code_hash ? '已过期' : '—'
    return `<tr><td><strong>${esc(device.name)}</strong><br><small class="mono">${esc(device.model)}</small></td><td class="mono">${esc(device.serialNumber || device.serial_number)}</td><td><span class="badge ${device.agent_status === 'online' ? 'badge-success' : 'badge-neutral'}">${status(device)}</span></td><td>${esc(device.agent_registered_at)}</td><td>${codeStatus}</td><td><a class="button button-sm button-secondary" href="/admin/devices/${encodeURIComponent(device.id)}/agent-install">生成/查看访问码</a>${device.agent_token_hash ? `<form method="post" action="/admin/device-agent-bindings/${encodeURIComponent(device.id)}/unbind" style="display:inline;margin-left:8px" data-site-confirm="确认解绑此设备？解绑后 EXE 才能卸载或删除。"><button class="button button-sm button-danger" type="submit">解绑</button></form>` : ''}</td></tr>`
  }).join('')
  const body = `<div class="page-header"><div><p class="section-code">WINDOWS AGENT</p><h2>绑定设备</h2><p>管理 Windows 客户端访问码和已绑定设备。访问码有效期为 15 分钟，成功绑定后立即失效。</p></div><a class="button button-secondary" href="/admin/devices">设备管理</a></div><div class="panel"><div class="table-wrapper"><table><thead><tr><th>设备</th><th>序列号</th><th>客户端状态</th><th>绑定时间</th><th>访问码</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="6">暂无设备</td></tr>'}</tbody></table></div></div>`
  return buildLayout('Windows 客户端绑定设备 - 电脑租赁管理系统', body, user)
}
