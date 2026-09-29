/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout } from '../../site'
import { appendTallyQueryParameter } from '../../lib/tally'

const escapeAttribute = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))

const INQUIRY_TALLY_FORM_URL = 'https://tally.so/embed/q498Dg?alignLeft=1&hideTitle=1&transparentBackground=1&formEventsForwarding=1'

export function renderTallyForm(tallyFormUrl = '', feedbackToken = '') {
  let embedUrl = tallyFormUrl
  if (embedUrl) {
    embedUrl = appendTallyQueryParameter(embedUrl, 'formEventsForwarding', '1')
    if (feedbackToken) embedUrl = appendTallyQueryParameter(embedUrl, 'feedbackToken', feedbackToken)
  }
  const body = tallyFormUrl
    ? `<style>
        body:has(.feedback-shell) .desktop-header,
        body:has(.feedback-shell) .mobile-header,
        body:has(.feedback-shell) .mobile-bottom-nav,
        body:has(.feedback-shell) .legal-footer { display:none; }
        body:has(.feedback-shell) .content { max-width:none; padding:0; }
        .feedback-shell { min-height:100vh; padding:clamp(28px,6vw,88px) 20px; background:radial-gradient(circle at 86% 5%,rgba(240,163,91,.18),transparent 26rem),linear-gradient(135deg,#16222d 0%,#0d151d 100%); color:#f5f8fa; }
        .feedback-shell__inner { width:min(100%,980px); margin:0 auto; }
        .feedback-shell__brand { display:flex; align-items:center; gap:10px; margin-bottom:clamp(36px,7vw,76px); color:#b9c8d3; font:600 12px/1.2 var(--font-mono); letter-spacing:.14em; text-transform:uppercase; }
        .feedback-shell__brand::before { width:34px; height:4px; content:''; background:#f0a35b; }
        .feedback-shell__intro { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:24px; align-items:end; margin-bottom:24px; }
        .feedback-shell__eyebrow { margin:0 0 12px; color:#f0a35b; font:700 11px/1.2 var(--font-mono); letter-spacing:.16em; }
        .feedback-shell h1 { max-width:700px; margin:0; color:#fff; font:600 clamp(32px,5vw,58px)/1.04 var(--font-display); letter-spacing:-.045em; }
        .feedback-shell__intro p:not(.feedback-shell__eyebrow) { max-width:620px; margin:16px 0 0; color:#b9c8d3; font-size:16px; line-height:1.65; }
        .feedback-shell__meta { padding:11px 13px; color:#d9e3e9; border:1px solid rgba(185,200,211,.28); border-radius:999px; font:600 12px/1 var(--font-mono); white-space:nowrap; }
        .feedback-shell__form { overflow:hidden; background:#fff; border:1px solid rgba(255,255,255,.68); border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.3); }
        .feedback-shell__form iframe { display:block; width:100%; min-height:620px; border:0; }
        .feedback-shell__note { margin:18px 0 0; color:#92a5b4; font-size:13px; line-height:1.5; }
        .feedback-thanks { min-height:100vh; display:grid; place-items:center; padding:24px; background:radial-gradient(circle at 86% 5%,rgba(240,163,91,.18),transparent 26rem),linear-gradient(135deg,#16222d 0%,#0d151d 100%); }
        .feedback-thanks__card { width:min(100%,540px); padding:clamp(32px,6vw,58px); text-align:center; color:#f5f8fa; background:rgba(24,38,50,.88); border:1px solid rgba(185,200,211,.25); border-radius:18px; box-shadow:0 24px 70px rgba(0,0,0,.3); }
        .feedback-thanks__mark { display:grid; place-items:center; width:54px; height:54px; margin:0 auto 24px; color:#172331; background:#f0a35b; border-radius:50%; font-size:29px; font-weight:700; }
        .feedback-thanks h1 { margin:0; color:#fff; font:600 clamp(30px,5vw,46px)/1.05 var(--font-display); letter-spacing:-.04em; }
        .feedback-thanks p { margin:16px 0 28px; color:#b9c8d3; line-height:1.65; }
        .feedback-thanks .button { color:#172331; background:#f0a35b; border-color:#f0a35b; }
        @media (max-width:640px) { .feedback-shell__intro { display:block; } .feedback-shell__meta { display:inline-block; margin-top:20px; } .feedback-shell__form iframe { min-height:560px; } }
      </style>
      <div class="feedback-shell"><div class="feedback-shell__inner">
        <div class="feedback-shell__brand">PC Rental · Customer voice</div>
        <div class="feedback-shell__intro"><div><p class="feedback-shell__eyebrow">YOUR EXPERIENCE MATTERS</p><h1>说说这次租赁，<br>让我们做得更好。</h1><p>您的反馈会帮助我们优化设备、配送与服务体验；提交后，符合条件的奖励会自动发放到您的账户。</p></div><span class="feedback-shell__meta">约 3 分钟</span></div>
        <section class="feedback-shell__form"><iframe data-tally-src="${escapeAttribute(embedUrl)}" loading="lazy" height="620" frameborder="0" marginheight="0" marginwidth="0" title="客户反馈"></iframe></section>
        <p class="feedback-shell__note">问卷由 Tally 安全处理；请勿在反馈中填写银行卡或密码等敏感信息。</p>
      </div></div>
      <script src="https://tally.so/widgets/embed.js"></script>
      <script>window.addEventListener('Tally.FormSubmitted',function(){window.location.assign('/feedback/thanks')},{once:true});if(window.Tally&&typeof window.Tally.loadEmbeds==='function')window.Tally.loadEmbeds();</script>`
    : `<div class="page-centered"><div class="login-card"><div class="login-logo">PC Rental</div><h2>客户反馈</h2><p class="login-subtitle">反馈问卷暂未开放，请稍后再试。</p></div></div>`

  return buildLayout('客户反馈 - PC Rental', body)
}

export function renderTallyFeedbackThanks() {
  const body = `<style>
    body:has(.feedback-thanks) .desktop-header,body:has(.feedback-thanks) .mobile-header,body:has(.feedback-thanks) .mobile-bottom-nav,body:has(.feedback-thanks) .legal-footer{display:none}
    body:has(.feedback-thanks) .content{max-width:none;padding:0}
    .feedback-thanks{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 86% 5%,rgba(240,163,91,.18),transparent 26rem),linear-gradient(135deg,#16222d 0%,#0d151d 100%)}
    .feedback-thanks__card{width:min(100%,540px);padding:clamp(32px,6vw,58px);text-align:center;color:#f5f8fa;background:rgba(24,38,50,.88);border:1px solid rgba(185,200,211,.25);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.3)}
    .feedback-thanks__mark{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 24px;color:#172331;background:#f0a35b;border-radius:50%;font-size:29px;font-weight:700}
    .feedback-thanks .feedback-shell__eyebrow{margin:0 0 12px;color:#f0a35b;font:700 11px/1.2 var(--font-mono);letter-spacing:.16em}
    .feedback-thanks h1{margin:0;color:#fff;font:600 clamp(30px,5vw,46px)/1.05 var(--font-display);letter-spacing:-.04em}
    .feedback-thanks p{margin:16px 0 28px;color:#b9c8d3;line-height:1.65}.feedback-thanks .button{color:#172331;background:#f0a35b;border-color:#f0a35b}
  </style><div class="feedback-thanks"><div class="feedback-thanks__card"><div class="feedback-thanks__mark">✓</div><p class="feedback-shell__eyebrow">FEEDBACK RECEIVED</p><h1>谢谢您的反馈！</h1><p>您的问卷已成功提交。若当前活动包含反馈奖励，系统会按规则自动发放，请留意客户中心的通知。</p><a class="button button-primary" href="/customer/dashboard">返回客户中心</a></div></div>`
  return buildLayout('感谢您的反馈 - PC Rental', body)
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
