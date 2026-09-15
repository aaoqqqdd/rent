/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site'
import { appendTallyQueryParameter } from '../../lib/tally'

const escapeAttribute = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))

const INQUIRY_TALLY_FORM_URL = 'https://tally.so/embed/q498Dg?alignLeft=1&hideTitle=1&transparentBackground=1&formEventsForwarding=1'

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

export function renderTallyInquiryForm() {
  const body = `<div class="page-header"><div><p class="section-code">CONTACT / INQUIRY</p><h2>整理一封询价邮件</h2><p>填写后会打开您的邮件应用，内容不会在本网站保存或发送。</p></div></div>
    <section class="panel tally-form-panel">
      <iframe data-tally-src="${escapeAttribute(INQUIRY_TALLY_FORM_URL)}" loading="lazy" width="100%" height="900" frameborder="0" marginheight="0" marginwidth="0" title="邮件咨询表单"></iframe>
    </section>
    <script src="https://tally.so/widgets/embed.js"></script>
    <script>if (window.Tally && typeof window.Tally.loadEmbeds === 'function') window.Tally.loadEmbeds();</script>`

  return buildLayout('邮件咨询 - PC Rental', body)
}
