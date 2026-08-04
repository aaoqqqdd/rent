/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Source-available; modification, redistribution, deployment, and commercial use
 * are prohibited without prior written permission. See LICENSE. */

import { buildLayout, formatCurrency } from '../../site';
import { getOrdersWithDetailsForUser } from '../../site';
import { Context } from 'hono';

export async function renderCustomerOrders(c: Context, user: any) {
  const orders = await getOrdersWithDetailsForUser(c, user.id);
  const pendingOrders = orders.filter(order => order.status === 'pending_payment');
  const activeOrders = orders.filter(order => order.status === 'active' || order.status === 'paid' || order.status === 'approved');
  const completedOrders = orders.filter(order => order.status === 'completed');
  const cancelledOrders = orders.filter(order => order.status === 'cancelled');

  const body = `
    <div class="panel">
      <div class="section-title"><h2>我的订单</h2><span class="section-note">查看您的所有租赁订单。</span></div>

      <h3>待付款订单</h3>
      ${pendingOrders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${pendingOrders.map((order: any) => `
              <tr><td>${order.orderNo}</td><td>${order.deviceName ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">去支付</a></td></tr>
            `).join('')}
          </tbody></table>
        </div>
      ` : '<p>您目前没有待付款订单。</p>'}

      <h3 style="margin-top: 40px;">当前租赁中</h3>
      ${activeOrders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${activeOrders.map((order: any) => `
              <tr><td>${order.orderNo}</td><td>${order.deviceName ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>${order.status}</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>
            `).join('')}
          </tbody></table>
        </div>
      ` : '<p>您目前没有正在租赁的设备。</p>'}

      <h3 style="margin-top: 40px;">已完成订单</h3>
      ${completedOrders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${completedOrders.map((order: any) => `
              <tr><td>${order.orderNo}</td><td>${order.deviceName ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>已完成</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>
            `).join('')}
          </tbody></table>
        </div>
      ` : '<p>您目前没有已完成的订单。</p>'}

      <h3 style="margin-top: 40px;">已取消订单</h3>
      ${cancelledOrders.length > 0 ? `
        <div class="table-wrapper">
          <table class="table"><thead><tr><th>订单号</th><th>设备</th><th>租期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${cancelledOrders.map((order: any) => `
              <tr><td>${order.orderNo}</td><td>${order.deviceName ?? ''}</td><td>${order.startDate} ~ ${order.endDate}</td><td>${formatCurrency(order.totalAmount)}</td><td>已取消</td><td><a class="link-button" href="/customer/orders/${order.id}">查看</a></td></tr>
            `).join('')}
          </tbody></table>
        </div>
      ` : '<p>您目前没有已取消的订单。</p>'}
    </div>
  `;
  return buildLayout('我的订单 - 电脑租赁管理系统', body, user);
}
