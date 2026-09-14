import { buildLayout, sanitizePlainText } from '../../site'

export function renderUnsubscribeConfirm(token: string, email: string) {
  const body = `<div class="page-centered">
    <div class="panel" style="width: 480px; text-align: center;">
      <h2>取消订阅营销邮件</h2>
      <p>确认要取消订阅 <strong>${sanitizePlainText(email, 200)}</strong> 的营销推广邮件吗？您仍会正常收到订单、合同、付款等账户相关的重要通知邮件。</p>
      <form method="POST" action="/unsubscribe">
        <input type="hidden" name="token" value="${sanitizePlainText(token, 80)}">
        <button class="button button-primary" type="submit" style="width: 100%; margin-top: 20px;">确认取消订阅</button>
      </form>
    </div>
  </div>`
  return buildLayout('取消订阅营销邮件 - 电脑租赁管理系统', body)
}

export function renderUnsubscribeResult(message: string, success = true) {
  const body = `<div class="page-centered">
    <div class="panel" style="width: 480px; text-align: center;">
      <h2>${success ? '已取消订阅' : '链接无效'}</h2>
      <p>${sanitizePlainText(message, 300)}</p>
      <p style="margin-top:20px;"><a class="link-button" href="/">返回首页</a></p>
    </div>
  </div>`
  return buildLayout('取消订阅营销邮件 - 电脑租赁管理系统', body)
}
