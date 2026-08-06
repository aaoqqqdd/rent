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

  if (status === 'success') {
    title = paymentMethod === 'balance' ? '余额支付已完成' : '支付成功！';
    message = paymentMethod === 'balance'
      ? `已从您的账户余额即时扣除 <strong>${formatCurrency(payment?.amount ?? order?.totalAmount ?? 0)}</strong>，订单已完成付款，网站发票与收据已生成。`
      : `您的订单 <strong>#${order?.orderNo ?? '正在生成'}</strong> 已成功支付 <strong>${formatCurrency(payment?.amount ?? order?.totalAmount ?? 0)}</strong>${Number(payment?.processing_fee || 0) ? `，其中支付手续费为 ${formatCurrency(payment.processing_fee)}（仅退还押金时退回相应部分）` : ''}。网站发票与收据已生成。`;
    icon = `
      <div class="icon-wrapper success">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    `;
    cardClass = 'success';
  } else if (status === 'cancelled') {
    title = '已取消 Stripe 支付';
    message = '本次没有扣款，订单仍等待付款。您可以手动返回选择其他支付方式；页面将在 <strong id="cancelled-payment-countdown">5</strong> 秒后自动返回。';
    icon = '<div class="icon-wrapper danger">×</div>';
    cardClass = 'danger';
    buttonText = user?.role === 'CUSTOMER' ? '返回订单重新支付' : '登录后重新支付';
    buttonLink = canOpenCustomerOrder ? `/customer/orders/${orderId}` : `/login?redirect=${encodeURIComponent(`/customer/orders/${orderId}`)}`;
  } else if (status === 'bank_pending') {
    title = '银行转账等待审核';
    message = '转账资料已提交，管理员核对到账信息后会更新订单状态。银行转账不经过 Stripe，无需等待 Stripe 确认。';
    icon = '<div class="icon-wrapper">⌛</div>';
    buttonText = '查看订单与审核状态';
    buttonLink = canOpenCustomerOrder ? `/customer/orders/${orderId}` : `/login?redirect=${encodeURIComponent(`/customer/orders/${orderId}`)}`;
  } else if (status === 'fail') {
    title = '支付失败';
    message = `合同付款未能成功。请重试或选择其他支付方式。`;
    icon = `
      <div class="icon-wrapper danger">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    `;
    cardClass = 'danger';
    buttonText = '返回订单支付';
    buttonLink = canOpenCustomerOrder ? `/customer/orders/${orderId}` : `/login?redirect=${encodeURIComponent(`/customer/orders/${orderId}`)}`;
  } else {
    title = '正在确认 Stripe 支付';
    message = `Stripe 正在确认合同付款结果；确认后会生成订单编号，本页面会自动刷新。`;
    icon = '<div class="icon-wrapper" style="background:#e0f2fe;color:#0369a1;">…</div>';
    cardClass = '';
    buttonText = '刷新支付状态';
    buttonLink = `/payment/result?orderId=${encodeURIComponent(orderId)}`;
  }

  const body = `
    <style>
      .payment-result-card {
        background: var(--surface);
        border-radius: var(--radius-lg);
        padding: 40px 36px;
        border: 1px solid var(--border);
        box-shadow: var(--shadow-lg);
        max-width: 480px;
        width: 100%;
        text-align: center;
      }
      .icon-wrapper {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
      }
      .icon-wrapper.success {
        background: var(--success-light);
        color: var(--success);
      }
      .icon-wrapper.danger {
        background: var(--danger-light);
        color: var(--danger);
      }
      .icon-wrapper svg {
        width: 32px;
        height: 32px;
      }
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
        gap: 12px;
        margin-top: 24px;
      }
    </style>
    <div class="page-centered">
      <div class="payment-result-card ${cardClass}">
        ${icon}
        <h2>${title}</h2>
        <p>${message}</p>
        ${contract ? `<p style="font-size: 0.85rem; color: var(--text-tertiary);">合同编号: <span class="mono">${contract.contractNumber}</span></p>` : ''}
        <div class="button-group">
          <a class="button" href="${buttonLink}">${buttonText}</a>
          ${contract ? `<a class="button button-secondary" href="/contract/view/${contract.id}">查看合同</a>` : ''}
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
    </script>` : status === 'stripe_pending' ? '<script>setTimeout(() => window.location.reload(), 3000)</script>' : ''}
  `;

  return buildLayout('支付结果 - 电脑租赁管理系统', body, user);
}
