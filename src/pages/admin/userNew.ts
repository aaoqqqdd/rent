import { buildLayout } from '../../site';

export function renderAdminUserNew(user: any) {
  const body = `
    <div class="panel hero" style="padding: 32px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 32px;">👤</div>
        <div>
          <h2 style="margin: 0 0 8px 0;">添加新用户</h2>
          <p style="margin: 0; opacity: 0.9;">创建一个新的系统用户账号，分配角色和权限</p>
        </div>
      </div>
    </div>
    <div class="panel">
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; color: #15803d;">💡 角色说明</h3>
        <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #166534; font-size: 0.95rem;">
          <li><strong>CUSTOMER（客户）</strong> - 普通用户，只能租赁设备和查看自己的订单</li>
          <li><strong>STAFF（员工）</strong> - 可以管理订单、合同和设备</li>
          <li><strong>ADMIN（管理员）</strong> - 拥有系统所有权限，包括用户管理和系统设置</li>
        </ul>
      </div>
      <form method="POST" action="/admin/users/create" class="form-grid" style="gap: 24px;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
          <div class="form-group" style="margin: 0;">
            <label for="name" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">👤 用户姓名</label>
            <input type="text" id="name" name="name" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="请输入用户姓名">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="email" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">📧 邮箱地址</label>
            <input type="email" id="email" name="email" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="example@email.com">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
          <div class="form-group" style="margin: 0;">
            <label for="password" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">🔒 登录密码</label>
            <input type="password" id="password" name="password" required style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'" placeholder="请设置登录密码">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="role" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">🎭 用户角色</label>
            <select id="role" name="role" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none; background: white;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
              <option value="CUSTOMER" selected>👥 CUSTOMER - 客户</option>
              <option value="STAFF">👔 STAFF - 员工</option>
              <option value="ADMIN">⚡ ADMIN - 管理员</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin: 0;">
          <label for="status" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">🚀 账号状态</label>
          <select id="status" name="status" style="width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 1rem; transition: all 0.2s; outline: none; background: white;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
            <option value="active" selected>✅ active - 启用</option>
            <option value="inactive">❌ inactive - 禁用</option>
          </select>
        </div>
        <div style="display: flex; gap: 16px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <a href="/admin/users" class="button button-secondary" style="padding: 12px 32px; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">← 返回用户列表</a>
          <button type="submit" class="button button-primary" style="padding: 12px 32px; border-radius: 10px; font-weight: 600; font-size: 1rem; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 14px 0 rgba(59,130,246,0.4);">✅ 创建用户</button>
        </div>
      </form>
    </div>
  `;

  return buildLayout('添加新用户 - 电脑租赁管理系统', body, user);
}