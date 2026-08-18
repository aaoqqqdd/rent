/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site';

export function renderForgotPassword(message?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 480px; text-align: center;">
        <div style="margin-bottom: 24px;">
          <img src="/public/logo.svg" alt="Logo" style="width: 64px; height: 64px;"/>
          <h2 style="margin-top: 12px;">找回密码</h2>
        </div>
        ${message ? `<div class="page-notification page-notification--info">${message}</div>` : ''}
        <form method="POST" action="/forgot-password" style="text-align: left;">
          <label class="form-label" for="forgot-email">请输入您注册时使用的邮箱</label>
          <input class="form-control" id="forgot-email" type="email" name="email" placeholder="请输入邮箱" autocomplete="email" required />
          <button class="button" type="submit" style="width: 100%; margin-top: 20px;">发送重置邮件</button>
        </form>
        <p class="text-muted" style="margin-top: 20px;">已想起密码？ <a class="link-button" href="/login">去登录</a></p>
      </div>
    </div>
  `
  return buildLayout('找回密码 - 电脑租赁管理系统', body)
}

export function renderResetPassword(token: string, message?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 480px; text-align: center;">
        <h2>设置新密码</h2>
        ${message ? `<div class="page-notification page-notification--error">${message}</div>` : ''}
        <form method="POST" action="/reset-password" style="text-align: left;">
          <input type="hidden" name="token" value="${token.replace(/[&<>\"']/g, '')}">
          <label class="form-label" for="reset-password">新密码</label>
          <input class="form-control" id="reset-password" type="password" name="password" minlength="8" autocomplete="new-password" required>
          <label class="form-label" for="reset-password-confirm">确认新密码</label>
          <input class="form-control" id="reset-password-confirm" type="password" name="passwordConfirm" minlength="8" autocomplete="new-password" required>
          <button class="button button-primary" type="submit" style="width: 100%; margin-top: 20px;">保存新密码</button>
        </form>
      </div>
    </div>`
  return buildLayout('重置密码 - 电脑租赁管理系统', body)
}
