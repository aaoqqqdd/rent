import { buildLayout } from '../../site.ts';

export function renderLogin(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel login-box" style="width: 400px; text-align: center;">
        <div style="margin-bottom: 24px;">
          <img src="/public/logo.svg" alt="Logo" style="width: 64px; height: 64px;"/>
          <h2 style="margin-top: 12px;">电脑租赁管理系统</h2>
        </div>
        <form method="POST" action="/login" style="text-align: left;">
          <label class="form-label">账号</label>
          <input class="form-control" name="account" placeholder="请输入邮箱或用户名" />
          <label class="form-label">密码</label>
          <input class="form-control" type="password" name="password" placeholder="请输入密码" />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; margin-bottom: 20px;">
            <label class="form-check">
              <input type="checkbox" name="remember" /> 记住我
            </label>
            <a class="link-button" href="/forgot-password">忘记密码？</a>
          </div>
          <div class="auth-notice" style="border: 1px solid #fdba74; background-color: #fff7ed; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            ${errorMessage ? `<div style="color: #c2410c; margin-bottom: 12px;">${errorMessage}</div>` : ''}
            <strong>测试账号</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0; list-style-type: disc;">
              <li>管理员：admin@example.com / Admin123</li>
              <li>员工：staff@example.com / Staff123</li>
              <li>顾客：customer@example.com / Customer123</li>
            </ul>
          </div>
          <button class="button" type="submit" style="width: 100%;">登录</button>
        </form>
        <p class="text-muted" style="margin-top: 20px;">还没有账号？ <a class="link-button" href="/register">注册</a></p>
      </div>
    </div>
  `
  return buildLayout('登录 - 电脑租赁管理系统', body)
}