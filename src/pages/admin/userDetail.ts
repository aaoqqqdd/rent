import { buildLayout, getUserById } from '../../site';

export function renderAdminUserDetail(user: any, targetUserId: string) {
  const targetUser = getUserById(targetUserId);

  if (!targetUser) {
    return buildLayout('用户详情 - 电脑租赁管理系统', '<div class="panel"><h2>用户未找到</h2><p>您请求的用户不存在。</p></div>', user);
  }

  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>用户详情 - ${targetUser.name}</h2>
        <span class="section-note">查看和管理用户的详细信息。</span>
      </div>
      <div>
        <h3>基本信息</h3>
        <p><strong>ID:</strong> ${targetUser.id}</p>
        <p><strong>姓名:</strong> ${targetUser.name}</p>
        <p><strong>邮箱:</strong> ${targetUser.email}</p>
        <p><strong>角色:</strong> ${targetUser.role}</p>
        <p><strong>状态:</strong> ${targetUser.status}</p>
        <p><strong>注册日期:</strong> ${targetUser.registrationDate}</p>
        <p><strong>推荐人 ID:</strong> ${targetUser.referrerId || 'N/A'}</p>
        <p><strong>佣金比例:</strong> ${targetUser.commissionRate ?? '默认'}</p>
      </div>

      <div style="margin-top: 24px;">
        <h3>管理操作</h3>
        <form method="POST" action="/admin/users/${targetUser.id}/update" class="form-grid">
          <div class="form-group">
            <label for="role">角色</label>
            <select id="role" name="role">
              <option value="CUSTOMER" ${targetUser.role === 'CUSTOMER' ? 'selected' : ''}>CUSTOMER</option>
              <option value="STAFF" ${targetUser.role === 'STAFF' ? 'selected' : ''}>STAFF</option>
              <option value="ADMIN" ${targetUser.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
            </select>
          </div>
          <div class="form-group">
            <label for="status">状态</label>
            <select id="status" name="status">
              <option value="active" ${targetUser.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${targetUser.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
          <div class="form-group">
            <label for="commissionRate">佣金比例 (%)</label>
            <input type="number" id="commissionRate" name="commissionRate" min="0" max="100" step="1" value="${targetUser.commissionRate || ''}" placeholder="默认 (25%)">
          </div>
          <div class="form-group form-group-full">
            <button type="submit" class="button">更新用户</button>
          </div>
        </form>

        <form method="POST" action="/admin/users/${targetUser.id}/delete" onsubmit="return confirm('确定要删除此用户吗？此操作不可逆！');" style="margin-top: 16px;">
          <button type="submit" class="button button-danger">删除用户</button>
        </form>
      </div>
    </div>
  `;

  return buildLayout('用户详情 - 电脑租赁管理系统', body, user);
}