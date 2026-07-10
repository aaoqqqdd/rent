const commonStyles = `
  body {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f6f8fb;
    color: #1f2937;
  }
  * { box-sizing: border-box; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  header, footer { background: #111827; color: white; padding: 16px 24px; }
  header h1, footer p { margin: 0; }
  nav { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 12px; }
  nav a { color: white; padding: 8px 12px; background: #1f2937; border-radius: 8px; }
  main { max-width: 1040px; margin: 24px auto; padding: 0 16px; }
  .hero { background: white; padding: 28px; border-radius: 18px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
  .section { margin-top: 24px; background: white; border-radius: 18px; padding: 24px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); }
  .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
  .button { display: inline-block; padding: 12px 18px; border-radius: 9999px; background: #2563eb; color: white; border: none; cursor: pointer; }
  .button.secondary { background: #475569; }
  .form-group { margin-bottom: 16px; }
  label { display: block; margin-bottom: 8px; font-weight: 600; }
  input, select, textarea { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #d1d5db; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
  th { font-weight: 700; background: #f8fafc; }
  .status { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
  .status.online { color: #16a34a; }
  .status.pending { color: #ca8a04; }
  .status.offline { color: #dc2626; }
  .hero small { display: block; margin-top: 12px; color: #64748b; }
`

const headerNav = (links: Array<{ href: string; label: string }>) => `
  <header>
    <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
      <div>
        <h1>电脑租赁管理系统</h1>
      </div>
      <nav>${links.map((link) => `<a href="${link.href}">${link.label}</a>`).join('')}</nav>
    </div>
  </header>
`

const footer = `<footer><p>© 2026 电脑租赁管理系统</p></footer>`

export const html = {
  layout: (title: string, body: string, navLinks: Array<{ href: string; label: string }> = []) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title} · 电脑租赁</title>
    <style>${commonStyles}</style>
  </head>
  <body>
    ${headerNav(navLinks)}
    <main>
      ${body}
    </main>
    ${footer}
  </body>
</html>`,
  home: () => `
    <section class="hero">
      <h2>欢迎来到电脑租赁管理系统</h2>
      <p>面向顾客、员工与管理员的电脑租赁平台。</p>
      <div style="margin-top:24px; display:flex; flex-wrap:wrap; gap:12px;">
        <a class="button" href="/login">登录</a>
        <a class="button secondary" href="/register">注册</a>
      </div>
    </section>
    <section class="section">
      <h3>快速访问</h3>
      <div class="grid">
        <div class="card"><strong>公共页面</strong><p>登录、注册、合同签署、支付结果。</p></div>
        <div class="card"><strong>顾客页面</strong><p>仪表盘、租赁列表、我的订单、推荐与安全设置。</p></div>
        <div class="card"><strong>员工页面</strong><p>待处理订单、客户管理、租赁进度、合同管理。</p></div>
        <div class="card"><strong>管理员页面</strong><p>用户管理、订单管理、财务与系统设置。</p></div>
      </div>
    </section>
  `,
  login: () => `
    <section class="section">
      <h2>登录</h2>
      <form action="#" method="post">
        <div class="form-group"><label>账号</label><input name="account" placeholder="用户名或邮箱" /></div>
        <div class="form-group"><label>密码</label><input type="password" name="password" placeholder="请输入密码" /></div>
        <div class="form-group"><label><input type="checkbox" name="remember" /> 记住我</label></div>
        <button type="submit" class="button">登录</button>
      </form>
      <p style="margin-top:16px;"><a href="/register">还没有账号？注册</a> · <a href="/forgot-password">忘记密码？</a></p>
    </section>
  `,
  register: () => `
    <section class="section">
      <h2>注册</h2>
      <form action="#" method="post">
        <div class="form-group"><label>姓名</label><input name="name" placeholder="姓名" /></div>
        <div class="form-group"><label>邮箱</label><input type="email" name="email" placeholder="邮箱" /></div>
        <div class="form-group"><label>密码</label><input type="password" name="password" placeholder="至少8位，包含字母和数字" /></div>
        <div class="form-group"><label>确认密码</label><input type="password" name="confirmPassword" placeholder="请再次输入密码" /></div>
        <div class="form-group"><label>推荐人（选填）</label><input name="referrer" placeholder="推荐人ID或推荐码" /></div>
        <div class="form-group"><label><input type="checkbox" name="terms" /> 我已阅读并同意《用户协议》</label></div>
        <button type="submit" class="button">注册</button>
      </form>
      <p style="margin-top:16px;"><a href="/login">已有账号？去登录</a></p>
    </section>
  `,
  pageSection: (title: string, content: string) => `<section class="section"><h2>${title}</h2>${content}</section>`,
  cardGrid: (cards: Array<{ title: string; text: string; action?: { href: string; label: string } }>) => `
    <div class="grid">
      ${cards
        .map(
          (card) => `<div class="card"><h3>${card.title}</h3><p>${card.text}</p>${card.action ? `<p><a class="button" href="${card.action.href}">${card.action.label}</a></p>` : ''}</div>`
        )
        .join('')}
    </div>
  `,
}
