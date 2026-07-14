import { buildLayout } from '../../site';

export function renderRegister(errorMessage?: string) {
  const body = `
    <div class="page-centered">
      <div class="panel" style="width: 480px; text-align: center;">
        <div style="margin-bottom: 24px;">
          <img src="/public/logo.svg" alt="Logo" style="width: 64px; height: 64px;"/>
          <h2 style="margin-top: 12px;">创建新账户</h2>
        </div>
        ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
        <form method="POST" action="/register" style="text-align: left;">
          <label class="form-label">姓名</label>
          <input class="form-control" name="name" placeholder="请输入姓名" />
          <label class="form-label">邮箱</label>
          <input class="form-control" type="email" name="email" placeholder="请输入邮箱" />
          <label class="form-label">密码</label>
          <input class="form-control" type="password" name="password" placeholder="至少8位，包含字母和数字" />
          <label class="form-label">确认密码</label>
          <input class="form-control" type="password" name="passwordConfirm" placeholder="请再次输入密码" />
          <label class="form-label">推荐人（选填）</label>
          <input class="form-control" name="referrer" placeholder="填写推荐码" />
          <div style="margin-top: 12px; margin-bottom: 20px;">
            <label class="form-check">
              <input type="checkbox" name="terms" /> 我已阅读并同意《用户协议》
            </label>
          </div>
          <button class="button" type="submit" style="width: 100%;">注册</button>
        </form>
        <p class="text-muted" style="margin-top: 20px;">已有账号？ <a class="link-button" href="/login">去登录</a></p>
      </div>
    </div>
  `
  return buildLayout('注册 - 电脑租赁管理系统', body)
}