export const html = {
  layout: (title: string, body: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>body{font-family:system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial; padding:24px}</style>
  </head>
  <body>
    <header><h1>电脑租赁管理系统</h1></header>
    <main>${body}</main>
  </body>
</html>`,
  home: () => `<p>欢迎使用电脑租赁系统。<a href="/login">登录</a> · <a href="/register">注册</a></p>`,
  login: () => `
    <h2>登录</h2>
    <form action="/api/auth/login" method="post">
      <div>账号: <input name="account"/></div>
      <div>密码: <input name="password" type="password"/></div>
      <div><button type="submit">登录</button></div>
    </form>
  `,
  register: () => `
    <h2>注册</h2>
    <form action="/api/auth/register" method="post">
      <div>姓名: <input name="name"/></div>
      <div>邮箱: <input name="email"/></div>
      <div>密码: <input name="password" type="password"/></div>
      <div><button type="submit">注册</button></div>
    </form>
  `,
}
