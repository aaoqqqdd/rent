import { buildLayout, getUserById } from '../../site';

export function renderAdminUserEdit(user: any, targetUserId: string, errorMessage?: string) {
  const targetUser = getUserById(targetUserId)
  if (!targetUser) {
    return buildLayout('编辑用户 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>您请求的用户不存在。</p></div>', user)
  }

  const body = `
    <div class="panel">
      <div class="section-title"><h2>编辑用户 - ${targetUser.name}</h2><span class="section-note">修改用户基本资料、角色和账户信息。</span></div>
      ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
      <form method="POST" action="/admin/users/${targetUser.id}/edit">
        <div class="grid grid-2">
          <div>
            <label class="form-label">姓名</label>
            <input class="form-control" name="name" value="${targetUser.name}" />
          </div>
          <div>
            <label class="form-label">邮箱</label>
            <input class="form-control" name="email" value="${targetUser.email}" readonly />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">手机</label>
            <input class="form-control" name="phone" value="${targetUser.phone ?? ''}" />
          </div>
          <div>
            <label class="form-label">BSB</label>
            <input class="form-control" name="bsb" value="${targetUser.bsb ?? ''}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">Account</label>
            <input class="form-control" name="account" value="${targetUser.account ?? ''}" />
          </div>
          <div>
            <label class="form-label">余额</label>
            <input class="form-control" type="number" step="0.01" name="balance" value="${targetUser.balance}" />
          </div>
        </div>
        <div class="grid grid-2">
          <div>
            <label class="form-label">角色</label>
            <select class="form-control" name="role">
              <option value="CUSTOMER" ${targetUser.role === 'CUSTOMER' ? 'selected' : ''}>客户</option>
              <option value="STAFF" ${targetUser.role === 'STAFF' ? 'selected' : ''}>员工</option>
              <option value="ADMIN" ${targetUser.role === 'ADMIN' ? 'selected' : ''}>管理员</option>
            </select>
          </div>
          <div>
            <label class="form-label">新密码</label>
            <input class="form-control" type="password" name="password" placeholder="留空则保持原密码" />
          </div>
        </div>
        <div style="margin-top:20px;">
          <button class="button button-primary" type="submit">保存修改</button>
        </div>
      </form>
    </div>
  `
  return buildLayout('编辑用户 - 电脑租赁管理系统', body, user)
}