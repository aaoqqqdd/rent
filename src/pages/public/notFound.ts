import { buildLayout, User } from '../../site';

export function renderNotFound(user?: User | null) {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 400px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 20px;">🔍</div>
        <h2>404 - 页面未找到</h2>
        <p style="margin: 16px 0 24px 0; color: var(--text-secondary);">抱歉，您访问的页面不存在。</p>
        <a class="button" href="/">返回首页</a>
      </div>
    </div>
  `
  return buildLayout('404 - 页面未找到', body, user)
}