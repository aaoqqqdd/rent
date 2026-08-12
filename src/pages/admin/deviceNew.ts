/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site'

export function renderAdminDeviceNew(user: any) {
  const body = `
    <div class="page-header"><div><p class="section-code">ASSET INTAKE</p><h2>添加入库设备</h2><p>登记资产身份、硬件配置和租赁价格；这些资料将供员工搜索和选择设备。</p></div><a href="/admin/devices" class="button button-secondary">返回设备列表</a></div>
    <div class="panel">
      <form method="POST" action="/admin/devices/new" class="asset-editor">
        <section class="form-section"><div class="form-section-title"><span class="mono">ID</span><div><h3>设备身份</h3><p>名称用于员工端分类，资产编号和序列号用于准确搜索单台设备。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="name">设备名称</label><input class="form-control" id="name" name="name" required maxlength="120" placeholder="例如 MacBook Pro 14"></div>
            <div class="form-group"><label class="form-label" for="brand">品牌</label><div class="brand-entry"><input class="form-control" id="brand" name="brand" list="brandSuggestions" required maxlength="120" placeholder="例如 Apple"><span class="brand-logo" id="brandLogo" aria-hidden="true">BR</span></div><datalist id="brandSuggestions"><option value="Apple"><option value="Dell"><option value="HP"><option value="Lenovo"><option value="ASUS"><option value="Acer"><option value="Microsoft"><option value="Razer"><option value="Samsung"><option value="LG"></datalist><small class="form-text">输入或选择品牌，系统会自动显示品牌 Logo。</small></div>
            <div class="form-group"><label class="form-label" for="model">型号</label><input class="form-control" id="model" name="model" required maxlength="120" placeholder="例如 A2918 / Mac15,6"></div>
            <div class="form-group"><label class="form-label" for="assetTag">资产编号</label><input class="form-control mono" id="assetTag" value="保存后自动生成" readonly><small class="form-text">格式：RT-品牌缩写-6位顺序数字</small></div>
            <div class="form-group"><label class="form-label" for="serialNumber">序列号</label><input class="form-control mono" id="serialNumber" name="serialNumber" required maxlength="120" placeholder="设备唯一序列号"></div>
            <div class="form-group"><label class="form-label" for="status">初始状态</label><select class="form-control" id="status" name="status"><option value="available">可用</option><option value="maintenance">维修中</option><option value="rented">已出租</option></select></div>
          </div>
        </section>
        <section class="form-section"><div class="form-section-title"><span class="mono">SPEC</span><div><h3>硬件配置</h3><p>配置字段会直接进入员工端设备搜索。</p></div></div>
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="cpu">CPU</label><input class="form-control" id="cpu" name="cpu" maxlength="200" placeholder="例如 Apple M3 Pro 12-core"></div>
            <div class="form-group"><label class="form-label" for="ram">内存</label><input class="form-control" id="ram" name="ram" maxlength="200" placeholder="例如 18GB"></div>
            <div class="form-group"><label class="form-label" for="storage">存储</label><input class="form-control" id="storage" name="storage" maxlength="200" placeholder="例如 512GB SSD"></div>
            <div class="form-group"><label class="form-label" for="gpu">显卡</label><input class="form-control" id="gpu" name="gpu" maxlength="200" placeholder="例如 18-core GPU"></div>
            <div class="form-group"><label class="form-label" for="os">操作系统</label><input class="form-control" id="os" name="os" maxlength="200" placeholder="例如 macOS 15"></div>
          </div>
          <div class="form-group"><label class="form-label" for="description">补充描述</label><textarea class="form-control" id="description" name="description" rows="4" maxlength="2000" placeholder="屏幕尺寸、接口、外观或其他需要员工了解的信息"></textarea></div>
        </section>
        <section class="form-section"><div class="form-section-title"><span class="mono">AUD</span><div><h3>租赁价格</h3><p>价格将在建立合同时用于计算租金和押金。</p></div></div>
          <div class="grid grid-2"><div class="form-group"><label class="form-label" for="pricePerDay">日租金（AUD）</label><input class="form-control" type="number" id="pricePerDay" name="pricePerDay" min="0" step="0.01" required></div><div class="form-group"><label class="form-label" for="depositAmount">押金（AUD）</label><input class="form-control" type="number" id="depositAmount" name="depositAmount" min="0" step="0.01" required></div></div>
        </section>
        <div class="record-actions"><a href="/admin/devices" class="button button-secondary">取消</a><button type="submit" class="button button-primary">保存并入库</button></div>
      </form>
    </div><script>(()=>{const input=document.getElementById('brand'),logo=document.getElementById('brandLogo');const domains={apple:'apple.com',dell:'dell.com',hp:'hp.com',lenovo:'lenovo.com',asus:'asus.com',acer:'acer.com',microsoft:'microsoft.com',razer:'razer.com',samsung:'samsung.com',lg:'lg.com',huawei:'huawei.com',xiaomi:'mi.com',msi:'msi.com',gigabyte:'gigabyte.com',framework:'frame.work',toshiba:'toshiba.com',fujitsu:'fujitsu.com',sony:'sony.com',panasonic:'panasonic.com',google:'google.com',surface:'microsoft.com',alienware:'dell.com',thinkpad:'lenovo.com',chromebook:'google.com',logitech:'logitech.com',corsair:'corsair.com',intel:'intel.com',amd:'amd.com',nvidia:'nvidia.com'};const update=()=>{const name=input.value.trim(),key=name.toLowerCase(),domain=domains[key];logo.textContent=name.slice(0,2).toUpperCase()||'BR';logo.style.backgroundImage=domain?'url(https://www.google.com/s2/favicons?domain='+domain+'&sz=64)':'';logo.classList.toggle('has-image',Boolean(domain));};input.addEventListener('input',update);update();})()</script>`
  return buildLayout('添加入库设备 - 电脑租赁管理系统', body, user)
}
