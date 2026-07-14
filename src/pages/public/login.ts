import { buildLayout } from '../../site';

export function renderLogin(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="login-container">
        <div class="login-card">
          <div class="login-logo">PC Rental</div>
          <p class="login-subtitle">专业的电脑租赁管理系统</p>
          <form method="POST" action="/login">
            <label class="form-label">邮箱地址</label>
            <input class="form-control" name="account" placeholder="请输入邮箱地址" />
            <label class="form-label">登录密码</label>
            <input class="form-control" type="password" name="password" placeholder="请输入密码" />
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
              <label class="form-check">
                <input type="checkbox" name="remember" /> 记住我
              </label>
              <a class="link-button" href="/forgot-password">忘记密码？</a>
            </div>
            ${errorMessage ? `<div class="alert alert-danger">${errorMessage}</div>` : ''}
            <div class="alert alert-info">
              <strong>📋 测试账号信息</strong>
              <ul style="margin: 12px 0 0 20px; padding: 0;">
                <li>管理员：admin@example.com / Admin123</li>
                <li>员工：staff@example.com / Staff123</li>
                <li>客户：customer@example.com / Customer123</li>
              </ul>
            </div>
            <button class="button" type="submit" style="width: 100%;">立即登录</button>
          </form>
          <p class="text-muted" style="margin-top: 32px; text-align: center;">还没有账号？ <a class="link-button" href="/register">立即注册</a></p>
        </div>
      </div>
    </div>
  `
  return buildLayout('登录 - 电脑租赁管理系统', body)
}