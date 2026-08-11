/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractById, getOrderById, getDeviceById, getUserById, isContractFinalized, renderContractVariables, getContractVariableData } from '../../site'
import type { Context } from 'hono'

export async function renderContractView(c: Context, contractId: string, user: any) {
  const contract = await getContractById(c, contractId)
  if (!contract) {
    return buildLayout('查看合同 - 电脑租赁管理系统', '<div class="panel"><h2>合同未找到</h2><p>您请求的合同不存在。</p></div>', user);
  }
  const order = await getOrderById(c, contract.rentalId);
  if (!user || (user.role === 'CUSTOMER' && order?.userId !== user.id) || (user.role === 'STAFF' && (contract.createdBy || contract.created_by) !== user.id)) {
    return buildLayout('无权查看合同', '<div class="panel"><h2>无权查看合同</h2><p>请登录合同所属账户后查看。</p><a class="button" href="/login">登录</a></div>', user)
  }
  if (!isContractFinalized(contract) && user.role !== 'ADMIN') {
    return buildLayout('合同尚未生成', '<div class="panel"><h2>正式合同尚未生成</h2><p>客户完成电子签署后，合同才可查看和下载。</p></div>', user)
  }
  const device = order ? await getDeviceById(c, order.deviceId) : null;
  const customer = order ? await getUserById(c, order.userId) : null;
  const renderedContract = renderContractVariables(contract.signed_content || contract.content, contract, order, device, customer, await getContractVariableData(c, contract, order))
  const returnUrl = user.role === 'ADMIN' ? '/admin/contracts' : user.role === 'STAFF' ? '/staff/contracts' : order ? `/customer/orders/${order.id}` : '/customer/dashboard'

  const body = `
    <div class="contract-viewer">
      <div class="contract-archive-bar"><div><span class="contract-kicker">RENTAL AGREEMENT / ARCHIVE</span><h1>租赁合同</h1><p class="contract-number">${contract.contractNumber}</p></div><span class="contract-status">${contract.status}</span></div>
      <div class="contract-toolbar"><div class="contract-toolbar__meta"><span>签署日期</span><strong>${contract.signedAt ?? '未签署'}</strong></div><div class="contract-toolbar__actions"><button class="button button-secondary" type="button" onclick="window.print()">打印 / 下载 PDF</button><button class="button button-secondary" type="button" onclick="document.querySelector('.a4-document')?.classList.toggle('document-zoomed')">缩放</button><a class="button button-secondary" href="${returnUrl}">返回</a></div></div>
      <div class="a4-document contract-content">
        ${renderedContract}
      </div>
      ${user?.accountType === 'guest' ? '<div class="page-notification page-notification--info"><strong>访客账户</strong> · 仅可查看和下载本次租赁合同，账户将在租期结束后自动失效。</div>' : ''}
      <div class="contract-actions">
        ${isContractFinalized(contract) ? '<button class="button" onclick="window.print()">打印/下载 PDF</button>' : ''}
        ${user ? `<a class="button button-primary" href="${user.accountType === 'guest' ? '/customer/guest' : '/customer/dashboard'}">${user.accountType === 'guest' ? '返回访客合同中心' : '查看我的账户'}</a>` : `<a class="button button-primary" href="/register">注册账户绑定此合同</a>`}
      </div>
    </div>
  `
  return buildLayout('查看合同 - 电脑租赁管理系统', body, user);
}
