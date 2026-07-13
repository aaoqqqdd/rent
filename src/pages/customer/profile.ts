import { buildLayout } from '../../site';

export function renderCustomerProfile(user: any, message?: string, type: 'success' | 'error' = 'error') {
  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : ''
  const body = `
    <div class="panel">
      <div class="section-title"><h2>个人信息管理</h2><span class="section-note">编辑您的基本资料和支付账户信息。</span></div>
      ${alertMessage}
      <form method="POST" action="/customer/profile">
        <div class="grid grid-2">
          <div>
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${user.name}" />
          </div>
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${user.email}" readonly />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">手机</label>
            <input class="form-control" name="phone" value="${user.phone ?? ''}" />
          </div>
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="${user.bsb ?? ''}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${user.account ?? ''}" />
          </div>
          <div>
            <label class="form-label">推荐码</label>
            <input class="form-control" name="referralCode" value="${user.referralCode ?? ''}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">新密码</label>
            <input class="form-control" type="password" name="password" placeholder="留空则保持原密码" />
          </div>
          <div>
            <label class="form-label">确认新密码</label>
            <input class="form-control" type="password" name="passwordConfirm" placeholder="再次输入新密码" />
          </div>
        </div>
        <div style="margin-top:20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <button class="button" type="submit">保存修改</button>
          <span class="section-note">密码为空时，不会修改当前密码。</span>
        </div>
      </form>
    </div>
  `
  return buildLayout('个人信息 - 电脑租赁管理系统', body, user)
}