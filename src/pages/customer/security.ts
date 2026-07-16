import { buildLayout, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderCustomerSecurity(c: Context, user: any, errorMessage?: string, successMessage?: string) {
  // 从数据库获取最新的用户信息
  const currentUser = await getUserById(c, user.id);
  const userToUse = currentUser || user;
  
  const body = `
    <div class="panel">
      <div class="section-title"><h2>安全设置</h2><span class="section-note">管理您的账户安全。</span></div>
      ${errorMessage ? `<div class="alert alert-error">${errorMessage}</div>` : ''}
      ${successMessage ? `<div class="alert alert-success">${successMessage}</div>` : ''}

      <h3>修改密码</h3>
      <form method="POST" action="/customer/security">
        <div class="form-group">
          <label class="form-label" for="currentPassword">当前密码</label>
          <input type="password" id="currentPassword" name="currentPassword" class="form-control" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="newPassword">新密码</label>
          <input type="password" id="newPassword" name="newPassword" class="form-control" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="confirmNewPassword">确认新密码</label>
          <input type="password" id="confirmNewPassword" name="confirmNewPassword" class="form-control" required />
        </div>
        <button type="submit" class="button button-primary">修改密码</button>
      </form>

      <h3 style="margin-top: 40px;">登录记录</h3>
      <p>此处将显示您的近期登录活动。</p>
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>设备/浏览器</th>
            <th>IP地址</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2023-10-26 10:30:00</td>
            <td>Chrome (Mac OS)</td>
            <td>192.168.1.100</td>
            <td>成功</td>
          </tr>
          <tr>
            <td>2023-10-25 15:00:00</td>
            <td>Safari (iPhone)</td>
            <td>10.0.0.5</td>
            <td>成功</td>
          </tr>
          <!-- 更多登录记录 -->
        </tbody>
      </table>
    </div>
  `;

  return buildLayout('安全设置 - 电脑租赁管理系统', body, userToUse);
}