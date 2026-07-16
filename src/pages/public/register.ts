import { buildLayout } from '../../site';

export function renderRegister(errorMessage?: string) {
  const countryCodes = [
    { code: '+61', name: 'AU' },
    { code: '+86', name: 'CN' },
    { code: '+852', name: 'HK' },
    { code: '+853', name: 'MO' },
    { code: '+886', name: 'TW' }
  ];

  const countryCodeOptions = countryCodes.map(country =>
    `<option value="${country.code}">${country.name} (${country.code})</option>`
  ).join('');

  const body = `
    <div class="page-centered">
      <div class="login-container" style="max-width: 480px;">
        <div class="login-card">
          <div class="login-logo"><span class="logo-mark">▣</span>PC Rental</div>
          <p class="login-subtitle">创建您的专业设备租赁账户</p>
          <form method="POST" action="/register">
            ${errorMessage ? `<div class="alert alert-danger">${errorMessage}</div>` : ''}
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" placeholder="请输入姓名" required />
            <label class="form-label">邮箱地址</label>
            <input class="form-control" type="email" name="email" placeholder="name@example.com" required />
            <label class="form-label">手机号</label>
            <div class="input-group">
              <select name="countryCode" class="form-control" style="flex: 0 0 auto; width: auto; border-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0;">
                ${countryCodeOptions}
              </select>
              <input class="form-control" type="tel" name="phone" placeholder="请输入手机号" required />
            </div>
            <label class="form-label">登录密码</label>
            <input class="form-control" type="password" name="password" placeholder="至少8位，包含字母和数字" required />
            <label class="form-label">确认密码</label>
            <input class="form-control" type="password" name="passwordConfirm" placeholder="请再次输入密码" required />
            <label class="form-label">推荐码 (选填)</label>
            <input class="form-control" name="referrer" placeholder="来自朋友的推荐码" />
            <div class="form-row">
              <label class="form-check">
                <input type="checkbox" name="terms" required /> 我已阅读并同意 <a href="/terms" class="link-button">用户协议</a>
              </label>
            </div>
            <button class="button" type="submit" style="width: 100%;">立即注册</button>
          </form>
          <p class="text-muted-center">已有账号？ <a class="link-button" href="/login">直接登录</a></p>
        </div>
      </div>
    </div>
  `
  return buildLayout('注册 - PC Rental', body)
}