/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site';

export function renderAdminDeviceNew(user: any) {
  const body = `
    <div class="panel hero" style="padding: 32px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 32px;">🖥️</div>
        <div>
          <h2 style="margin: 0 0 8px 0;">添加入库设备</h2>
          <p style="margin: 0; opacity: 0.9;">登记一台新的租赁设备，完善设备信息后即可上架出租</p>
        </div>
      </div>
    </div>
    <div class="panel">
      <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; color: #0369a1;">📝 设备入库提示</h3>
        <p style="margin: 0; color: #0c4a6e; font-size: 0.95rem;">请准确填写设备的所有信息，序列号将作为设备的唯一标识，日租金和押金将影响订单计算。</p>
      </div>
      <form method="POST" action="/admin/devices/new" class="form-grid" style="gap: 24px;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
          <div class="form-group" style="margin: 0;">
            <label for="name" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">💻 设备名称</label>
            <input type="text" id="name" name="name" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="例如：MacBook Pro 14寸">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="model" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">🏷️ 设备型号</label>
            <input type="text" id="model" name="model" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="例如：MKGQ3CH/A">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
          <div class="form-group" style="margin: 0;">
            <label for="serialNumber" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">🔢 序列号 (SN)</label>
            <input type="text" id="serialNumber" name="serialNumber" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none; font-family: monospace;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="输入设备唯一序列号">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="status" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">🎯 初始状态</label>
            <select id="status" name="status" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none; background: white;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
              <option value="available" selected>✅ 可用 - 可以出租</option>
              <option value="maintenance">🔧 维修中 - 暂时不可用</option>
              <option value="rented">📦 已出租</option>
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
          <div class="form-group" style="margin: 0;">
            <label for="pricePerDay" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">💰 日租金 (AUD)</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #6b7280; font-weight: 500;">AUD$</span>
              <input type="number" id="pricePerDay" name="pricePerDay" min="0" step="0.01" required style="width: 100%; padding: 12px 16px 12px 64px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="0.00">
            </div>
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="depositAmount" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">💎 押金金额 (AUD)</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #6b7280; font-weight: 500;">AUD$</span>
              <input type="number" id="depositAmount" name="depositAmount" min="0" step="0.01" required style="width: 100%; padding: 12px 16px 12px 64px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="0.00">
            </div>
          </div>
        </div>
        <div class="form-group" style="margin: 0;">
          <label for="description" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">📄 设备配置描述</label>
          <textarea id="description" name="description" rows="5" style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none; resize: vertical; min-height: 120px;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="详细描述设备的配置信息，如CPU、内存、硬盘、屏幕尺寸等..."></textarea>
        </div>
        <div style="display: flex; gap: 16px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <a href="/admin/devices" class="button button-secondary" style="padding: 12px 32px; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">← 返回设备列表</a>
          <button type="submit" class="button button-primary" style="padding: 12px 32px; border-radius: 10px; font-weight: 600; font-size: 1rem; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 14px 0 rgba(59,130,246,0.4);">✅ 确认入库</button>
        </div>
      </form>
    </div>
  `;

  return buildLayout('添加入库设备 - 电脑租赁管理系统', body, user);
}
