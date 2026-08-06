/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractById, getOrderById, getUserById, getDeviceById, formatCurrency, renderContractVariables, getContractVariableData } from '../../site';
import { Context } from 'hono';

export async function renderAdminContractDetail(c: Context, user: any, contractId: string) {
  const contract = await getContractById(c, contractId);
  if (!contract) {
    return buildLayout('合同未找到 - 电脑租赁管理系统', `<div class="panel"><h2>合同未找到</h2><p>指定的合同不存在。<a href="/admin/contracts" class="button">返回合同列表</a></div>`, user);
  }

  // 检查合同是否已过期且未签署
  const signExpiresAt = contract.signExpiresAt || contract.sign_expires_at;
  if (signExpiresAt && contract.status === 'pending_sign') {
    const now = new Date();
    const expiryDate = new Date(signExpiresAt);
    if (now > expiryDate) {
      return buildLayout('合同查看 - 电脑租赁管理系统', '<div class="panel"><h2>合同已过期</h2><p>该合同已超过签署有效期，无法查看或签署。</p></div>', user);
    }
  }

  const orderId = contract.rental_id || contract.rentalId
  const order = orderId ? await getOrderById(c, orderId) : null;
  const customer = order ? await getUserById(c, order.userId) : null;
  const device = order ? await getDeviceById(c, order.deviceId) : null
  const creator = contract.createdBy || contract.created_by ? await getUserById(c, contract.createdBy || contract.created_by || '') : null
  const renderedContract = renderContractVariables(contract.signed_content || contract.content, contract, order, device, customer, await getContractVariableData(c, contract, order), true)

  const body = `
    <div class="panel">
      <div class="section-title"><h2>合同详情</h2><span class="section-note">合同编号: ${contract.contractNumber}</span></div>

      <div class="contract-header">
        <h3>合同编号: ${contract.contractNumber}</h3>
        <p>状态: ${contract.status === 'signed' ? '已签署' : '待签署'}</p>
        <p>签署日期: ${contract.signedAt ? new Date(contract.signedAt).toLocaleString() : '未签署'}</p>
        <p>创建员工: ${creator ? `${creator.name} · ${creator.email}` : '未知'}</p>
        ${contract.content_hash ? `<p><strong>内容摘要 SHA-256：</strong><code style="word-break:break-all">${contract.content_hash}</code></p>` : ''}
      </div>

      <div class="contract-section">
        <h4>客户信息</h4>
        <p>姓名: ${customer?.name ?? '未知'}</p>
        <p>邮箱: ${customer?.email ?? '未知'}</p>
        <p>电话: ${customer?.phone ?? '未知'}</p>
        <p>BSB: ${customer?.bsb ?? 'N/A'}</p>
        <p>Account: ${customer?.account_number ?? 'N/A'}</p>
      </div>

      <div class="contract-section">
        <h4>租赁详情</h4>
        <p>订单号: ${order?.id ?? 'N/A'}</p>
        <p>租期: ${order?.start_date || order?.startDate || 'N/A'} 至 ${order?.end_date || order?.endDate || 'N/A'} (${order?.rental_period || order?.rentalPeriod || 'N/A'} 天)</p>
        <p>租金: ${formatCurrency(order?.total_amount || order?.totalAmount || 0)}</p>
        <p>押金: ${formatCurrency(order?.deposit_amount || order?.depositAmount || 0)}</p>
      </div>

      <div class="contract-section contract-content">
        <h4>合同内容</h4>
        <div class="contract-text">
          ${renderedContract}
        </div>
      </div>

      <div class="contract-actions">
        <a class="button button-secondary" href="/admin/contracts/${contract.id}/data">编辑合同变量数据</a>
        <button class="button button-primary" onclick="window.print()">打印/下载PDF</button>
        <a class="button button-info" href="/admin/contracts">返回合同管理</a>
      </div>
    </div>
  `;

  return buildLayout('合同详情 - 电脑租赁管理系统', body, user);
}
