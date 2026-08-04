/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site';

// 通用错误页样式（内联在每个页面中）
const errorStyles = `
  <style>
    .error-page { display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 60px); padding: 40px 20px; }
    .error-card { text-align: center; max-width: 440px; width: 100%; background: var(--surface); border-radius: var(--radius-lg); padding: 48px 40px; border: 1px solid var(--border); box-shadow: var(--shadow-lg); position: relative; overflow: hidden; }
    .error-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
    .error-warning::before { background: var(--warning); }
    .error-danger::before { background: var(--danger); }
    .error-info::before { background: var(--info); }
    .error-code { font-family: var(--font-display); font-size: 5rem; font-weight: 700; line-height: 1; letter-spacing: -0.04em; margin-bottom: 16px; color: var(--text); }
    .error-icon { margin-bottom: 20px; opacity: 0.8; }
    .error-warning .error-icon { color: var(--warning); }
    .error-danger .error-icon { color: var(--danger); }
    .error-info .error-icon { color: var(--info); }
    .error-title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 600; color: var(--text); margin-bottom: 10px; letter-spacing: -0.01em; }
    .error-desc { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 28px; line-height: 1.6; }
    .error-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px; }
    .error-details { padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-tertiary); }
    @media (max-width: 480px) { .error-card { padding: 36px 24px; } .error-code { font-size: 3.5rem; } .error-title { font-size: 1.25rem; } }
  </style>
`;

export function renderNotFound() {
  const body = `
    <div class="error-page">
      <div class="error-card error-warning">
        <div class="error-code mono">404</div>
        <div class="error-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="24" cy="28" r="3" fill="currentColor"/>
            <circle cx="40" cy="28" r="3" fill="currentColor"/>
            <path d="M22 42c3-4 7-6 10-6s7 2 10 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="error-title">页面未找到</h1>
        <p class="error-desc">抱歉，您访问的页面不存在或已被移除。</p>
        <div class="error-actions">
          <a href="/" class="button">返回首页</a>
          <a href="javascript:history.back()" class="button button-secondary">返回上一页</a>
        </div>
        <div class="error-details"><span class="mono">Error: ENOENT — 资源不存在</span></div>
      </div>
    </div>
    ${errorStyles}
  `;
  return buildLayout('404 - 页面未找到', body);
}

export function renderForbidden() {
  const body = `
    <div class="error-page">
      <div class="error-card error-danger">
        <div class="error-code mono">403</div>
        <div class="error-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="24" width="48" height="32" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M22 24v-8a10 10 0 0 1 20 0v8" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="32" cy="40" r="4" fill="currentColor"/>
            <path d="M32 44v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="error-title">访问被拒绝</h1>
        <p class="error-desc">您没有权限访问此页面，请联系管理员获取相应权限。</p>
        <div class="error-actions">
          <a href="/" class="button">返回首页</a>
          <a href="javascript:history.back()" class="button button-secondary">返回上一页</a>
        </div>
        <div class="error-details"><span class="mono">Error: EACCES — 权限不足</span></div>
      </div>
    </div>
    ${errorStyles}
  `;
  return buildLayout('403 - 访问被拒绝', body);
}

export function renderServerError() {
  const body = `
    <div class="error-page">
      <div class="error-card error-danger">
        <div class="error-code mono">500</div>
        <div class="error-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <polygon points="32,8 58,52 6,52" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
            <path d="M32 28v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="32" cy="44" r="2" fill="currentColor"/>
          </svg>
        </div>
        <h1 class="error-title">服务器错误</h1>
        <p class="error-desc">服务器遇到了一些问题，请稍后重试。如持续出现此问题，请联系技术支持。</p>
        <div class="error-actions">
          <a href="javascript:location.reload()" class="button">刷新页面</a>
          <a href="/" class="button button-secondary">返回首页</a>
        </div>
        <div class="error-details"><span class="mono">Error: EINTERNAL — 服务器内部错误</span></div>
      </div>
    </div>
    ${errorStyles}
  `;
  return buildLayout('500 - 服务器错误', body);
}

export function renderUnauthorized() {
  const body = `
    <div class="error-page">
      <div class="error-card error-danger">
        <div class="error-code mono">401</div>
        <div class="error-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="8" y="24" width="48" height="32" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M22 24v-8a10 10 0 0 1 20 0v8" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="32" cy="40" r="4" fill="currentColor"/>
            <path d="M32 44v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="error-title">需要认证</h1>
        <p class="error-desc">您需要登录或提供有效凭证才能访问此页面。</p>
        <div class="error-actions">
          <a href="/login" class="button">前往登录</a>
          <a href="/" class="button button-secondary">返回首页</a>
        </div>
        <div class="error-details"><span class="mono">Error: EAUTH — 需要认证</span></div>
      </div>
    </div>
    ${errorStyles}
  `;
  return buildLayout('401 - 需要认证', body);
}

export function renderBadGateway() {
  const body = `
    <div class="error-page">
      <div class="error-card error-danger">
        <div class="error-code mono">502</div>
        <div class="error-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <polygon points="32,8 58,52 6,52" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
            <path d="M32 28v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="32" cy="44" r="2" fill="currentColor"/>
          </svg>
        </div>
        <h1 class="error-title">网关错误</h1>
        <p class="error-desc">服务器作为网关或代理，从上游服务器收到了无效的响应。请稍后重试。</p>
        <div class="error-actions">
          <a href="javascript:location.reload()" class="button">刷新页面</a>
          <a href="/" class="button button-secondary">返回首页</a>
        </div>
        <div class="error-details"><span class="mono">Error: EBADGATEWAY — 网关错误</span></div>
      </div>
    </div>
    ${errorStyles}
  `;
  return buildLayout('502 - 网关错误', body);
}

export function renderServiceUnavailable() {
  const body = `
    <div class="error-page">
      <div class="error-card error-danger">
        <div class="error-code mono">503</div>
        <div class="error-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <polygon points="32,8 58,52 6,52" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
            <path d="M32 28v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="32" cy="44" r="2" fill="currentColor"/>
          </svg>
        </div>
        <h1 class="error-title">服务不可用</h1>
        <p class="error-desc">服务器当前无法处理请求，这通常是由于临时过载或正在进行维护。请稍后重试。</p>
        <div class="error-actions">
          <a href="javascript:location.reload()" class="button">刷新页面</a>
          <a href="/" class="button button-secondary">返回首页</a>
        </div>
        <div class="error-details"><span class="mono">Error: EUNAVAIL — 服务不可用</span></div>
      </div>
    </div>
    ${errorStyles}
  `;
  return buildLayout('503 - 服务不可用', body);
}
