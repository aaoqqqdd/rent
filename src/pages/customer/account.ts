import { buildLayout, getUserById, updateUser, updatePassword, bindReferrer, unbindReferrer, formatCurrency } from '../../site';

export function renderCustomerAccount(user: any, message?: string, type: 'success' | 'error' = 'error') {
  const currentUser = getUserById(user.id); // Re-fetch user to ensure latest data

  if (!currentUser) {
    return buildLayout('我的账户 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>您的账户信息无法加载。</p></div>', user);
  }

  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : '';

  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的账户</h2><span class="section-note">管理您的个人信息、密码和推荐人。</span></div>
      ${alertMessage}

      <div class="grid grid-2">
        <div>
          <h3>账户概览</h3>
          <p><strong>账户余额:</strong> ${formatCurrency(currentUser.balance)}</p>
          <p><strong>推荐人ID:</strong> ${currentUser.referrerId ? currentUser.referrerId : '无'}</p>
        </div>
        <div>
          <h3>个人信息</h3>
          <form id="profileForm" method="POST" action="/customer/account/update-profile">
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${currentUser.name}" required />
            <label class="form-label">邮箱</label>
            <input class="form-control" type="email" name="email" value="${currentUser.email}" required />
            <label class="form-label">联系电话</label>
            <input class="form-control" name="phone" value="${currentUser.phone || ''}" />
            <label class="form-label">BSB (银行代码)</label>
            <input class="form-control" name="bsb" value="${currentUser.bsb || ''}" />
            <label class="form-label">Account Number (银行账号)</label>
            <input class="form-control" name="account" value="${currentUser.account || ''}" />
            <button class="button button-primary" type="submit" style="margin-top: 20px;">更新个人信息</button>
          </form>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top: 40px;">
        <div>
          <h3>修改密码</h3>
          <form id="passwordForm" method="POST" action="/customer/account/update-password">
            <label class="form-label">旧密码</label>
            <input class="form-control" type="password" name="oldPassword" required />
            <label class="form-label">新密码</label>
            <input class="form-control" type="password" name="newPassword" required />
            <label class="form-label">确认新密码</label>
            <input class="form-control" type="password" name="confirmNewPassword" required />
            <button class="button button-primary" type="submit" style="margin-top: 20px;">修改密码</button>
          </form>
        </div>
        <div>
          <h3>推荐人管理</h3>
          ${currentUser.referrerId ? `
            <p>您当前的推荐人ID是: <strong>${currentUser.referrerId}</strong></p>
            <form id="unbindReferrerForm" method="POST" action="/customer/account/unbind-referrer">
              <button class="button button-danger" type="submit" style="margin-top: 20px;">解绑推荐人</button>
            </form>
          ` : `
            <form id="bindReferrerForm" method="POST" action="/customer/account/bind-referrer">
              <label class="form-label">推荐人ID</label>
              <input class="form-control" name="referrerId" required />
              <button class="button button-primary" type="submit" style="margin-top: 20px;">绑定推荐人</button>
            </form>
          `}
        </div>
      </div>
    </div>
  `;

  return buildLayout('我的账户 - 电脑租赁管理系统', body, user);
}