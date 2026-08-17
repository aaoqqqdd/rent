/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site';

export function renderRegister(errorMessage?: string, turnstileSiteKey = '') {
  const countryCodes = [
    { code: '+61', name: 'AU' },
    { code: '+86', name: 'CN' },
    { code: '+852', name: 'HK' },
    { code: '+853', name: 'MO' },
    { code: '+886', name: 'TW' }
  ];

  const countryCodeOptions = countryCodes.map(country =>
    `<option value="${country.code}">${country.name} (${country.code})</option>`
  ).join('');

  const body = `
    <div class="page-centered">
      <div class="login-container" style="max-width: 480px;">
        <div class="login-card">
          <div class="login-logo"><span class="logo-mark">▣</span>PC Rental</div>
          <p class="login-subtitle">创建您的专业设备租赁账户</p>
          <form method="POST" action="/register">
            ${errorMessage ? `<div class="page-notification page-notification--error">${errorMessage}</div>` : ''}
            <div class="grid grid-2"><div><label class="form-label" for="firstName">名 / Given name</label><input class="form-control" id="firstName" name="firstName" autocomplete="given-name" required /></div><div><label class="form-label" for="lastName">姓 / Family name</label><input class="form-control" id="lastName" name="lastName" autocomplete="family-name" required /></div></div>
            <label class="form-label">邮箱地址</label>
            <input class="form-control" type="email" name="email" placeholder="name@example.com" required />
            <label class="form-label">手机号</label>
            <div class="input-group">
              <select name="countryCode" class="form-control" style="flex: 0 0 auto; width: auto; border-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0;">
                ${countryCodeOptions}
              </select>
              <input class="form-control" type="tel" name="phone" placeholder="请输入手机号" required />
            </div>
            <label class="form-label">登录密码</label>
            <input class="form-control" type="password" name="password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s])\\S{8,}" title="至少 8 位，并同时包含字母、数字和符号" placeholder="至少 8 位，包含字母、数字和符号" autocomplete="new-password" required />
            <label class="form-label">确认密码</label>
            <input class="form-control" type="password" name="passwordConfirm" minlength="8" placeholder="请再次输入密码" autocomplete="new-password" required />
            <div class="form-group turnstile-box"><div class="cf-turnstile" data-sitekey="${turnstileSiteKey}"></div><small class="form-text">请完成安全验证后注册。</small></div>
            <label class="form-label">推荐码 (选填)</label>
            <input class="form-control" name="referrer" placeholder="来自朋友的推荐码" />
            <div class="form-row">
              <label class="form-check">
                <input type="checkbox" name="terms" required /> 我已阅读并同意 <a href="/terms" class="link-button">用户协议</a>、<a href="/service-terms" class="link-button">服务条款</a>、<a href="/privacy" class="link-button">隐私政策</a>和<a href="/refund-policy" class="link-button">退款政策</a>
              </label>
            </div>
            <button class="button" type="submit" style="width: 100%;">立即注册</button>
          </form>
          <p class="text-muted-center">已有账号？ <a class="link-button" href="/login">直接登录</a></p>
        </div>
      </div>
    </div>
  `
  return buildLayout('注册 - PC Rental', body).replace('</head>', '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></head>')
}
