import { buildLayout, sanitizePlainText } from '../../site'

function scopeLabel(c: any): string {
  return c.device_id ? `设备：${c.device_id}` : c.brand ? `品牌：${c.brand}` : c.config_keyword ? `配置含：${c.config_keyword}` : '全场'
}

function statusBadge(c: any): string {
  const labels: Record<string, string> = { DRAFT: '草稿', ACTIVE: '启用', DISABLED: '停用', EXPIRED: '已过期' }
  const status = c.expires_at && new Date(c.expires_at).getTime() < Date.now() ? 'EXPIRED' : String(c.status || (c.active ? 'ACTIVE' : 'DISABLED'))
  return labels[status] || status
}

export function renderAdminCoupons(user: any, coupons: any[] = [], devices: any[] = []) {
  const rows = coupons.map(c => `<tr>
    <td class="mono">${sanitizePlainText(c.code, 40)}</td>
    <td>${c.discount_type === 'percent' ? `${c.discount_value}%` : `AUD$${Number(c.discount_value).toFixed(2)}`}${c.max_discount_amount ? `（封顶 AUD$${Number(c.max_discount_amount).toFixed(2)}）` : ''}</td>
    <td>${scopeLabel(c)}</td>
    <td>${c.minimum_order_amount ? `AUD$${Number(c.minimum_order_amount).toFixed(2)}` : '无'}</td>
    <td>${c.used_count}${c.max_uses ? ` / ${c.max_uses}` : ''}${c.max_uses_per_customer ? `（每人限 ${c.max_uses_per_customer} 次）` : ''}</td>
    <td>${c.new_customer_only ? '是' : '否'}</td>
    <td>${statusBadge(c)}</td>
    <td>${c.starts_at || '-'} 至 ${c.expires_at || '-'}</td>
    <td>
      <a class="button button-sm button-secondary" href="/admin/coupons/${encodeURIComponent(c.id)}/edit">编辑</a>
      <form method="post" action="/admin/coupons/${encodeURIComponent(c.id)}/toggle" style="display:inline"><button class="button button-sm button-secondary" type="submit">${c.active ? '停用' : '启用'}</button></form>
      <form method="post" action="/admin/coupons/${encodeURIComponent(c.id)}/delete" style="display:inline" data-site-confirm="确认删除该优惠码吗？"><button class="button button-sm button-danger" type="submit">删除</button></form>
    </td>
  </tr>`).join('')
  const deviceOptions = devices.map(d => `<option value="${d.id}">${d.name} · ${d.brand || ''} · ${d.model || ''}</option>`).join('')
  const body = `<div class="page-header"><div><p class="section-code">FINANCE / PROMOTIONS</p><h2>优惠码管理</h2><p>创建和管理客户付款时可使用的优惠码。</p></div><a class="button button-secondary" href="/admin/finance">返回财务总览</a></div>
  <div class="panel">
    <h3>创建优惠码</h3>
    <form method="post" action="/admin/coupons" class="grid grid-2">
      <input class="form-control" name="code" required maxlength="40" placeholder="优惠码，例如 WELCOME10">
      <select class="form-control" name="status"><option value="ACTIVE">启用</option><option value="DRAFT">草稿（暂不生效）</option><option value="DISABLED">停用</option></select>
      <select class="form-control" name="discountType"><option value="percent">百分比折扣</option><option value="fixed">固定金额折扣</option></select>
      <input class="form-control" name="discountValue" type="number" min="0.01" step="0.01" required placeholder="折扣值">
      <input class="form-control" name="maxDiscountAmount" type="number" min="0" step="0.01" placeholder="最高优惠金额（仅百分比折扣，可留空）">
      <input class="form-control" name="minimumOrderAmount" type="number" min="0" step="0.01" placeholder="最低订单金额（可留空）">
      <input class="form-control" name="maxUses" type="number" min="1" step="1" placeholder="全局最多使用次数（可留空）">
      <input class="form-control" name="maxUsesPerCustomer" type="number" min="1" step="1" placeholder="每位客户最多使用次数（可留空）">
      <input class="form-control" name="startsAt" type="datetime-local">
      <input class="form-control" name="expiresAt" type="datetime-local">
      <select class="form-control" name="deviceId"><option value="">适用全部设备</option>${deviceOptions}</select>
      <input class="form-control" name="brand" maxlength="120" placeholder="限定品牌（例如 Apple，可留空）">
      <input class="form-control" name="configKeyword" maxlength="120" placeholder="限定配置关键词（例如 M3、32GB，可留空）">
      <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" name="newCustomerOnly"> 仅限新客户使用</label>
      <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" name="stackable"> 允许与其他优惠叠加（系统当前每单仅支持一个优惠码，此字段为后续功能预留）</label>
      <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" name="restoreOnCancellation" checked> 订单取消后恢复使用次数</label>
      <small class="form-text">设备、品牌、配置均填写时，必须同时满足；全部留空表示全场可用。</small>
      <button class="button button-primary" type="submit">创建优惠码</button>
    </form>
  </div>
  <div class="panel">
    <div class="section-title"><h3>优惠码列表</h3><span class="section-note">共 ${coupons.length} 个</span></div>
    ${coupons.length ? `<div class="table-wrapper"><table><thead><tr><th>代码</th><th>折扣</th><th>适用范围</th><th>最低消费</th><th>使用次数</th><th>仅新客户</th><th>状态</th><th>有效期</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">暂无优惠码</div>'}
  </div>`
  return buildLayout('优惠码管理 - 电脑租赁管理系统', body, user)
}

export function renderAdminCouponEdit(user: any, coupon: any, devices: any[] = []) {
  const locked = Number(coupon.used_count) > 0
  const deviceOptions = devices.map(d => `<option value="${d.id}" ${String(coupon.device_id) === String(d.id) ? 'selected' : ''}>${d.name} · ${d.brand || ''} · ${d.model || ''}</option>`).join('')
  const toLocal = (value: string) => value ? String(value).replace(' ', 'T').slice(0, 16) : ''
  const body = `<div class="page-header"><div><p class="section-code">FINANCE / PROMOTIONS</p><h2>编辑优惠码 ${sanitizePlainText(coupon.code, 40)}</h2></div><a class="button button-secondary" href="/admin/coupons">返回优惠码列表</a></div>
  <div class="panel">
    ${locked ? `<p class="section-note">该优惠码已有 ${coupon.used_count} 次使用记录，代码、折扣类型和折扣值不可再修改，请改为创建新优惠码。</p>` : ''}
    <form method="post" action="/admin/coupons/${encodeURIComponent(coupon.id)}" class="grid grid-2">
      <input class="form-control" value="${sanitizePlainText(coupon.code, 40)}" disabled>
      <select class="form-control" name="status"><option value="ACTIVE" ${coupon.status === 'ACTIVE' ? 'selected' : ''}>启用</option><option value="DRAFT" ${coupon.status === 'DRAFT' ? 'selected' : ''}>草稿（暂不生效）</option><option value="DISABLED" ${coupon.status === 'DISABLED' ? 'selected' : ''}>停用</option></select>
      <select class="form-control" name="discountType" ${locked ? 'disabled' : ''}><option value="percent" ${coupon.discount_type === 'percent' ? 'selected' : ''}>百分比折扣</option><option value="fixed" ${coupon.discount_type === 'fixed' ? 'selected' : ''}>固定金额折扣</option></select>
      <input class="form-control" name="discountValue" type="number" min="0.01" step="0.01" value="${coupon.discount_value}" ${locked ? 'disabled' : 'required'}>
      <input class="form-control" name="maxDiscountAmount" type="number" min="0" step="0.01" value="${coupon.max_discount_amount ?? ''}" placeholder="最高优惠金额（仅百分比折扣，可留空）">
      <input class="form-control" name="minimumOrderAmount" type="number" min="0" step="0.01" value="${coupon.minimum_order_amount ?? ''}" placeholder="最低订单金额（可留空）">
      <input class="form-control" name="maxUses" type="number" min="1" step="1" value="${coupon.max_uses ?? ''}" placeholder="全局最多使用次数（可留空）">
      <input class="form-control" name="maxUsesPerCustomer" type="number" min="1" step="1" value="${coupon.max_uses_per_customer ?? ''}" placeholder="每位客户最多使用次数（可留空）">
      <input class="form-control" name="startsAt" type="datetime-local" value="${toLocal(coupon.starts_at)}">
      <input class="form-control" name="expiresAt" type="datetime-local" value="${toLocal(coupon.expires_at)}">
      <select class="form-control" name="deviceId"><option value="">适用全部设备</option>${deviceOptions}</select>
      <input class="form-control" name="brand" maxlength="120" value="${sanitizePlainText(coupon.brand || '', 120)}" placeholder="限定品牌（可留空）">
      <input class="form-control" name="configKeyword" maxlength="120" value="${sanitizePlainText(coupon.config_keyword || '', 120)}" placeholder="限定配置关键词（可留空）">
      <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" name="newCustomerOnly" ${coupon.new_customer_only ? 'checked' : ''}> 仅限新客户使用</label>
      <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" name="stackable" ${coupon.stackable ? 'checked' : ''}> 允许与其他优惠叠加（当前系统每单仅支持一个优惠码，此字段为后续功能预留）</label>
      <label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" name="restoreOnCancellation" ${coupon.restore_on_cancellation ? 'checked' : ''}> 订单取消后恢复使用次数</label>
      <button class="button button-primary" type="submit">保存修改</button>
    </form>
  </div>`
  return buildLayout('编辑优惠码 - 电脑租赁管理系统', body, user)
}
