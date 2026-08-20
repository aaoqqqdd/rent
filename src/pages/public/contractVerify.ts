/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, sanitizePlainText } from '../../site';

// Zero-PII by design: only ever pass in the six fields this page is allowed to
// show. Never pass the full Contract/Order/User objects here.
export function renderContractVerifyResult(result: {
  found: boolean
  contractNumber?: string
  statusLabel?: string
  signedDate?: string
  rentalPeriod?: string
  deviceModel?: string
  contentHash?: string
} | null) {
  const body = !result?.found ? `
    <div class="panel" style="max-width:480px;margin:40px auto;text-align:center;">
      <h2>无法验证</h2>
      <p class="section-note">合同编号或验证码不正确，或该合同不存在。请确认链接完整且未被截断。</p>
    </div>
  ` : `
    <div class="panel" style="max-width:560px;margin:40px auto;">
      <div class="section-title"><h2>合同验证结果</h2></div>
      <dl class="data-list">
        <div><dt>合同编号</dt><dd class="mono">${sanitizePlainText(result.contractNumber || '-', 60)}</dd></div>
        <div><dt>状态</dt><dd>${sanitizePlainText(result.statusLabel || '-', 40)}</dd></div>
        <div><dt>签署日期</dt><dd>${sanitizePlainText(result.signedDate || '-', 40)}</dd></div>
        <div><dt>租赁期间</dt><dd>${sanitizePlainText(result.rentalPeriod || '-', 60)}</dd></div>
        <div><dt>设备型号</dt><dd>${sanitizePlainText(result.deviceModel || '-', 100)}</dd></div>
        <div><dt>文件哈希 SHA-256</dt><dd class="mono" style="word-break:break-all;">${sanitizePlainText(result.contentHash || '-', 100)}</dd></div>
      </dl>
      <p class="section-note" style="margin-top:16px;">本页面仅用于核实合同真实性，不展示任何客户个人信息。</p>
    </div>
  `
  return buildLayout('合同验证 - 电脑租赁管理系统', body)
}
