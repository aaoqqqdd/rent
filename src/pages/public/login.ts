import { buildLayout } from '../../site';

export function renderLogin(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="login-container">
        <div class="login-card">
          <div class="login-logo"><span class="logo-mark">▣</span>PC Rental</div>
          <p class="login-subtitle">专业设备租赁管理平台</p>
          <form method="POST" action="/login">
            <label class="form-label">邮箱地址</label>
            <input class="form-control" name="account" placeholder="name@example.com" />
            <label class="form-label">登录密码</label>
            <input class="form-control" type="password" name="password" placeholder="••••••••" />
            <div class="form-row">
              <label class="form-check"><input type="checkbox" name="remember" /> 记住我</label>
              <a class="link-button" href="/forgot-password">忘记密码？</a>
            </div>
            ${errorMessage ? `<div class="alert alert-danger">${errorMessage}</div>` : ''}
            <div class="alert alert-info">
              <div>
                <strong style="display:block; margin-bottom:6px;">📋 测试账号</strong>
                <div class="mono" style="font-size:0.8rem; line-height:1.8;">
                  管理员: admin@example.com / Admin123<br>
                  员工: staff@example.com / Staff123<br>
                  客户: customer@example.com / Customer123
                </div>
              </div>
            </div>
            <button class="button" type="submit" style="width: 100%;">登录</button>
          </form>
          <p class="text-muted-center">还没有账号？ <a class="link-button" href="/register">立即注册</a></p>
        </div>
      </div>
    </div>
  `
  return buildLayout('登录 - PC Rental', body)
}