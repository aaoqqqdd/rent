/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site';

export function renderLogin(errorMessage?: string, showTestAccounts = false) {
  const body = `
    <div class="page-centered">
      <div class="login-container">
        <div class="login-card">
          <div class="login-logo"><span class="logo-mark">▣</span>PC Rental</div>
          <p class="login-subtitle">专业设备租赁管理平台</p>
          <form method="POST" action="/login">
            <label class="form-label">邮箱地址</label>
            <input class="form-control" name="account" placeholder="name@example.com" />
            <label class="form-label" for="login-password">登录密码</label>
            <div style="position:relative;">
              <input class="form-control" id="login-password" type="password" name="password" placeholder="••••••••" autocomplete="current-password" style="padding-right:84px;" />
              <button type="button" id="toggle-login-password" class="link-button" aria-controls="login-password" aria-label="显示密码" style="position:absolute; right:12px; top:50%; transform:translateY(-50%);">显示</button>
            </div>
            <div class="form-row">
              <label class="form-check"><input type="checkbox" name="remember" /> 记住我</label>
              <a class="link-button" href="/forgot-password">忘记密码？</a>
            </div>
            ${errorMessage ? `<div class="page-notification page-notification--error">${errorMessage}</div>` : ''}
            ${showTestAccounts ? `<div class="alert alert-info">
              <div>
                <strong style="display:block; margin-bottom:6px;">📋 测试账号</strong>
                <div class="mono" style="font-size:0.8rem; line-height:1.8;">
                  管理员: admin@example.com / Admin123<br>
                  员工: staff@example.com / Staff123<br>
                  客户: customer@example.com / Customer123
                </div>
              </div>
            </div>` : ''}
            <button class="button" type="submit" style="width: 100%;">登录</button>
          </form>
          <script>
            (() => {
              const input = document.getElementById('login-password');
              const toggle = document.getElementById('toggle-login-password');
              if (!input || !toggle) return;
              toggle.addEventListener('click', () => {
                const visible = input.type === 'text';
                input.type = visible ? 'password' : 'text';
                toggle.textContent = visible ? '显示' : '隐藏';
                toggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
              });
            })();
          </script>
          <p class="text-muted-center">还没有账号？ <a class="link-button" href="/register">立即注册</a></p>
        </div>
      </div>
    </div>
  `
  return buildLayout('登录 - PC Rental', body)
}
