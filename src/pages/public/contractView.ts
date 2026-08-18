/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, formatMelbourneDateTime, getContractById, getOrderById, getDeviceById, getUserById, isContractFinalized, renderContractVariables, getContractVariableData } from '../../site'
import type { Context } from 'hono'

function trimContractLeadingWhitespace(html: string): string {
  return html
    .replace(/^(?:\s|<!--.*?-->)+/s, '')
    .replace(/^(?:(?:<p(?:\s[^>]*)?>\s*(?:(?:<br\s*\/?>|&nbsp;|\u00a0)\s*)*<\/p>)|<br\s*\/?>|<div(?:\s[^>]*)?>\s*<\/div>\s*)+/i, '')
    .trim()
}

export async function renderContractView(c: Context, contractId: string, user: any, printMode = false) {
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
  const internalViewer = user.role === 'ADMIN' || user.role === 'STAFF'
  const contractSource = internalViewer ? contract.content : (contract.signed_content || contract.content)
  const renderedContract = trimContractLeadingWhitespace(renderContractVariables(contractSource, contract, order, device, customer, await getContractVariableData(c, contract, order), internalViewer))
  const returnUrl = user.role === 'ADMIN' ? '/admin/contracts' : user.role === 'STAFF' ? '/staff/contracts' : order ? `/customer/orders/${order.id}` : '/customer/dashboard'

  const body = `
    <div class="contract-viewer${printMode ? ' contract-print-page' : ''}">
      <div class="contract-archive-bar"><div><span class="contract-kicker">RENTAL AGREEMENT / ARCHIVE</span><h1>租赁合同</h1><p class="contract-number">${contract.contractNumber}</p></div><span class="contract-status">${contract.status}</span></div>
      ${printMode ? '<div class="contract-print-toolbar"><button type="button" onclick="window.print()">打印合同</button><a href="/contract/view/' + contract.id + '">返回合同查看</a></div>' : `<div class="contract-toolbar"><div class="contract-toolbar__meta"><span>签署日期（墨尔本）</span><strong>${formatMelbourneDateTime(contract.signedAt) || '未签署'}</strong></div><div class="contract-toolbar__actions"><button class="button button-secondary" type="button" onclick="window.print()">打印 / 下载 PDF</button><button class="button button-secondary" type="button" onclick="document.querySelector('.a4-document')?.classList.toggle('document-zoomed')">缩放</button><a class="button button-secondary" href="${returnUrl}">返回</a></div></div>`}
      <div class="a4-document contract-content">
        ${renderedContract}
      </div>
      ${!printMode ? `${user?.accountType === 'guest' ? '<div class="page-notification page-notification--info"><strong>访客账户</strong> · 仅可查看和下载本次租赁合同，账户将在租期结束后自动失效。</div>' : ''}<div class="contract-actions">${user ? `<a class="button button-primary" href="${order ? `/customer/orders/${order.id}` : user.accountType === 'guest' ? '/customer/guest' : '/customer/dashboard'}">查看订单详情</a>` : `<a class="button button-primary" href="/register">注册账户绑定此合同</a>`}</div>` : ''}
    </div>
  `
  if (printMode) {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>打印合同 - 电脑租赁管理系统</title><link rel="stylesheet" href="/styles.css"><style>html,body{margin:0;background:#fff}.contract-print-standalone{width:210mm;min-height:297mm;margin:0 auto;padding:18mm;box-sizing:border-box;background:#fff;color:#111827}.contract-print-standalone .a4-document{width:auto;min-height:0;margin:0;padding:0;border:0;box-shadow:none;background:#fff}.contract-print-standalone .contract-print-toolbar{display:flex;justify-content:flex-end;gap:12px;margin-bottom:18px}.contract-print-standalone .contract-print-toolbar button,.contract-print-standalone .contract-print-toolbar a{padding:9px 14px;border:1px solid #c8d3dc;background:#172331;color:#fff;text-decoration:none;cursor:pointer}.contract-print-standalone .contract-print-toolbar a{background:#fff;color:#172331}@media print{.contract-print-toolbar{display:none!important}.contract-print-standalone{width:auto;min-height:0;padding:0}.contract-print-standalone .a4-document{padding:0}}</style></head><body><main class="contract-print-standalone"><div class="contract-print-toolbar"><button type="button" onclick="window.print()">打印合同</button><a href="/contract/view/${contract.id}">返回合同查看</a></div><div class="a4-document contract-content">${renderedContract}</div></main></body></html>`
  }
  return buildLayout(printMode ? '打印合同 - 电脑租赁管理系统' : '查看合同 - 电脑租赁管理系统', body, user);
}
