import type { Context } from 'hono'
import { buildLayout, sanitizePlainText } from '../../site'

export async function renderInspectionRecords(c: Context, user: any) {
  const rows = ((await c.env.RENT.prepare(`SELECT i.*, d.name AS device_name, d.model AS device_model, u.name AS editor_name FROM device_inspections i JOIN devices d ON d.id = i.device_id LEFT JOIN users u ON u.id = i.edited_by ORDER BY i.created_at DESC LIMIT 200`).all()).results || []) as any[]
  const esc = (value: unknown) => sanitizePlainText(String(value ?? '—'), 240)
  const typeLabel: Record<string, string> = { before_rental: '出租前', after_return: '归还后', automated_health: '自动巡检' }
  const tableRows = rows.map((row) => {
    let snapshot: any = {}
    try { snapshot = JSON.parse(row.snapshot_json || '{}') } catch (_) {}
    const checks = [['屏幕', snapshot.screen], ['键盘', snapshot.keyboard], ['触控板', snapshot.touchpad], ['摄像头', snapshot.camera], ['Wi-Fi', snapshot.wifi], ['电源', snapshot.power]].filter(([, value]) => value).map(([label, value]) => `${label}：${esc(value)}`).join('<br>') || '无自动检测数据'
    const editor = row.edited_by ? `${esc(row.editor_name || row.edited_by)}<br><small>${esc(row.edited_at)}</small>` : '未人工编辑'
    return `<tr><td><strong>${esc(row.device_name)}</strong><br><small>${esc(row.device_model)}</small></td><td><span class="badge badge-neutral">${esc(typeLabel[row.inspection_type] || row.inspection_type)}</span></td><td>${checks}</td><td>${esc(row.created_at)}</td><td>${editor}</td><td>${row.rental_id ? `<span class="badge badge-success">已关联 ${esc(row.rental_id)}</span>` : '<span class="badge badge-warning">可用于新合同</span>'}<br><a class="button button-sm button-secondary" href="/staff/inspections/${encodeURIComponent(row.id)}/edit">编辑</a></td></tr>`
  }).join('')
  const body = `<div class="page-header"><div><p class="section-code">DEVICE INSPECTIONS</p><h2>验机记录</h2><p>查看、补充和修正 EXE 自动上报的验机记录。</p></div><a class="button button-primary" href="/staff/contracts/new">新建合同</a></div><div class="panel"><div class="table-wrapper"><table><thead><tr><th>设备</th><th>记录类型</th><th>自动检测</th><th>记录时间</th><th>上次编辑</th><th>合同关联 / 操作</th></tr></thead><tbody>${tableRows || '<tr><td colspan="6">暂无验机记录。请先让 EXE 客户端完成一次同步。</td></tr>'}</tbody></table></div></div>`
  return buildLayout('验机记录', body, user)
}

export async function renderInspectionEdit(c: Context, user: any, inspectionId: string) {
  const record = await c.env.RENT.prepare('SELECT i.*, d.name AS device_name FROM device_inspections i JOIN devices d ON d.id = i.device_id WHERE i.id = ?').bind(inspectionId).first() as any
  if (!record) return buildLayout('验机记录不存在', '<div class="panel"><h2>验机记录不存在</h2></div>', user)
  let snapshot: any = {}
  try { snapshot = JSON.parse(record.snapshot_json || '{}') } catch (_) {}
  const esc = (value: unknown) => sanitizePlainText(String(value ?? ''), 300).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const snapshotJson = JSON.stringify(snapshot, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return buildLayout('编辑验机记录', `<div class="page-header"><div><p class="section-code">DEVICE INSPECTION</p><h2>编辑验机记录</h2><p>${esc(record.device_name)} · ${esc(record.created_at)}</p></div><a class="button button-secondary" href="/staff/inspections">返回记录列表</a></div><form class="panel" method="post" action="/staff/inspections/${encodeURIComponent(inspectionId)}/edit"><label class="form-label" for="inspection-snapshot">EXE 上报数据</label><textarea class="form-control mono" id="inspection-snapshot" name="snapshotJson" rows="22" required>${snapshotJson}</textarea><small class="form-text">可修改所有上报项目，包括主机名、系统、CPU、内存、存储、版本和各项检测结果；请保持 JSON 格式有效。</small><button class="button button-primary" type="submit" style="margin-top:16px">保存验机记录</button></form>`, user)
}
