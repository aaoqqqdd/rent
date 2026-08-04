/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout } from '../../site';

export function renderForgotPassword(message?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 480px; text-align: center;">
        <div style="margin-bottom: 24px;">
          <img src="/public/logo.svg" alt="Logo" style="width: 64px; height: 64px;"/>
          <h2 style="margin-top: 12px;">找回密码</h2>
        </div>
        ${message ? `<div class="alert">${message}</div>` : ''}
        <form method="POST" action="/forgot-password" style="text-align: left;">
          <label class="form-label">请输入您注册时使用的邮箱</label>
          <input class="form-control" type="email" name="email" placeholder="请输入邮箱" />
          <button class="button" type="submit" style="width: 100%; margin-top: 20px;">发送重置邮件</button>
        </form>
        <p class="text-muted" style="margin-top: 20px;">已想起密码？ <a class="link-button" href="/login">去登录</a></p>
      </div>
    </div>
  `
  return buildLayout('找回密码 - 电脑租赁管理系统', body)
}
