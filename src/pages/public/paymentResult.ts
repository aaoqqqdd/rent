/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getOrderById, getContractByOrderId, formatCurrency } from '../../site';
import type { Context } from 'hono';

export function paymentResultState(order: any, payment: any, cancelled = false): 'cancelled' | 'success' | 'fail' | 'bank_pending' | 'stripe_pending' {
  if (cancelled) return 'cancelled'
  if (payment?.status === 'paid' || order?.status === 'paid') return 'success'
  if (payment?.status === 'failed') return 'fail'
  return order?.paymentMethod === 'bank_transfer' || order?.payment_method === 'bank_transfer' ? 'bank_pending' : 'stripe_pending'
}

export async function renderPaymentResult(c: Context, orderId: string, user: any, cancelled = false) {
  const order = await getOrderById(c, orderId);
  const contract = order ? await getContractByOrderId(c, order.id) : null;
  const paymentMethod = String(order?.paymentMethod ?? 'card')
  const payment = order ? await c.env.RENT.prepare('SELECT status, amount, processing_fee, payment_method FROM payments WHERE rental_id = ? AND payment_method = ? ORDER BY created_at DESC LIMIT 1').bind(order.id, paymentMethod).first() as any : null
  const status = paymentResultState(order, payment, cancelled)
  let title = '';
  let message = '';
  let icon = '';
  let buttonText = '查看订单详情';
  const canOpenCustomerOrder = user?.role === 'CUSTOMER' && order?.userId === user.id
  let buttonLink = canOpenCustomerOrder ? `/customer/orders/${orderId}` : `/login?redirect=${encodeURIComponent(`/customer/orders/${orderId}`)}`;
  let cardClass = '';
  const loadingSpinner = '<span class="pr-spinner" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';

  if (status === 'success') {
    title = paymentMethod === 'balance' ? '余额支付已完成' : '支付成功！';
    message = paymentMethod === 'balance'
      ? `已从您的账户余额即时扣除 <strong>${formatCurrency(payment?.amount ?? order?.totalAmount ?? 0)}</strong>，订单已完成付款，网站发票与收据已生成。`
      : `您的订单 <strong>#${order?.orderNo ?? '正在生成'}</strong> 已成功支付 <strong>${formatCurrency(payment?.amount ?? order?.totalAmount ?? 0)}</strong>${Number(payment?.processing_fee || 0) ? `，其中租金及服务费支付手续费为 ${formatCurrency(payment.processing_fee)}（不计入押金）` : ''}。网站发票与收据已生成。`;
    icon = `
      <div class="icon-wrapper success">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    `;
    cardClass = 'success';
    buttonText = '返回客户中心';
    buttonLink = user?.role === 'CUSTOMER' ? (user.accountType === 'guest' ? '/customer/guest' : '/customer/dashboard') : `/login?redirect=${encodeURIComponent('/customer/dashboard')}`;
  } else if (status === 'cancelled') {
    title = '已取消 Stripe 支付';
    message = '本次没有扣款，订单仍等待付款。您可以手动返回选择其他支付方式；页面将在 <strong id="cancelled-payment-countdown">5</strong> 秒后自动返回。';
    icon = `
      <div class="icon-wrapper danger">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    `;
    cardClass = 'danger';
    buttonText = user?.role === 'CUSTOMER' ? '返回订单重新支付' : '登录后重新支付';
    buttonLink = canOpenCustomerOrder ? `/customer/orders/${orderId}` : `/login?redirect=${encodeURIComponent(`/customer/orders/${orderId}`)}`;
  } else if (status === 'bank_pending') {
    title = '银行转账等待审核';
    message = '转账资料已提交，管理员核对到账信息后会更新订单状态。请耐心等待，审核结果会通过邮件通知您。';
    icon = `<div class="icon-wrapper is-loading" style="background:#e0f2fe;color:#0369a1;">${loadingSpinner}</div>`;
    buttonText = '查看订单与审核状态';
    buttonLink = canOpenCustomerOrder ? `/customer/orders/${orderId}` : `/login?redirect=${encodeURIComponent(`/customer/orders/${orderId}`)}`;
  } else if (status === 'fail') {
    title = '支付失败';
    message = `合同付款未能成功，订单目前仍为待付款状态。请查看订单状态，系统不会自动重复扣款；超过 24 小时仍未付款时订单会自动取消并释放设备。`;
    icon = `
      <div class="icon-wrapper danger">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    `;
    cardClass = 'danger';
    buttonText = '查看待付款订单';
    buttonLink = canOpenCustomerOrder ? `/customer/orders/${orderId}` : `/login?redirect=${encodeURIComponent(`/customer/orders/${orderId}`)}`;
  } else {
    title = '正在确认 Stripe 支付';
    message = `Stripe 正在确认合同付款结果；确认后会生成订单编号，本页面会自动刷新。`;
    icon = `<div class="icon-wrapper is-loading" style="background:#e0f2fe;color:#0369a1;">${loadingSpinner}</div>`;
    cardClass = '';
    buttonText = '刷新支付状态';
    buttonLink = `/payment/result?orderId=${encodeURIComponent(orderId)}`;
  }

  const body = `
    <style>
      /* 丝滑编排：卡片作为整体上滑（全局 site-enter），内部元素依次淡入（不位移，避免父子叠加）。 */
      .payment-result-card {
        background: var(--surface);
        border-radius: var(--radius-lg);
        padding: 44px 38px;
        border: 1px solid var(--border);
        box-shadow: var(--shadow-lg);
        max-width: 480px;
        width: 100%;
        text-align: center;
      }
      .payment-result-card > * {
        animation: pr-fade 0.6s var(--ease-out-soft, cubic-bezier(.16,1,.3,1)) both;
      }
      .payment-result-card > .icon-wrapper { animation: pr-icon 0.75s var(--ease-out-soft, cubic-bezier(.16,1,.3,1)) both; animation-delay: 0.06s; }
      .payment-result-card > h2 { animation-delay: 0.32s; }
      .payment-result-card > p { animation-delay: 0.4s; }
      .payment-result-card > p ~ p { animation-delay: 0.46s; }
      .payment-result-card > .button-group { animation-delay: 0.52s; }
      @keyframes pr-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes pr-icon {
        from { opacity: 0; transform: scale(0.8); }
        to { opacity: 1; transform: scale(1); }
      }
      .icon-wrapper {
        position: relative;
        width: 72px;
        height: 72px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        font-size: 1.6rem;
        transition: background-color 0.45s ease, color 0.45s ease;
      }
      .icon-wrapper.success { background: var(--success-light); color: var(--success); }
      .icon-wrapper.danger { background: var(--danger-light); color: var(--danger); }
      .icon-wrapper svg { width: 34px; height: 34px; }
      /* 处理中状态：图标位置显示旋转的点阵。 */
      .icon-wrapper.is-loading {
        color: #0369a1;
        background: #e0f2fe;
        animation: pr-icon 0.75s var(--ease-out-soft, cubic-bezier(.16,1,.3,1)) 0.06s both;
      }
      /* 六个圆点绕圈旋转，透明度递减形成拖尾。 */
      .pr-spinner {
        position: relative;
        display: block;
        width: 40px;
        height: 40px;
        animation: pr-spin 1s linear infinite;
      }
      .pr-spinner i {
        position: absolute;
        inset: 0;
        margin: auto;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        transition: transform 0.4s cubic-bezier(0.5, 0, 0.1, 1), opacity 0.32s ease;
      }
      .pr-spinner i:nth-child(1) { transform: rotate(0deg) translateY(-15px); opacity: 1; }
      .pr-spinner i:nth-child(2) { transform: rotate(60deg) translateY(-15px); opacity: 0.78; }
      .pr-spinner i:nth-child(3) { transform: rotate(120deg) translateY(-15px); opacity: 0.58; }
      .pr-spinner i:nth-child(4) { transform: rotate(180deg) translateY(-15px); opacity: 0.42; }
      .pr-spinner i:nth-child(5) { transform: rotate(240deg) translateY(-15px); opacity: 0.28; }
      .pr-spinner i:nth-child(6) { transform: rotate(300deg) translateY(-15px); opacity: 0.16; }
      /* 收拢态：点飞向圆心并消失，随后由对勾/叉接管。 */
      .pr-spinner.is-resolving { animation-duration: 0.3s; }
      .pr-spinner.is-resolving i { transform: translateY(0) scale(0); opacity: 0; }
      @keyframes pr-spin { to { transform: rotate(360deg); } }
      /* SPA 局部导航后 body.has-navigated 会冻结 .content 内所有动画——加载点必须继续转。 */
      body.has-navigated .payment-result-card .pr-spinner { animation: pr-spin 1s linear infinite !important; }
      /* iOS 式扩散光环：从图标向外扩散一次后淡出。 */
      .icon-wrapper.success::after,
      .icon-wrapper.danger::after {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        border: 2px solid currentColor;
        opacity: 0;
        animation: pr-ring 1s 0.5s var(--ease-out-soft, cubic-bezier(.16,1,.3,1)) forwards;
      }
      @keyframes pr-ring {
        0% { opacity: 0.45; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.45); }
      }
      /* 对勾 / 叉：描边逐笔画出。 */
      .icon-wrapper.success svg polyline,
      .icon-wrapper.danger svg line {
        stroke-dasharray: 48;
        stroke-dashoffset: 48;
        animation: pr-draw 0.5s 0.44s cubic-bezier(0.65, 0, 0.35, 1) forwards;
      }
      .icon-wrapper.danger svg line:last-of-type { animation-delay: 0.56s; }
      @keyframes pr-draw { to { stroke-dashoffset: 0; } }
      .payment-result-card h2 {
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 12px;
        color: var(--text);
      }
      .payment-result-card p {
        color: var(--text-secondary);
        font-size: 0.95rem;
        line-height: 1.6;
        margin-bottom: 24px;
      }
      .button-group {
        display: flex;
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 12px;
        margin-top: 24px;
      }
      /* 覆盖移动端 .button-group > .button { flex: 1 1 160px }，否则纵向排列时按钮会被拉成 160px 高。 */
      .button-group > .button {
        flex: 0 0 auto;
        width: 100%;
        max-width: 100%;
      }
      @media (prefers-reduced-motion: reduce) {
        .payment-result-card > *,
        .payment-result-card > .icon-wrapper,
        .icon-wrapper.is-loading { animation: none !important; }
        .icon-wrapper.success::after,
        .icon-wrapper.danger::after { display: none; }
        /* 加载指示保留缓慢旋转，否则一圈点静止不动像出错。 */
        .pr-spinner { animation: pr-spin 1.8s linear infinite !important; }
        .pr-spinner i { transition: none; }
        .icon-wrapper svg polyline,
        .icon-wrapper svg line { stroke-dashoffset: 0 !important; animation: none !important; }
      }
    </style>
    <div class="page-centered">
      <div class="payment-result-card ${cardClass}">
        ${icon}
        <h2>${title}</h2>
        <p>${message}</p>
        ${contract ? `<p style="font-size: 0.85rem; color: var(--text-tertiary);">合同编号: <span class="mono">${contract.contractNumber}</span></p>` : ''}
        <div class="button-group">
          <a class="button"${status === 'stripe_pending' || status === 'bank_pending' ? ' data-full-navigation="true"' : ''} href="${buttonLink}">${buttonText}</a>
          ${contract && order ? `<a class="button button-secondary" href="/customer/orders/${order.id}">查看订单详情</a>` : ''}
        </div>
      </div>
    </div>
    ${status === 'cancelled' ? `<script>
      (() => {
        let seconds = 5;
        const countdown = document.getElementById('cancelled-payment-countdown');
        const timer = setInterval(() => {
          seconds -= 1;
          if (countdown) countdown.textContent = String(seconds);
          if (seconds <= 0) {
            clearInterval(timer);
            window.location.href = ${JSON.stringify(buttonLink)};
          }
        }, 1000);
      })();
    </script>` : (order && status === 'stripe_pending') ? `<script>
      (function () {
        var url = ${JSON.stringify(buttonLink)};
        var card = document.querySelector('.payment-result-card');
        var wrap = card && card.querySelector('.icon-wrapper');
        if (!card || !wrap) return;
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var tries = 0, fails = 0;
        var checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        var xSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        function resolveTo(state, doc) {
          var newCard = doc.querySelector('.payment-result-card');
          var spinner = wrap.querySelector('.pr-spinner');
          if (spinner) spinner.classList.add('is-resolving');
          wrap.classList.remove('is-loading');
          wrap.removeAttribute('style');
          wrap.classList.add(state === 'success' ? 'success' : 'danger');
          var finish = function () {
            wrap.innerHTML = state === 'success' ? checkSvg : xSvg;
            Array.prototype.slice.call(card.children).forEach(function (ch) { if (ch !== wrap) ch.remove(); });
            if (newCard) {
              Array.prototype.slice.call(newCard.children).forEach(function (ch) {
                if (ch.classList && ch.classList.contains('icon-wrapper')) return;
                var clone = ch.cloneNode(true);
                clone.style.animation = 'pr-fade .5s var(--ease-out-soft, cubic-bezier(.16,1,.3,1)) both';
                card.appendChild(clone);
              });
              if (newCard.className) card.className = newCard.className;
            }
            if (doc.title) document.title = doc.title;
          };
          reduce ? finish() : setTimeout(finish, 360);
        }
        function poll() {
          tries++;
          fetch(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw 0; return r.text(); })
            .then(function (html) {
              var doc = new DOMParser().parseFromString(html, 'text/html');
              var nc = doc.querySelector('.payment-result-card');
              var cls = nc ? nc.className : '';
              if (/success/.test(cls)) return resolveTo('success', doc);
              if (/danger/.test(cls)) return resolveTo('danger', doc);
              if (tries >= 30) return window.location.reload();
              setTimeout(poll, 2000);
            })
            .catch(function () { if (++fails >= 3) return window.location.reload(); setTimeout(poll, 3000); });
        }
        setTimeout(poll, 2000);
      })();
    </script>` : (order && status === 'bank_pending') ? '<script>setTimeout(() => window.location.reload(), 20000)</script>' : ''}
    <script>
      (function () {
        var st = ${JSON.stringify(status)};
        if (st !== 'success' && st !== 'fail' && st !== 'cancelled') return;
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'payment-result', orderId: ${JSON.stringify(String(orderId || ''))}, state: st }, window.location.origin);
          }
        } catch (e) {}
        if (window.opener && !window.opener.closed) {
          var card = document.querySelector('.payment-result-card');
          if (card && !card.querySelector('.pr-opener-hint')) {
            var hint = document.createElement('p');
            hint.className = 'pr-opener-hint';
            hint.style.cssText = 'margin-top:16px;color:var(--text-tertiary);font-size:.82rem';
            hint.textContent = '支付结果已同步到上一页，可关闭此标签页继续。';
            card.appendChild(hint);
          }
        }
      })();
    </script>
  `;

  return buildLayout('支付结果 - 电脑租赁管理系统', body, user);
}
