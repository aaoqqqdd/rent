import { buildLayout, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderCustomerProfile(c: Context, user: any, message?: string, type: 'success' | 'error' = 'error') {
  // 从数据库获取最新的用户信息
  const currentUser = await getUserById(c, user.id);
  const userToUse = currentUser || user;
  
  const alertMessage = message ? `<div class="alert" style="background:${type === 'success' ? '#dcfce7' : '#fee2e2'}; border-color:${type === 'success' ? '#bbf7d0' : '#fecaca'};">${message}</div>` : ''
  const body = `
    <div class="panel">
      <div class="section-title"><h2>个人信息管理</h2><span class="section-note">编辑您的基本资料和支付账户信息。</span></div>
      ${alertMessage}
      <form method="POST" action="/customer/profile">
        <div class="grid grid-2">
          <div>
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${userToUse.name}" />
          </div>
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${userToUse.email}" readonly />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">手机</label>
            <input class="form-control" name="phone" value="${userToUse.phone ?? ''}" />
          </div>
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" id="bsbInput" value="${userToUse.bsb ?? ''}" maxlength="7" inputmode="numeric" pattern="[0-9]{3}-?[0-9]{3}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${userToUse.account ?? ''}" />
          </div>
          <div>
            <label class="form-label">推荐人</label>
            <input class="form-control" name="referrerId" value="${userToUse.referrerId ?? '无'}" ${userToUse.referrerId ? 'readonly' : ''} />
            <p class="form-text" style="font-size: 12px; color: #6b7280; margin-top: 4px;">绑定后禁止修改推荐人</p>
          </div>
        </div>
        <div style="margin-top:20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <button class="button" type="submit">保存修改</button>
        </div>
      </form>
    </div>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const bsbInput = document.getElementById('bsbInput');
        if (bsbInput) {
          bsbInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
            let formattedValue = '';

            if (value.length > 3) {
              formattedValue = value.substring(0, 3) + '-' + value.substring(3, 7);
            } else {
              formattedValue = value;
            }
            e.target.value = formattedValue;
          });
        }
      });
    </script>
  `
  return buildLayout('个人信息 - 电脑租赁管理系统', body, userToUse)
}