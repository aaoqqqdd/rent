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
    <div class="page-header"><div><p class="section-code">ASSET RECORD</p><h2>编辑设备</h2><p>${value('name')} · <span class="mono">${value('assetTag', 'asset_tag') || value('id')}</span></p></div><a href="/admin/devices" class="button button-secondary">返回设备列表</a></div>
    <div class="panel">
      <form method="POST" action="/admin/devices/${value('id')}/edit" class="asset-editor">
        <section class="form-section"><div class="form-section-title"><span class="mono">ID</span><div><h3>设备身份</h3><p>更新后，员工端设备目录和搜索结果会使用这里的资料。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="name">设备名称</label><input class="form-control" id="name" name="name" value="${value('name')}" required maxlength="120"></div>
            <div class="form-group"><label class="form-label" for="brand">品牌</label><div class="brand-entry"><input class="form-control" id="brand" name="brand" list="brandSuggestions" value="${value('brand')}" required maxlength="120"><span class="brand-logo" id="brandLogo" aria-hidden="true">BR</span></div><datalist id="brandSuggestions"><option value="Apple"><option value="Dell"><option value="HP"><option value="Lenovo"><option value="ASUS"><option value="Acer"><option value="Microsoft"><option value="Razer"><option value="Samsung"><option value="LG"></datalist><small class="form-text">输入或选择品牌，系统会自动显示品牌 Logo。</small></div>
            <div class="form-group"><label class="form-label" for="model">型号</label><input class="form-control" id="model" name="model" value="${value('model')}" required maxlength="120"></div>
            <div class="form-group"><label class="form-label" for="assetTag">资产编号</label><input class="form-control mono" id="assetTag" value="${value('assetTag', 'asset_tag')}" readonly><small class="form-text">资产编号由系统生成，历史编号不会自动改变。</small></div>
            <div class="form-group"><label class="form-label" for="serialNumber">序列号</label><input class="form-control mono" id="serialNumber" name="serialNumber" value="${value('serialNumber', 'serial_number')}" required maxlength="120"></div>
            <div class="form-group"><label class="form-label" for="status">状态</label><select class="form-control" id="status" name="status"><option value="available" ${status === 'available' ? 'selected' : ''}>可用</option><option value="rented" ${status === 'rented' ? 'selected' : ''}>已出租</option><option value="maintenance" ${status === 'maintenance' ? 'selected' : ''}>维修中</option></select></div>
          </div>
        </section>
        <section class="form-section"><div class="form-section-title"><span class="mono">SPEC</span><div><h3>硬件配置</h3><p>各字段均可被员工端设备搜索匹配。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="cpu">CPU</label><input class="form-control" id="cpu" name="cpu" value="${value('cpu')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="ram">内存</label><input class="form-control" id="ram" name="ram" value="${value('ram')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="storage">存储</label><input class="form-control" id="storage" name="storage" value="${value('storage')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="gpu">显卡</label><input class="form-control" id="gpu" name="gpu" value="${value('gpu')}" maxlength="200"></div>
            <div class="form-group"><label class="form-label" for="os">操作系统</label><input class="form-control" id="os" name="os" value="${value('os')}" maxlength="200"></div>
          </div>
          <div class="form-group"><label class="form-label" for="description">补充描述</label><textarea class="form-control" id="description" name="description" rows="4" maxlength="2000">${value('description')}</textarea></div>
        </section>
        <section class="form-section"><div class="form-section-title"><span class="mono">AUD</span><div><h3>租赁价格</h3><p>修改价格不会改写已经建立的历史合同。</p></div></div><div class="grid grid-2"><div class="form-group"><label class="form-label" for="pricePerDay">日租金（AUD）</label><input class="form-control" type="number" id="pricePerDay" name="pricePerDay" value="${value('pricePerDay', 'price_per_day') || '0'}" min="0" step="0.01" required></div><div class="form-group"><label class="form-label" for="depositAmount">押金（AUD）</label><input class="form-control" type="number" id="depositAmount" name="depositAmount" value="${value('depositAmount', 'deposit_amount') || '0'}" min="0" step="0.01" required></div></div></section>
        <div class="record-actions"><button form="delete-device-form" type="submit" class="button button-danger">删除设备</button><button class="button button-primary" type="submit">保存设备资料</button></div>
      </form>
      <form id="delete-device-form" method="post" action="/admin/devices/${value('id')}/delete" onsubmit="return confirm('确定要删除此设备吗？此操作不可恢复。')"></form>
    </div><script>(()=>{const input=document.getElementById('brand'),logo=document.getElementById('brandLogo');const domains={apple:'apple.com',dell:'dell.com',hp:'hp.com',lenovo:'lenovo.com',asus:'asus.com',acer:'acer.com',microsoft:'microsoft.com',razer:'razer.com',samsung:'samsung.com',lg:'lg.com',huawei:'huawei.com',xiaomi:'mi.com',msi:'msi.com',gigabyte:'gigabyte.com',framework:'frame.work',toshiba:'toshiba.com',fujitsu:'fujitsu.com',sony:'sony.com',panasonic:'panasonic.com',google:'google.com',surface:'microsoft.com',alienware:'dell.com',thinkpad:'lenovo.com',chromebook:'google.com',logitech:'logitech.com',corsair:'corsair.com',intel:'intel.com',amd:'amd.com',nvidia:'nvidia.com'};const update=()=>{const name=input.value.trim(),key=name.toLowerCase(),domain=domains[key];logo.textContent=name.slice(0,2).toUpperCase()||'BR';logo.style.backgroundImage=domain?'url(https://www.google.com/s2/favicons?domain='+domain+'&sz=64)':'';logo.classList.toggle('has-image',Boolean(domain));};input.addEventListener('input',update);update();})()</script>`
  return buildLayout('编辑设备 - 电脑租赁管理系统', body, user)
}
