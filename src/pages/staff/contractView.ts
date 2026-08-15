/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractByOrderId, getOrderById, getUserById, getDeviceById, isContractFinalized, renderContractVariables, getContractVariableData } from '../../site'
import type { Context } from 'hono'

export async function renderStaffContractView(c: Context, user: any, orderId: string) {
  const order = await getOrderById(c, orderId);
  if (!order) {
    return buildLayout('合同查看 - 电脑租赁管理系统', `<div class="panel"><h2>订单未找到</h2><p>指定的订单不存在。</p></div>`, user);
  }

  const contract = await getContractByOrderId(c, orderId);
  if (!contract) {
    return buildLayout('合同查看 - 电脑租赁管理系统', `<div class="panel"><h2>合同未找到</h2><p>该订单没有关联的合同。</p></div>`, user);
  }
  if (user.role !== 'ADMIN' && (contract.createdBy || contract.created_by) !== user.id) {
    return buildLayout('无权查看合同', '<div class="panel"><h2>无权查看合同</h2><p>员工只能查看自己创建的合同。</p></div>', user)
  }

  if (!isContractFinalized(contract)) {
    return buildLayout('正式合同尚未生成', '<div class="panel"><h2>正式合同尚未生成</h2><p>客户完成电子签署后，员工才可查看和下载合同。</p><a class="button button-secondary" href="/staff/contracts">返回合同管理</a></div>', user)
  }

  const customer = await getUserById(c, order.userId);
  const device = await getDeviceById(c, order.deviceId)
  const renderedContract = renderContractVariables(contract.signed_content || contract.content, contract, order, device, customer, await getContractVariableData(c, contract, order), true)

  // 客户信息脱敏处理
  const maskedCustomerName = customer ? `${customer.name.charAt(0)}**` : '未知';
  const maskedCustomerEmail = customer ? `${customer.email.substring(0, 3)}***@***.com` : '未知';
  const maskedCustomerPhone = customer && customer.phone ? `${customer.phone.substring(0, 3)}****${customer.phone.substring(7, 11)}` : '未知';
  const maskedCustomerBsb = customer && customer.bsb ? `***-***` : 'N/A';
  const maskedCustomerAccount = customer && customer.accountNumber ? `****${customer.accountNumber.substring(customer.accountNumber.length - 4)}` : 'N/A';

  const body = `
    <div class="panel contract-viewer">
      <div class="contract-toolbar"><strong>租赁合同 #${contract.contractNumber}</strong><span class="section-note">正式 A4 合同快照 · 订单号 ${order.orderNo}</span><button class="button button-secondary" type="button" onclick="window.print()">打印 / 下载 PDF</button><button class="button button-secondary" onclick="document.querySelector('.a4-document')?.classList.toggle('document-zoomed')">缩放</button><a class="button button-secondary" href="${user.role === 'ADMIN' ? '/admin/contracts' : '/staff/contracts'}">返回</a></div>

      <div class="contract-header">
        <h3>合同编号: ${contract.contractNumber}</h3>
        <p>状态: ${contract.status === 'signed' ? '已签署' : '待签署'}</p>
        <p>签署日期: ${contract.signedAt ? new Date(contract.signedAt).toLocaleString() : '未签署'}</p>
      </div>

      <div class="contract-section">
        <h4>客户信息 (脱敏)</h4>
        <p>姓名: ${maskedCustomerName}</p>
        <p>邮箱: ${maskedCustomerEmail}</p>
        <p>电话: ${maskedCustomerPhone}</p>
        <p>BSB: ${maskedCustomerBsb}</p>
        <p>Account: ${maskedCustomerAccount}</p>
      </div>

      <div class="contract-section">
        <h4>租赁详情</h4>
        <p>设备: ${order.deviceName}</p>
        <p>租期: ${order.startDate} 至 ${order.endDate} (${order.rentalPeriod} 天)</p>
        <p>租金: $${order.totalAmount}</p>
        <p>押金: $${order.depositAmount}</p>
      </div>

      <div class="a4-document contract-section contract-content">
        <h4>合同内容</h4>
        <div class="contract-text">
          ${renderedContract}
        </div>
      </div>

      <div class="contract-actions">
        <button class="button button-primary" onclick="window.print()">打印/下载PDF</button>
        <a class="button button-info" href="/staff/contracts">返回合同管理</a>
      </div>
    </div>
  `;

  return buildLayout('合同查看 - 电脑租赁管理系统', body, user);
}
