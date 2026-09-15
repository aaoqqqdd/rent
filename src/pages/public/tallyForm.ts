/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site'
import { appendTallyQueryParameter } from '../../lib/tally'

const escapeAttribute = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))

export function renderTallyForm(tallyFormUrl = '', feedbackToken = '') {
  const embedUrl = tallyFormUrl && feedbackToken
    ? appendTallyQueryParameter(tallyFormUrl, 'feedbackToken', feedbackToken)
    : tallyFormUrl
  const body = tallyFormUrl
    ? `<div class="page-header"><div><p class="section-code">CUSTOMER / FEEDBACK</p><h2>客户反馈</h2><p>完成反馈问卷后，系统会按当前活动规则发放余额、优惠码或礼品卡等奖励。</p></div></div>
      <section class="panel tally-form-panel">
        <iframe data-tally-src="${escapeAttribute(embedUrl)}" loading="lazy" width="100%" height="520" frameborder="0" marginheight="0" marginwidth="0" title="客户反馈"></iframe>
      </section>
      <script src="https://tally.so/widgets/embed.js"></script>
      <script>if (window.Tally && typeof window.Tally.loadEmbeds === 'function') window.Tally.loadEmbeds();</script>`
    : `<div class="page-centered"><div class="login-card"><div class="login-logo">PC Rental</div><h2>客户反馈</h2><p class="login-subtitle">反馈问卷暂未开放，请稍后再试。</p></div></div>`

  return buildLayout('客户反馈 - PC Rental', body)
}
