/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderCustomerProfile(c: Context, user: any, message?: string, type: 'success' | 'error' = 'error') {
  // 从数据库获取最新的用户信息
  const currentUser = await getUserById(c, user.id);
  const userToUse = currentUser || user;

  const countryCodes = [
    { code: '+61', name: 'AU' },
    { code: '+86', name: 'CN' },
    { code: '+852', name: 'HK' },
    { code: '+853', name: 'MO' },
    { code: '+886', name: 'TW' }
  ];

  const fullPhone = userToUse.phone ?? '';
  let selectedCountryCode = '';
  let localPhoneNumber = fullPhone;

  // 检查并设置默认区号
  if (!countryCodes.some(country => fullPhone.startsWith(country.code))) {
    // 如果号码不以任何已知区号开头，则默认+61，并将整个号码视为本地号码
    selectedCountryCode = '+61';
    localPhoneNumber = fullPhone;
  } else {
    for (const country of countryCodes) {
      if (fullPhone.startsWith(country.code)) {
        selectedCountryCode = country.code;
        localPhoneNumber = fullPhone.substring(country.code.length);
        break;
      }
    }
  }
  
  const countryCodeOptions = countryCodes.map(country =>
    `<option value="${country.code}" ${country.code === selectedCountryCode ? 'selected' : ''}>${country.name} (${country.code})</option>`
  ).join('');
  
  const alertMessage = message ? `<div class="page-notification page-notification--${type}">${message}</div>` : ''
  const body = `
    <div class="panel">
      <div class="section-title"><h2>个人信息管理</h2><span class="section-note">编辑您的基本资料和支付账户信息。</span></div>
      ${alertMessage}
      <form method="POST" action="/customer/profile">
        <div class="grid grid-2">
          <div>
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${userToUse.name}" />
          </div>
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${userToUse.email}" readonly />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">手机</label>
            <div class="input-group">
              <select name="countryCode" class="form-control" style="flex: 0 0 auto; width: auto; border-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0;">
                ${countryCodeOptions}
              </select>
              <input class="form-control" name="phone" value="${localPhoneNumber}" />
            </div>
          </div>
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" id="bsbInput" value="${userToUse.bsb ?? ''}" maxlength="7" inputmode="numeric" pattern="[0-9]{3}-?[0-9]{3}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${userToUse.account ?? ''}" />
          </div>
          <div>
            <label class="form-label">推荐人</label>
            <input class="form-control" name="referrerId" value="${userToUse.referrerId ?? ''}" ${userToUse.referrerId ? 'readonly' : ''} />
            <p class="form-text" style="font-size: 12px; color: #6b7280; margin-top: 4px;">绑定后禁止修改推荐人</p>
          </div>
        </div>
        <div style="margin-top:20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <button class="button" type="submit">保存修改</button>
        </div>
      </form>
    </div>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const bsbInput = document.getElementById('bsbInput');
        if (bsbInput) {
          bsbInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
            let formattedValue = '';

            if (value.length > 3) {
              formattedValue = value.substring(0, 3) + '-' + value.substring(3, 6);
            } else {
              formattedValue = value;
            }
            e.target.value = formattedValue;
          });
        }
      });
    </script>
  `
  return buildLayout('个人信息 - 电脑租赁管理系统', body, userToUse)
}
