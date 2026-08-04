/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getContractById, getOrderById, getDeviceById, getUserById, renderContractVariables, getContractVariableData, sanitizeRichHtml } from '../../site'
import type { Context } from 'hono'

export async function renderContractView(c: Context, contractId: string, user: any) {
  const contract = await getContractById(c, contractId)
  if (!contract) {
    return buildLayout('查看合同 - 电脑租赁管理系统', '<div class="panel"><h2>合同未找到</h2><p>您请求的合同不存在。</p></div>', user);
  }
  const order = await getOrderById(c, contract.rentalId);
  if (!user || (user.role === 'CUSTOMER' && order?.userId !== user.id)) {
    return buildLayout('无权查看合同', '<div class="panel"><h2>无权查看合同</h2><p>请登录合同所属账户后查看。</p><a class="button" href="/login">登录</a></div>', user)
  }
  const device = order ? await getDeviceById(c, order.deviceId) : null;
  const customer = order ? await getUserById(c, order.userId) : null;
  const renderedContract = contract.signed_content ? sanitizeRichHtml(contract.signed_content) : renderContractVariables(contract.content, contract, order, device, customer, await getContractVariableData(c, contract, order))

  const body = `
    <div class="panel">
      <div class="section-title"><h2>租赁合同 #${contract.contractNumber}</h2><span class="section-note">查看合同详情。</span></div>
      <div class="contract-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <p><strong>状态:</strong> ${contract.status}</p>
        <p><strong>签署日期:</strong> ${contract.signedAt ?? '未签署'}</p>
      </div>
      <div class="contract-content" style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        ${renderedContract}
      </div>
      <div class="contract-actions" style="display: flex; gap: 12px;">
        <button class="button" onclick="window.print()">打印/下载PDF</button>
        ${user ? `<a class="button button-primary" href="/customer/dashboard">查看我的账户</a>` : `<a class="button button-primary" href="/register">注册账户绑定此合同</a>`}
      </div>
    </div>
  `
  return buildLayout('查看合同 - 电脑租赁管理系统', body, user);
}
