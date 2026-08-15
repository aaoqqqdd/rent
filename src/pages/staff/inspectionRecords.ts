import type { Context } from 'hono'
import { buildLayout, sanitizePlainText } from '../../site'

export async function renderInspectionRecords(c: Context, user: any) {
  const esc = (value: unknown) => sanitizePlainText(String(value ?? '—'), 240)
  const rows = ((await c.env.RENT.prepare(`SELECT d.id, d.name, d.model, COUNT(i.id) AS inspection_count, MAX(i.created_at) AS latest_at FROM devices d LEFT JOIN device_inspections i ON i.device_id = d.id GROUP BY d.id ORDER BY CASE WHEN latest_at IS NULL THEN 1 ELSE 0 END, latest_at DESC`).all()).results || []) as any[]
  const tableRows = rows.map((row) => `<tr><td><strong>${esc(row.name)}</strong><br><small>${esc(row.model)}</small></td><td>${esc(row.inspection_count)} 条</td><td>${esc(row.latest_at || '暂无记录')}</td><td><a class="button button-sm button-secondary" href="/staff/inspections/device/${encodeURIComponent(row.id)}">查看验机记录</a></td></tr>`).join('')
  const body = `<div class="page-header"><div><p class="section-code">DEVICE INSPECTIONS</p><h2>验机记录</h2><p>每台设备显示一行，进入设备后查看全部验机记录。记录保存一年。</p></div><a class="button button-primary" href="/staff/contracts/new">新建合同</a></div><div class="panel"><div class="table-wrapper"><table><thead><tr><th>设备</th><th>记录数量</th><th>最近记录</th><th>操作</th></tr></thead><tbody>${tableRows || '<tr><td colspan="4">暂无设备。</td></tr>'}</tbody></table></div></div>`
  return buildLayout('验机记录', body, user)
}

export async function renderInspectionDevice(c: Context, user: any, deviceId: string, pageValue = '1') {
  const device = await c.env.RENT.prepare('SELECT id, name, model FROM devices WHERE id = ?').bind(deviceId).first() as any
  if (!device) return buildLayout('设备不存在', '<div class="panel"><h2>设备不存在</h2></div>', user)
  const page = Math.max(1, Number.parseInt(pageValue, 10) || 1)
  const pageSize = 10
  const totalRow = await c.env.RENT.prepare("SELECT COUNT(*) AS total FROM device_inspections WHERE device_id = ? AND inspection_type IN ('before_rental', 'after_return', 'automated_health')").bind(deviceId).first() as any
  const total = Number(totalRow?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * pageSize
  const rows = ((await c.env.RENT.prepare("SELECT i.*, u.name AS editor_name FROM device_inspections i LEFT JOIN users u ON u.id = i.edited_by WHERE i.device_id = ? AND i.inspection_type IN ('before_rental', 'after_return', 'automated_health') ORDER BY i.created_at DESC LIMIT ? OFFSET ?").bind(deviceId, pageSize, offset).all()).results || []) as any[]
  const esc = (value: unknown) => sanitizePlainText(String(value ?? '—'), 240)
  const typeLabel: Record<string, string> = { before_rental: '出租前', after_return: '归还后', automated_health: '每日自动上报' }
  const tableRows = rows.map((row) => { let snapshot: any = {}; try { snapshot = JSON.parse(row.snapshot_json || '{}') } catch (_) {} ; const checks = [['屏幕', snapshot.screen], ['键盘', snapshot.keyboard], ['触控板', snapshot.touchpad], ['摄像头', snapshot.camera], ['Wi-Fi', snapshot.wifi], ['电源', snapshot.power]].filter(([, value]) => value).map(([label, value]) => `${label}：${esc(value)}`).join('<br>') || '无自动检测数据'; const editor = row.edited_by ? `${esc(row.editor_name || row.edited_by)}<br><small>${esc(row.edited_at)}</small>` : '未人工编辑'; return `<tr><td><span class="badge badge-neutral">${typeLabel[row.inspection_type] || esc(row.inspection_type)}</span></td><td>${checks}</td><td>${esc(row.created_at)}</td><td>${row.rental_id ? esc(row.rental_id) : '—'}</td><td>${editor}<br><a class="button button-sm button-secondary" href="/staff/inspections/${encodeURIComponent(row.id)}/edit">编辑</a></td></tr>` }).join('')
  const pagination = totalPages > 1 ? `<div class="record-actions" style="margin-top:16px"><span class="section-note">第 ${currentPage} / ${totalPages} 页</span>${currentPage > 1 ? `<a class="button button-sm button-secondary" href="?page=${currentPage - 1}">上一页</a>` : ''}${currentPage < totalPages ? `<a class="button button-sm button-secondary" href="?page=${currentPage + 1}">下一页</a>` : ''}</div>` : ''
  const body = `<div class="page-header"><div><p class="section-code">DEVICE INSPECTIONS</p><h2>${esc(device.name)} · 验机记录</h2><p>${esc(device.model)} · 共 ${total} 条记录，保存一年。</p></div><a class="button button-secondary" href="/staff/inspections">返回设备列表</a></div><div class="panel"><div class="table-wrapper"><table><thead><tr><th>记录类型</th><th>自动检测</th><th>记录时间</th><th>关联租赁</th><th>操作</th></tr></thead><tbody>${tableRows || '<tr><td colspan="5">暂无验机记录。</td></tr>'}</tbody></table></div>${pagination}</div>`
  return buildLayout('设备验机记录', body, user)
}

export async function renderInspectionEdit(c: Context, user: any, inspectionId: string) {
  const record = await c.env.RENT.prepare('SELECT i.*, d.name AS device_name FROM device_inspections i JOIN devices d ON d.id = i.device_id WHERE i.id = ?').bind(inspectionId).first() as any
  if (!record) return buildLayout('验机记录不存在', '<div class="panel"><h2>验机记录不存在</h2></div>', user)
  let snapshot: any = {}
  try { snapshot = JSON.parse(record.snapshot_json || '{}') } catch (_) {}
  const esc = (value: unknown) => sanitizePlainText(String(value ?? ''), 300).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const checks = [['screen','屏幕'],['keyboard','键盘'],['touchpad','触控板'],['body','外壳'],['camera','摄像头'],['wifi','Wi‑Fi'],['power','电源']]
  const select = (name: string, label: string) => `<tr><th>${label}</th><td><select class="form-control" name="${name}">${['正常','异常','未测试'].map(value => `<option value="${value}"${snapshot[name] === value ? ' selected' : ''}>${value}</option>`).join('')}</select></td></tr>`
  const fields = checks.map(([name, label]) => select(name, label)).join('')
  const input = (name: string, label: string, value: unknown, type = 'text') => `<tr><th>${label}</th><td><input class="form-control" name="${name}" type="${type}" value="${esc(value)}"></td></tr>`
  const body = `<div class="page-header"><div><p class="section-code">DEVICE INSPECTION</p><h2>编辑验机记录</h2><p>${esc(record.device_name)} · ${esc(record.created_at)}</p></div><a class="button button-secondary" href="/staff/inspections/device/${encodeURIComponent(record.device_id)}">返回设备记录</a></div><form class="panel" method="post" action="/staff/inspections/${encodeURIComponent(inspectionId)}/edit"><div class="section-title"><div><h3>验机结果</h3><span class="section-note">${esc(record.inspection_type === 'before_rental' ? '出租前' : record.inspection_type === 'after_return' ? '归还后' : '每日自动上报')}</span></div></div><div class="table-wrapper"><table class="inspection-edit-table"><tbody>${fields}${input('batteryCycles','电池循环次数', snapshot.batteryCycles, 'number')}${input('batteryHealth','电池健康', snapshot.batteryHealth)}${input('damageDescription','损坏说明', snapshot.damageDescription)}${input('inspectionNotes','验机备注', snapshot.inspectionNotes)}</tbody></table></div><button class="button button-primary" type="submit" style="margin-top:16px">保存验机记录</button></form>`
  return buildLayout('编辑验机记录', body, user)
}
