import { buildLayout, sanitizePlainText } from '../../site'

const CHECK_LABELS: Record<string, string> = { DATA_WIPE: '数据清除', SYSTEM_RESET: '系统重置', WINDOWS_BOOT: 'Windows 启动', AGENT_INSTALLED: '客户端已安装', AGENT_VERSION: '客户端版本', DEVICE_SERIAL: '设备序列号', DISK_HEALTH: '磁盘健康', NETWORK: '网络', HARDWARE: '硬件', ACCESSORIES: '配件' }

export function renderAdminDeviceAccept(user: any, device: any, checkTypes: string[], blockedReason?: string) {
  if (!device) return buildLayout('设备验收', '<div class="panel"><h2>设备未找到</h2></div>', user)
  const esc = (value: unknown) => sanitizePlainText(value, 500).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lifecycleStatus = String(device.lifecycle_status || device.lifecycleStatus || 'READY')

  const body = `<div class="page-header"><div><p class="section-code">DEVICE ACCEPTANCE</p><h2>验收 · ${esc(device.name)}</h2><p>${esc(device.model)} · ${esc(device.serialNumber || device.serial_number || '无序列号')} · 生命周期 <span class="badge badge-info">${esc(lifecycleStatus)}</span></p></div><div class="record-actions"><a class="button button-secondary" href="/admin/devices/${encodeURIComponent(device.id)}/control">设备详情 / 远程操作</a></div></div>` +
    (blockedReason ? `<div class="panel"><p class="alert alert-warning">${esc(blockedReason)}</p><p class="form-text">请到<a href="/admin/devices/${encodeURIComponent(device.id)}/control">设备详情</a>页处理进行中的维护记录，或等待关联订单结束后再来验收。</p></div>` : `
    <div class="panel">
      <div class="section-title"><h3>归还前十项验证</h3><span class="section-note">状况良好可一次性提交；十项全部通过后设备立即变为可用</span></div>
      <form method="post" action="/admin/devices/${encodeURIComponent(device.id)}/accept">
        <div class="table-wrapper"><table><thead><tr><th>验证项</th><th>结果</th></tr></thead><tbody>
          ${checkTypes.map(type => `<tr><td>${CHECK_LABELS[type] || type}</td><td><label class="form-check" style="display:inline-flex;margin-right:16px"><input type="radio" name="check_${type}" value="1" checked> 通过</label><label class="form-check" style="display:inline-flex"><input type="radio" name="check_${type}" value="0"> 不通过</label></td></tr>`).join('')}
        </tbody></table></div>
        <div class="grid grid-2" style="gap:10px;margin-top:12px">
          <label class="form-group"><span class="form-label">验收人（选填）</span><input class="form-control" name="technician" maxlength="200"></label>
          <label class="form-group"><span class="form-label">备注（选填）</span><input class="form-control" name="notes" maxlength="1000" placeholder="有不通过项时会一并记录"></label>
        </div>
        <div style="margin-top:14px"><button class="button button-primary" type="submit">提交验收</button><span class="form-text" style="margin-left:10px">有不通过项会自动转入维护流程，不会直接放行，可在设备详情页继续处理</span></div>
      </form>
    </div>`)
  return buildLayout(`设备验收 - ${device.name}`, body, user)
}
