/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractById, getOrderById, getUserById } from '../../site';
import { Context } from 'hono';

export async function renderStaffContractProgress(c: Context, user: any, contractId: string) {
  const contract = await getContractById(c, contractId);
  if (!contract) {
    return buildLayout('合同签署进度 - 电脑租赁管理系统', `<div class="panel"><h2>合同未找到</h2><p>指定的合同不存在。</p></div>`, user);
  }
  if (user.role !== 'ADMIN' && (contract.createdBy || contract.created_by) !== user.id) {
    return buildLayout('无权查看合同', '<div class="panel"><h2>无权查看合同</h2><p>员工只能查看自己创建的合同。</p></div>', user)
  }

  const order = await getOrderById(c, contract.rentalId);
  const customer = order ? await getUserById(c, order.userId) : null;
  const signLink = new URL(`/contract/sign?token=${encodeURIComponent(contract.signToken || '')}&step=1`, c.req.url).toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  // 客户信息脱敏处理
  const maskedCustomerName = customer ? `${customer.name.charAt(0)}**` : '未知';
  const maskedCustomerEmail = customer ? `${customer.email.substring(0, 3)}***@***.com` : '未知';

  const body = `
    <div class="page-header"><div><p class="section-code">SIGNING STATUS</p><h2>合同签署进度</h2><p>合同 ${contract.contractNumber} 的签署状态与客户交付链接。</p></div><a class="button button-secondary" href="/staff/contracts">返回合同管理</a></div>
    <div class="panel">
      <div class="section-title"><h2>签署记录</h2><span class="section-note mono">${contract.contractNumber}</span></div>

      <div class="contract-progress-header">
        <h3>合同状态: ${
          contract.status === 'signed' ? '已签署' : 
          contract.status === 'cancelled' ? '已取消' :
          contract.status === 'draft' ? '草稿中' :
          '未查看' // pending_sign 状态下显示为未查看
        }</h3>
        <p>创建日期: ${contract.createdAt ? new Date(contract.createdAt).toLocaleString() : '未知'}</p>
        ${contract.signedAt ? `<p>签署日期: ${new Date(contract.signedAt).toLocaleString()}</p>` : ''}
      </div>

      <div class="contract-section">
        <h4>客户信息 (脱敏)</h4>
        <p>姓名: ${maskedCustomerName}</p>
        <p>邮箱: ${maskedCustomerEmail}</p>
      </div>

      ${contract.status === 'pending_sign' ? `<div class="contract-section">
        <h4>签署链接</h4>
        <p>请将以下链接发送给客户进行签署:</p>
        <div class="input-group">
          <input type="text" id="signLink" value="${signLink}" readonly class="form-control">
          <button type="button" class="button button-secondary" id="copy-sign-link">复制链接</button>
        </div>
      </div>` : ''}

      <div class="contract-actions">
        ${contract.status === 'signed' ? `<a class="button button-primary" href="/staff/contract/view?orderId=${contract.rentalId}">查看/下载合同</a><button class="button button-secondary" onclick="window.print()">打印签署记录</button>` : '<span class="section-note">正式合同将在客户完成签署后开放下载。</span>'}
      </div>
    </div>
    <div id="action-toast" class="action-toast" role="status" aria-live="polite" hidden></div>

    <script>
      (() => {
        const button = document.getElementById('copy-sign-link');
        if (!button) return;
        button.addEventListener('click', async () => {
          const field = document.getElementById('signLink');
          const toast = document.getElementById('action-toast');
          try {
            const link = field.value;
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
            else { field.value = link; field.select(); document.execCommand('copy'); }
            button.textContent = '已复制';
            toast.textContent = '签署链接已复制'; toast.dataset.state = 'success'; toast.hidden = false;
            window.setTimeout(() => { button.textContent = '复制链接'; toast.hidden = true; }, 2000);
          } catch { toast.textContent = '复制失败，请选中输入框手工复制'; toast.dataset.state = 'error'; toast.hidden = false; }
        });
      })();
    </script>
  `;

  return buildLayout('合同签署进度 - 电脑租赁管理系统', body, user);
}
