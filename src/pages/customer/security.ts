/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderCustomerSecurity(c: Context, user: any, errorMessage?: string, successMessage?: string, loginRecords: any[] = []) {
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
  // 从数据库获取最新的用户信息
  const currentUser = await getUserById(c, user.id);
  const userToUse = currentUser || user;

  const body = `
    <div class="panel">
      <div class="section-title"><h2>安全设置</h2><span class="section-note">管理您的账户安全。</span></div>
      ${errorMessage ? `<div class="page-notification page-notification--error">${esc(errorMessage)}</div>` : ''}
      ${successMessage ? `<div class="page-notification page-notification--success">${esc(successMessage)}</div>` : ''}

      <h3>修改密码</h3>
      <form method="POST" action="/customer/security" id="passwordChangeForm">
        <div class="form-group">
          <label class="form-label" for="currentPassword">当前密码</label>
          <input type="password" id="currentPassword" name="currentPassword" class="form-control" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="newPassword">新密码</label>
          <input type="password" id="newPassword" name="newPassword" class="form-control" required minlength="10" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label class="form-label" for="confirmNewPassword">确认新密码</label>
          <input type="password" id="confirmNewPassword" name="confirmNewPassword" class="form-control" required minlength="10" autocomplete="new-password" />
        </div>
        <div id="passwordMismatchError" class="alert alert-error" style="display:none; margin-bottom: 15px;"></div>
        <button type="submit" class="button button-primary">修改密码</button>
      </form>

      <script>
        function formatPassword(input) {
          let value = input.value.replace(/\D/g, ''); // Remove non-digits
          if (value.length > 3) {
            value = value.substring(0, 3) + '-' + value.substring(3, 6);
          } else {
            value = value.substring(0, 6); // Max 6 digits if no hyphen
          }
          input.value = value;
        }

        document.addEventListener('DOMContentLoaded', function() {
          const form = document.getElementById('passwordChangeForm');
          const newPasswordInput = document.getElementById('newPassword');
          const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
          const passwordMismatchError = document.getElementById('passwordMismatchError');

          form.addEventListener('submit', function(event) {
            passwordMismatchError.style.display = 'none'; // Hide previous errors

            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            if (newPassword.length < 10) {
              passwordMismatchError.textContent = '新密码至少需要10位。';
              passwordMismatchError.style.display = 'block';
              event.preventDefault();
              return;
            }

            if (newPassword !== confirmNewPassword) {
              passwordMismatchError.textContent = '新密码和确认密码不匹配。';
              passwordMismatchError.style.display = 'block';
              event.preventDefault();
            }
          });
        });
      </script>

      <h3 style="margin-top: 40px;">登录记录</h3>
      <p>此处将显示您的近期登录活动。</p>
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>设备/浏览器</th>
            <th>IP地址</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          ${loginRecords.length ? loginRecords.map((record: any) => `<tr><td>${esc(record.created_at)}</td><td title="${esc(record.user_agent)}">${esc(String(record.user_agent || '未知设备').slice(0, 80))}</td><td>${esc(record.ip_address)}</td><td><span class="badge ${record.status === 'success' ? 'badge-success' : 'badge-danger'}">${record.status === 'success' ? '成功' : '失败'}</span></td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">暂无登录记录</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  return buildLayout('安全设置 - 电脑租赁管理系统', body, userToUse);
}
