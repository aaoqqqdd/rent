import { buildLayout } from '../../site';

export function renderAdminUserNew(user: any) {
  const body = `
    <div class="panel">
      <div class="section-title">
        <h2>添加新用户</h2>
        <span class="section-note">创建一个新的系统用户。</span>
      </div>
      <form method="POST" action="/admin/users/create" class="form-grid">
        <div class="form-group">
          <label for="name">姓名</label>
          <input type="text" id="name" name="name" required>
        </div>
        <div class="form-group">
          <label for="email">邮箱</label>
          <input type="email" id="email" name="email" required>
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input type="password" id="password" name="password" required>
        </div>
        <div class="form-group">
          <label for="role">角色</label>
          <select id="role" name="role">
            <option value="CUSTOMER" selected>CUSTOMER</option>
            <option value="STAFF">STAFF</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div class="form-group">
          <label for="status">状态</label>
          <select id="status" name="status">
            <option value="active" selected>Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div class="form-group form-group-full">
          <button type="submit" class="button">创建用户</button>
        </div>
      </form>
    </div>
  `;

  return buildLayout('添加新用户 - 电脑租赁管理系统', body, user);
}