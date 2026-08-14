/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText } from '../../site'

export function renderAdminDeviceEdit(user: any, device: any) {
  if (!device) return buildLayout('编辑设备 - 电脑租赁管理系统', '<div class="panel"><h2>设备未找到</h2><p>您请求的设备不存在。</p></div>', user)
  const esc = (value: unknown) => sanitizePlainText(value, 2000).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const value = (camel: string, snake = camel) => esc(device[camel] ?? device[snake] ?? '')
  const status = device.status || 'available'
  const body = `
    <div class="page-header"><div><p class="section-code">ASSET RECORD</p><h2>编辑设备</h2><p>${value('name')} · <span class="mono">${value('assetTag', 'asset_tag') || value('id')}</span></p></div><div><a href="/admin/devices/${value('id')}/agent-install" class="button button-primary">生成 Windows 客户端安装信息</a> <a href="/admin/devices" class="button button-secondary">返回设备列表</a></div></div>
    <div class="panel">
      <form method="POST" action="/admin/devices/${value('id')}/edit" class="asset-editor">
        <section class="form-section"><div class="form-section-title"><span class="mono">ID</span><div><h3>设备身份</h3><p>更新后，员工端设备目录和搜索结果会使用这里的资料。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="name">设备名称</label><input class="form-control" id="name" name="name" value="${value('name')}" required maxlength="120"></div>
            <div class="form-group"><label class="form-label" for="brand">品牌</label><div class="brand-entry"><input class="form-control" id="brand" name="brand" value="${value('brand')}" required maxlength="120" placeholder="例如 Apple" autocomplete="off"><span class="brand-logo" id="brandLogo" aria-hidden="true"></span><div class="brand-suggestions" id="brandSuggestions" role="listbox" aria-label="品牌选项"></div></div></div>
            <div class="form-group"><label class="form-label" for="model">型号</label><input class="form-control" id="model" name="model" value="${value('model')}" required maxlength="120"></div>
            <div class="form-group"><label class="form-label" for="assetTag">资产编号</label><input class="form-control mono" id="assetTag" name="assetTag" value="${value('assetTag', 'asset_tag')}" maxlength="80"></div>
            <div class="form-group"><label class="form-label" for="remark">备注</label><input class="form-control" id="remark" name="remark" value="${value('description')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="serialNumber">序列号</label><input class="form-control mono" id="serialNumber" name="serialNumber" value="${value('serialNumber', 'serial_number')}" required maxlength="120"></div>
            <div class="form-group"><label class="form-label" for="status">状态</label><select class="form-control" id="status" name="status"><option value="available" ${status === 'available' ? 'selected' : ''}>可用</option><option value="rented" ${status === 'rented' ? 'selected' : ''}>已出租</option><option value="maintenance" ${status === 'maintenance' ? 'selected' : ''}>维修中</option><option value="retired" ${status === 'retired' ? 'selected' : ''}>已退役</option></select></div>
          </div>
        </section>
        <section class="form-section"><div class="form-section-title"><span class="mono">SPEC</span><div><h3>硬件配置</h3><p>各字段均可被员工端设备搜索匹配。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="cpu">CPU</label><input class="form-control" id="cpu" name="cpu" value="${value('cpu')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="ram">内存</label><input class="form-control" id="ram" name="ram" value="${value('ram')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="storage">存储</label><input class="form-control" id="storage" name="storage" value="${value('storage')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="gpu">显卡</label><input class="form-control" id="gpu" name="gpu" value="${value('gpu')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="os">操作系统</label><input class="form-control" id="os" name="os" value="${value('os')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="unavailableDates">不可用日期</label><input class="form-control" id="unavailableDates" name="unavailableDates" value="${esc((device.unavailableDates || []).join(', '))}" placeholder="2026-12-25, 2026-12-26"><small class="form-text">多个日期用逗号分隔；这些日期不能被客户或员工安排租赁。</small></div>
          </div>
          <div class="form-group"><label class="form-label" for="description">补充描述</label><textarea class="form-control" id="description" name="description" rows="4" maxlength="2000">${value('description')}</textarea></div>
        </section>
        <section class="form-section"><div class="form-section-title"><span class="mono">AUD</span><div><h3>租赁价格</h3><p>修改价格不会改写已经建立的历史合同。</p></div></div><div class="grid grid-2"><div class="form-group"><label class="form-label" for="pricePerDay">日租金（AUD）</label><input class="form-control" type="number" id="pricePerDay" name="pricePerDay" value="${value('pricePerDay', 'price_per_day') || '0'}" min="0" step="0.01" required></div><div class="form-group"><label class="form-label" for="depositAmount">押金（AUD）</label><input class="form-control" type="number" id="depositAmount" name="depositAmount" value="${value('depositAmount', 'deposit_amount') || '0'}" min="0" step="0.01" required></div></div></section>
        <section class="form-section"><div class="form-section-title"><span class="mono">AGENT</span><div><h3>Windows 设备代理</h3><p>查看代理注册和心跳信息；最后在线时间及设备信息由代理自动更新。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="agentStatus">代理状态</label><select class="form-control" id="agentStatus" name="agentStatus"><option value="unregistered" ${value('agentStatus') === 'unregistered' ? 'selected' : ''}>未注册</option><option value="online" ${value('agentStatus') === 'online' ? 'selected' : ''}>在线</option><option value="offline" ${value('agentStatus') === 'offline' ? 'selected' : ''}>离线</option><option value="paused" ${value('agentStatus') === 'paused' ? 'selected' : ''}>暂停</option></select></div>
            <div class="form-group"><label class="form-label">代理凭证</label><input class="form-control" value="${device.agentTokenHash || device.agent_token_hash ? '已注册（凭证已隐藏）' : '未设置'}" readonly></div>
            <div class="form-group"><label class="form-label">注册时间</label><input class="form-control" value="${value('agentRegisteredAt', 'agent_registered_at') || '—'}" readonly></div>
            <div class="form-group"><label class="form-label">最后心跳</label><input class="form-control" value="${value('agentLastSeenAt', 'agent_last_seen_at') || '—'}" readonly></div>
            <div class="form-group"><label class="form-label">最后访问 IP</label><input class="form-control mono" value="${value('agentLastIp', 'agent_last_ip') || '—'}" readonly></div>
            <div class="form-group"><label class="form-label">主机名</label><input class="form-control" value="${value('agentHostname', 'agent_hostname') || '—'}" readonly></div>
            <div class="form-group"><label class="form-label">操作系统版本</label><input class="form-control" value="${value('agentOsVersion', 'agent_os_version') || '—'}" readonly></div>
            <div class="form-group"><label class="form-label">CPU</label><input class="form-control" value="${value('agentCpu', 'agent_cpu') || '—'}" readonly></div>
            <div class="form-group"><label class="form-label">内存</label><input class="form-control" value="${device.agentMemoryMb ?? device.agent_memory_mb ?? '—'}" readonly></div>
            <div class="form-group"><label class="form-label">剩余存储空间</label><input class="form-control" value="${device.agentStorageFreeBytes ?? device.agent_storage_free_bytes ?? '—'}" readonly></div>
          </div>
        </section>
        <div class="record-actions"><button form="delete-device-form" type="submit" class="button button-danger">删除设备</button><button class="button button-primary" type="submit">保存设备资料</button></div>
      </form>
      <form id="delete-device-form" method="post" action="/admin/devices/${value('id')}/delete" onsubmit="return confirm('确定要删除此设备吗？此操作不可恢复。')"></form>
    </div><script>(()=>{const input=document.getElementById('brand'),logo=document.getElementById('brandLogo'),menu=document.getElementById('brandSuggestions');const brands=['Apple','Dell','HP','Lenovo','ASUS','Acer','Microsoft','Razer','Samsung','LG','Huawei','Xiaomi','MSI','Gigabyte','Framework','Toshiba','Fujitsu','Sony','Panasonic','Google','Logitech','Corsair','Intel','AMD','NVIDIA'];const domains={apple:'apple.com',dell:'dell.com',hp:'hp.com',lenovo:'lenovo.com',asus:'asus.com',acer:'acer.com',microsoft:'microsoft.com',razer:'razer.com',samsung:'samsung.com',lg:'lg.com',huawei:'huawei.com',xiaomi:'mi.com',msi:'msi.com',gigabyte:'gigabyte.com',framework:'frame.work',toshiba:'toshiba.com',fujitsu:'fujitsu.com',sony:'sony.com',panasonic:'panasonic.com',google:'google.com',logitech:'logitech.com',corsair:'corsair.com',intel:'intel.com',amd:'amd.com',nvidia:'nvidia.com'};const updateLogo=()=>{const name=input.value.trim(),domain=domains[name.toLowerCase()];logo.textContent=name.slice(0,2).toUpperCase()||'BR';logo.style.backgroundImage=domain?'url(https://www.google.com/s2/favicons?domain='+domain+'&sz=64)':'';logo.classList.toggle('has-image',Boolean(domain));};const render=()=>{const q=input.value.trim().toLowerCase(),matches=brands.filter(b=>!q||b.toLowerCase().includes(q));menu.innerHTML=matches.map(b=>'<button type="button" role="option" tabindex="-1" data-brand="'+b+'"><span>'+b+'</span><small>'+b.slice(0,2).toUpperCase()+'</small></button>').join('');menu.classList.toggle('is-open',document.activeElement===input&&matches.length>0);menu.querySelectorAll('button').forEach(b=>b.addEventListener('mousedown',e=>{e.preventDefault();input.value=b.dataset.brand;updateLogo();menu.classList.remove('is-open');}));};input.addEventListener('input',()=>{updateLogo();render();});input.addEventListener('focus',render);input.addEventListener('blur',()=>setTimeout(()=>menu.classList.remove('is-open'),120));updateLogo();})();</script>`
  return buildLayout('编辑设备 - 电脑租赁管理系统', body, user)
}
