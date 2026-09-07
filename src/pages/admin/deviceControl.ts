import { buildLayout, sanitizePlainText } from '../../site'

interface MaintenanceView {
  maintenance: any[]
  checksByRecord: Record<string, any[]>
  checkTypes: string[]
}

export function renderAdminDeviceControl(user: any, device: any, commands: any[] = [], maint?: MaintenanceView) {
  if (!device) return buildLayout('设备远程控制', '<div class="panel"><h2>设备未找到</h2></div>', user)
  const esc = (value: unknown) => sanitizePlainText(value, 500).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const labels: Record<string, string> = { SYNC: '立即同步', REFRESH_DEVICE_INFO: '刷新设备信息', CHECK_UPDATE: '检查客户端更新', PAUSE_RENTAL: '暂停设备', RESUME_RENTAL: '恢复设备', SHOW_MESSAGE: '发送设备通知', CHECK_UPDATE_CLIENT: '检查客户端更新' }
  const isOnline = String(device.agent_status || device.agentStatus || '').toLowerCase() === 'online'
  const stateBadge = (status: string) => `badge ${['SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(status) ? 'badge-success' : ['FAILED', 'EXPIRED', 'CANCELLED'].includes(status) ? 'badge-danger' : 'badge-warning'}`
  const timeline = (command: any) => [['已发送', command.sent_at], ['已确认', command.acknowledged_at], ['执行中', command.started_at], ['已结束', command.completed_at]].filter(([, at]) => at).map(([label, at]) => `${label} ${esc(String(at).slice(5, 16))}`).join(' → ') || '排队中'
  const rows = commands.length ? commands.map(command => `<tr><td class="mono">${esc(command.created_at)}</td><td>${labels[command.command_type] || esc(command.command_type)}</td><td><span class="${stateBadge(String(command.status))}">${esc(command.status)}</span><div class="form-text mono">${timeline(command)}</div></td><td>${esc(command.result_message || command.error_message || '等待客户端执行')}${command.status === 'QUEUED' ? `<form method="post" action="/admin/devices/${encodeURIComponent(device.id)}/commands/${encodeURIComponent(command.id)}/cancel" style="margin-top:6px" onsubmit="return confirm('取消这条尚未被设备领取的命令？')"><button class="button button-secondary" type="submit">取消命令</button></form>` : ''}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">暂无远程命令记录</td></tr>'
  const action = (type: string, text: string, className = 'button-secondary') => `<button class="button ${className}" name="commandType" value="${type}" type="submit" ${isOnline ? '' : 'disabled title="设备不在线，无法执行远程操作"'}>${text}</button>`
  const onlineNote = isOnline ? '设备在线，命令会由 Windows 客户端在下一次轮询时领取。' : '设备当前不在线，远程操作已禁用；设备上线后即可操作。'

  const maintenanceLabels: Record<string, string> = { OPEN: '待处理', IN_PROGRESS: '维修中', DATA_CLEAN: '数据清除', SYSTEM_RESET: '系统重置', CLIENT_CHECK: '设备验证', COMPLETED: '已完成', FAILED: '已终止' }
  const checkLabels: Record<string, string> = { DATA_WIPE: '数据清除', SYSTEM_RESET: '系统重置', WINDOWS_BOOT: 'Windows 启动', AGENT_INSTALLED: '客户端已安装', AGENT_VERSION: '客户端版本', DEVICE_SERIAL: '设备序列号', DISK_HEALTH: '磁盘健康', NETWORK: '网络', HARDWARE: '硬件', ACCESSORIES: '配件' }
  const openStates = ['OPEN', 'IN_PROGRESS', 'DATA_CLEAN', 'SYSTEM_RESET', 'CLIENT_CHECK']
  const hasOpen = (maint?.maintenance || []).some(r => openStates.includes(r.status))
  const renderChecks = (record: any) => {
    const done = new Map<string, any>((maint?.checksByRecord[record.id] || []).map((c: any) => [c.check_type, c]))
    return `<div class="table-wrapper"><table><thead><tr><th>验证项</th><th>结果</th></tr></thead><tbody>${(maint?.checkTypes || []).map(type => {
      const c = done.get(type)
      return `<tr><td>${checkLabels[type] || type}</td><td>${c ? `<span class="${c.passed ? 'badge badge-success' : 'badge badge-danger'}">${c.passed ? '通过' : '未通过'}</span>${c.details ? ` <span class="form-text">${esc(c.details)}</span>` : ''}` : '<span class="badge badge-neutral">未记录</span>'}<form method="post" action="/admin/maintenance/${encodeURIComponent(record.id)}/checks" style="display:inline-flex;gap:4px;margin-left:8px"><input type="hidden" name="checkType" value="${type}"><input class="form-control" name="details" maxlength="200" placeholder="备注" style="width:120px"><button class="button button-sm button-success" name="passed" value="1" type="submit">通过</button><button class="button button-sm button-secondary" name="passed" value="0" type="submit">不通过</button></form></td></tr>`
    }).join('')}</tbody></table></div>`
  }
  const maintenanceCards = (maint?.maintenance || []).map((record: any) => {
    const passedCount = (maint?.checksByRecord[record.id] || []).filter((c: any) => c.passed).length
    const isOpen = openStates.includes(record.status)
    return `<div class="panel" style="margin-bottom:12px">
      <div class="section-title"><h4>${esc(record.maintenance_type)} · <span class="${stateBadge(String(record.status))}">${maintenanceLabels[record.status] || esc(record.status)}</span></h4><span class="section-note">${esc(String(record.started_at || '').slice(0, 16))}${record.completed_at ? ` → ${esc(String(record.completed_at).slice(0, 16))}` : ''}</span></div>
      <p>${esc(record.description || '')}</p>
      <dl class="detail-grid">
        <div><dt>维修成本</dt><dd>${Number(record.cost || 0).toFixed(2)}</dd></div>
        <div><dt>服务商</dt><dd>${esc(record.vendor || '—')}</dd></div>
        <div><dt>技师</dt><dd>${esc(record.technician || '—')}</dd></div>
        <div><dt>更换部件</dt><dd>${esc(record.replacement_parts || '—')}</dd></div>
        <div><dt>数据清除方式</dt><dd>${esc(record.data_wipe_method || '—')}</dd></div>
        <div><dt>设备验证</dt><dd>${passedCount} / 10 项通过</dd></div>
        ${record.repair_notes ? `<div><dt>维修说明</dt><dd>${esc(record.repair_notes)}</dd></div>` : ''}
        ${record.failure_reason ? `<div><dt>终止原因</dt><dd>${esc(record.failure_reason)}</dd></div>` : ''}
      </dl>
      <details><summary>编辑维护详情</summary>
        <form method="post" action="/admin/maintenance/${encodeURIComponent(record.id)}/update" class="grid grid-2" style="margin-top:10px;gap:10px">
          <label class="form-group"><span class="form-label">维修成本</span><input class="form-control" type="number" min="0" step="0.01" name="cost" value="${Number(record.cost || 0)}"></label>
          <label class="form-group"><span class="form-label">服务商</span><input class="form-control" name="vendor" maxlength="200" value="${esc(record.vendor || '')}"></label>
          <label class="form-group"><span class="form-label">技师</span><input class="form-control" name="technician" maxlength="200" value="${esc(record.technician || '')}"></label>
          <label class="form-group"><span class="form-label">数据清除方式</span><input class="form-control" name="dataWipeMethod" maxlength="200" value="${esc(record.data_wipe_method || '')}"></label>
          <label class="form-group"><span class="form-label">更换部件</span><input class="form-control" name="replacementParts" maxlength="1000" value="${esc(record.replacement_parts || '')}"></label>
          <label class="form-group"><span class="form-label">发票 / 附件链接</span><input class="form-control" name="invoiceUrl" maxlength="500" value="${esc(record.invoice_url || '')}"></label>
          <label class="form-group" style="grid-column:1/-1"><span class="form-label">维修说明</span><textarea class="form-control" name="repairNotes" rows="2" maxlength="1000">${esc(record.repair_notes || '')}</textarea></label>
          <div style="grid-column:1/-1"><button class="button button-primary" type="submit">保存维护详情</button></div>
        </form>
      </details>
      ${isOpen ? `<div class="record-actions" style="margin-top:10px">
        <form method="post" action="/admin/maintenance/${encodeURIComponent(record.id)}/advance" onsubmit="return confirm('推进到下一阶段？')"><button class="button button-primary" type="submit">${record.status === 'CLIENT_CHECK' ? `完成维护（需 10/10 通过，当前 ${passedCount}）` : '推进到下一阶段'}</button></form>
      </div>
      ${['DATA_CLEAN', 'SYSTEM_RESET', 'CLIENT_CHECK'].includes(record.status) ? `<h5 style="margin:12px 0 6px">归还前十项验证</h5>${renderChecks(record)}` : ''}` : ''}
    </div>`
  }).join('') || '<p class="form-text">暂无维护记录。</p>'

  const body = `<div class="page-header"><div><p class="section-code">REMOTE CONTROL</p><h2>${esc(device.name)}</h2><p>${esc(device.model)} · ${esc(device.serialNumber || device.serial_number || '无序列号')} · 生命周期 <span class="badge badge-info">${esc(device.lifecycle_status || device.lifecycleStatus || 'READY')}</span></p></div><div class="record-actions"><a class="button button-secondary" href="/admin/devices/${encodeURIComponent(device.id)}/edit">编辑设备</a><a class="button button-secondary" href="/admin/device-agent-bindings">绑定设备</a></div></div>` +
    `<div class="panel"><h3>远程操作</h3><p class="form-text">${onlineNote}</p><form method="post" action="/admin/devices/${encodeURIComponent(device.id)}/commands"><div class="record-actions">${action('SYNC', '立即同步')}${action('REFRESH_DEVICE_INFO', '刷新设备信息')}${action('CHECK_UPDATE', '检查客户端更新')}${action('PAUSE_RENTAL', '暂停设备', 'button-warning')}${action('RESUME_RENTAL', '恢复设备', 'button-success')}</div><div class="grid grid-2" style="margin-top:14px"><input class="form-control" name="title" maxlength="120" placeholder="通知标题" ${isOnline ? '' : 'disabled'}><input class="form-control" name="message" maxlength="500" placeholder="通知内容" ${isOnline ? '' : 'disabled'}></div>${action('SHOW_MESSAGE', '发送设备通知')}</form></div>` +
    `<div class="panel"><div class="section-title"><h3>维护生命周期</h3><span class="section-note">RETURNED → INSPECTION → MAINTENANCE → READY；损坏可退役</span></div>` +
    `<form method="post" action="/admin/devices/${encodeURIComponent(device.id)}/maintenance" class="grid grid-2" style="gap:10px;margin-bottom:16px">
        <label class="form-group"><span class="form-label">维护类型</span><select class="form-control" name="type"><option value="RETURN_PREPARATION">归还准备</option><option value="REPAIR">维修</option><option value="DATA_WIPE">数据清除</option><option value="SYSTEM_RESET">系统重置</option><option value="INSPECTION">检查</option></select></label>
        <label class="form-group"><span class="form-label">技师</span><input class="form-control" name="technician" maxlength="200"></label>
        <label class="form-group" style="grid-column:1/-1"><span class="form-label">维护说明</span><input class="form-control" name="description" maxlength="1000" required placeholder="例如：客户归还后检出键盘进液，需更换键盘"></label>
        <div style="grid-column:1/-1"><button class="button button-primary" type="submit">新建维护记录</button></div>
      </form>` +
    `<form method="post" action="/admin/devices/${encodeURIComponent(device.id)}/retire" onsubmit="return confirm('确认退役该设备？退役后不可再出租。')" style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <label class="form-group" style="flex:1"><span class="form-label">退役原因</span><input class="form-control" name="reason" maxlength="500" required placeholder="例如：主板损坏，维修成本超过残值"></label>
        <label class="form-check"><input type="checkbox" name="force" value="1"> 强制退役</label>
        <button class="button button-danger" type="submit">退役设备</button>
      </form>` +
    `${hasOpen ? '' : '<p class="form-text">没有进行中的维护，设备可正常上架。</p>'}${maintenanceCards}</div>` +
    `<div class="panel"><div class="section-title"><h3>最近 20 条远程命令</h3><span class="section-note">操作时间 · 类型 · 状态时间线 · 客户端返回</span></div><div class="table-wrapper"><table><thead><tr><th>操作时间</th><th>操作类型</th><th>执行状态</th><th>客户端返回结果</th></tr></thead><tbody>${rows}</tbody></table></div></div>`
  return buildLayout(`设备远程控制 - ${device.name}`, body, user)
}
