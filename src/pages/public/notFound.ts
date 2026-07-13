import { buildLayout } from '../../site';

export function renderNotFound() {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 400px; text-align: center;">
        <img src="/public/logo.svg" alt="Logo" style="width: 64px; height: 64px; margin-bottom: 20px;"/>
        <h2>404 - 页面未找到</h2>
        <p>抱歉，您访问的页面不存在。</p>
        <a class="button button-primary" href="/">返回首页</a>
      </div>
    </div>
  `
  return buildLayout('404 - 页面未找到', body)
}