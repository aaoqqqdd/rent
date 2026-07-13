import { buildLayout } from '../../site';

export function renderAdminUserNew(user: any, errorMessage?: string) {
  const body = `
    <div class="panel">
      <div class="section-title"><h2>添加新用户</h2><span class="section-note">创建新的系统用户并分配角色。</span></div>
      ${errorMessage ? `<div class="alert">${errorMessage}</div>` : ''}
      <form method="POST" action="/admin/users/new">
        <label class="form-label">姓名</label>
        <input class="form-control" name="name" placeholder="请输入姓名" />
        <label class="form-label">邮箱</label>
        <input class="form-control" type="email" name="email" placeholder="请输入邮箱" />
        <label class="form-label">密码</label>
        <input class="form-control" type="password" name="password" placeholder="至少8位，包含字母和数字" />
        <label class="form-label">角色</label>
        <select class="form-control" name="role">
          <option value="customer">客户</option>
          <option value="staff">员工</option>
          <option value="admin">管理员</option>
        </select>
        <button class="button button-primary" type="submit" style="margin-top: 20px;">添加用户</button>
      </form>
    </div>
  `
  return buildLayout('添加新用户 - 电脑租赁管理系统', body, user)
}