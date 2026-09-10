-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 把所有「内置」邮件模板升级为结构化 HTML 正文（标题 / 称呼 / 详情表格 / 联系方式 /
-- 落款 / 分隔线 / 自动发送声明），与 payment_completed（付款成功）的范式一致。
--
-- 仅当某行仍是「初版占位文案」或「0114 升级版文案」时才覆盖；管理员手动改过的
-- 模板 body 不匹配，UPDATE 自动跳过，绝不覆盖人工编辑。
-- 正文只使用后台已登记的变量：{customer_name} {customer_email} {order_number}
-- {contract_number} {device_name} {start_date} {end_date} {rental_period}
-- {pickup_date} {pickup_location} {return_date} {return_location} {total_amount}
-- {deposit_amount} {refund_amount} {payment_due_date} {sign_url}
-- {verification_url} {reset_url} {changed_agreements} {company_name} {company_email}

CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  format TEXT NOT NULL DEFAULT 'markdown',
  theme_color TEXT NOT NULL DEFAULT '#f0a35b'
);

------------------------------------------------------------------------------
-- 付款成功 payment_completed —— 结构范式模板
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '付款成功 - {order_number}',
  body = '<h2>付款成功</h2>

<p>您好 {customer_name}：</p>

<p>
    您的付款已成功完成。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>付款详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">合同编号</td>
            <td style="padding:8px 0;">{contract_number}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁期间</td>
            <td style="padding:8px 0;">{start_date} 至 {end_date}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁时长</td>
            <td style="padding:8px 0;">{rental_period}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">支付金额</td>
            <td style="padding:8px 0;"><strong>{total_amount}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">押金</td>
            <td style="padding:8px 0;">{deposit_amount}</td>
        </tr>
    </tbody>
</table>

<p>
    我们已将本次付款记录到您的订单中。请保留此邮件作为付款确认记录。
</p>

<p>
    如果您对本次付款有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    感谢您选择 {company_name}。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
    如果您并未进行此笔付款，请立即联系 {company_name}。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'payment_completed'
  AND body IN (
    '您的订单 {order_number} 已完成付款。',
    '<p>您好 {customer_name}：</p><p>我们已收到您订单 <strong>{order_number}</strong> 的付款。含 GST 的税务发票可在订单详情页面查看。我们将按约定安排设备交付。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 订单已创建 order_created
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '订单已创建 - {order_number}',
  body = '<h2>订单已创建</h2>

<p>您好 {customer_name}：</p>

<p>
    您的订单已成功创建。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>订单详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">合同编号</td>
            <td style="padding:8px 0;">{contract_number}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁期间</td>
            <td style="padding:8px 0;">{start_date} 至 {end_date}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁时长</td>
            <td style="padding:8px 0;">{rental_period}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">订单金额</td>
            <td style="padding:8px 0;"><strong>{total_amount}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">押金</td>
            <td style="padding:8px 0;">{deposit_amount}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">付款截止</td>
            <td style="padding:8px 0;">{payment_due_date}</td>
        </tr>
    </tbody>
</table>

<p>
    请在 <strong>{payment_due_date}</strong> 前完成付款并电子签署租赁合同。
    取消与退款规则以我们网站公布的《取消与退款政策》为准。
</p>

<p>
    如果您对本订单有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'order_created'
  AND body IN (
    '您好 {customer_name}，您的订单 {order_number} 已创建。设备：{device_name}，租期：{start_date} 至 {end_date}。订单金额：{total_amount}。',
    '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 已创建。</p><p>设备：{device_name}<br>租期：{start_date} 至 {end_date}（{rental_period}）<br>订单金额（含 GST）：{total_amount}<br>押金：{deposit_amount}</p><p>请在 {payment_due_date} 前完成付款并电子签署租赁合同。取消与退款规则见我们网站的《取消与退款政策》。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 订单审核通过 order_approved
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '订单审核通过 - {order_number}',
  body = '<h2>订单审核通过</h2>

<p>您好 {customer_name}：</p>

<p>
    您的订单已通过审核。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>订单详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">应付金额</td>
            <td style="padding:8px 0;"><strong>{total_amount}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">付款截止</td>
            <td style="padding:8px 0;">{payment_due_date}</td>
        </tr>
    </tbody>
</table>

<p>
    请在 <strong>{payment_due_date}</strong> 前完成付款，逾期订单可能被自动取消。
</p>

<p>
    如果您对本订单有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'order_approved'
  AND body IN (
    '您好 {customer_name}，您的订单 {order_number} 已审核通过。请在 {payment_due_date} 前完成付款。',
    '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 已审核通过。请在 <strong>{payment_due_date}</strong> 前完成付款，逾期订单可能被取消。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 订单待付款 order_pending_payment
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '订单待付款 - {order_number}',
  body = '<h2>订单待付款</h2>

<p>您好 {customer_name}：</p>

<p>
    您的订单正在等待付款。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>订单详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">待付金额</td>
            <td style="padding:8px 0;"><strong>{total_amount}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">付款截止</td>
            <td style="padding:8px 0;">{payment_due_date}</td>
        </tr>
    </tbody>
</table>

<p>
    完成付款并电子签署租赁合同后，我们将安排设备交付。
</p>

<p>
    如果您对本订单有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'order_pending_payment'
  AND body IN (
    '您好 {customer_name}，您的订单 {order_number} 正等待付款。',
    '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 正等待付款。完成付款并签署租赁合同后，我们将安排设备交付。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 付款提醒 payment_reminder
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '付款提醒 - {order_number}',
  body = '<h2>付款提醒</h2>

<p>您好 {customer_name}：</p>

<p>
    我们注意到您的订单尚未完成付款。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>待付款详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">待付金额</td>
            <td style="padding:8px 0;"><strong>{total_amount}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">付款截止</td>
            <td style="padding:8px 0;">{payment_due_date}</td>
        </tr>
    </tbody>
</table>

<p>
    请在付款截止日 <strong>{payment_due_date}</strong> 前完成付款，以免订单被取消。
</p>

<p>
    如果您已完成付款或对本订单有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'payment_reminder'
  AND body IN (
    '您好 {customer_name}，您的订单 {order_number} 尚未完成付款，待付款金额为 {total_amount}。',
    '您好 {customer_name}，您的订单 {order_number} 尚未完成付款，待付款金额为 {total_amount}',
    '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 尚未完成付款，待付款金额为 <strong>{total_amount}</strong>（含 GST）。请在付款截止日 {payment_due_date} 前完成，以免订单被取消。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 合同待签署 contract_pending_sign
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '请签署租赁合同 - {contract_number}',
  body = '<h2>请签署租赁合同</h2>

<p>您好 {customer_name}：</p>

<p>
    您的租赁合同已生成，请阅读并电子签署。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>合同详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">合同编号</td>
            <td style="padding:8px 0;"><strong>{contract_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">关联订单</td>
            <td style="padding:8px 0;">{order_number}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁期间</td>
            <td style="padding:8px 0;">{start_date} 至 {end_date}</td>
        </tr>
    </tbody>
</table>

<p>
    请通过以下链接阅读并签署合同：<br>
    <a href="{sign_url}">{sign_url}</a>
</p>

<p>
    依据 1999 年《电子交易法》（Electronic Transactions Act 1999 (Cth)），
    电子签名与手写签名具有同等法律效力。签署前请仔细阅读合同全文。
</p>

<p>
    如果您对合同内容有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供合同编号 <strong>{contract_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'contract_pending_sign'
  AND body IN (
    '您好 {customer_name}，请通过以下链接签署租赁合同：{sign_url}',
    '<p>您好 {customer_name}：</p><p>您的租赁合同 <strong>{contract_number}</strong> 已生成，请通过以下链接阅读并电子签署：</p><p><a href="{sign_url}">{sign_url}</a></p><p>依据 1999 年《电子交易法》（Electronic Transactions Act 1999 (Cth)），电子签名与手写签名具同等效力。签署前请仔细阅读全文。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 取件提醒 pickup_reminder
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '取件提醒 - {order_number}',
  body = '<h2>取件提醒</h2>

<p>您好 {customer_name}：</p>

<p>
    您的设备已准备就绪，请按下方安排取件。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>取件详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">取件日期</td>
            <td style="padding:8px 0;"><strong>{pickup_date}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">取件地点</td>
            <td style="padding:8px 0;">{pickup_location}</td>
        </tr>
    </tbody>
</table>

<p>
    取件时请当场检查设备外观与功能并确认无误。
</p>

<p>
    如果您需要调整取件时间，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'pickup_reminder'
  AND body IN (
    '您好 {customer_name}，请于 {pickup_date} 到 {pickup_location} 取件。设备：{device_name}。',
    '<p>您好 {customer_name}：</p><p>请于 <strong>{pickup_date}</strong> 到 <strong>{pickup_location}</strong> 领取设备：{device_name}。</p><p>取件时请当场检查设备状况并确认。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 归还提醒 return_reminder
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '设备归还提醒 - {order_number}',
  body = '<h2>设备归还提醒</h2>

<p>您好 {customer_name}：</p>

<p>
    您的租期即将到期，请按下方安排归还设备。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>归还详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">应归还日期</td>
            <td style="padding:8px 0;"><strong>{return_date}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">归还地点</td>
            <td style="padding:8px 0;">{return_location}</td>
        </tr>
    </tbody>
</table>

<p>
    请按约定日期将设备连同全部配件归还。逾期归还将按租赁协议约定的每日逾期费计收。
    如需续租，请在到期前联系我们。
</p>

<p>
    如果您对归还安排有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'return_reminder'
  AND body IN (
    '您的设备租赁即将到期，请按预约时间归还设备。',
    '<p>您好 {customer_name}：</p><p>您订单 <strong>{order_number}</strong> 的租期即将到期。请于 <strong>{return_date}</strong> 按约定方式将设备连同全部配件归还至 {return_location}。</p><p>逾期归还将按租赁协议约定的每日逾期费计收。如需续租，请在到期前联系我们。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 归还确认 return_confirmed
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '设备归还确认 - {order_number}',
  body = '<h2>设备归还确认</h2>

<p>您好 {customer_name}：</p>

<p>
    我们已确认收到您归还的设备。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>归还详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">归还日期</td>
            <td style="padding:8px 0;">{return_date}</td>
        </tr>
    </tbody>
</table>

<p>
    我们将对设备进行验机。押金结算与退款结果将另行通知，通常在 10 个营业日内完成。
</p>

<p>
    如果您对归还或押金结算有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'return_confirmed'
  AND body IN (
    '您好 {customer_name}，我们已确认收到订单 {order_number} 的设备。感谢您的使用！',
    '<p>您好 {customer_name}：</p><p>我们已确认收到订单 <strong>{order_number}</strong> 的设备，并将进行验机。押金结算与退款结果将另行通知（通常在 10 个营业日内）。</p><p>感谢您选择 {company_name}。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 退款完成 refund_completed
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '退款已处理 - {order_number}',
  body = '<h2>退款已处理</h2>

<p>您好 {customer_name}：</p>

<p>
    您的订单退款已处理完成。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>退款详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">退款金额</td>
            <td style="padding:8px 0;"><strong>{refund_amount}</strong></td>
        </tr>
    </tbody>
</table>

<p>
    信用卡退款通常在 5–10 个营业日到账，银行转账可能需要额外时间。
    本处理不影响您在《澳大利亚消费者法》下的权利。
</p>

<p>
    如果超过上述时间仍未收到退款，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'refund_completed'
  AND body IN (
    '您的订单 {order_number} 已完成退款，退款金额：{refund_amount}。',
    '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 已完成退款，退款金额：<strong>{refund_amount}</strong>（澳元 AUD）。</p><p>信用卡退款通常 5–10 个营业日到账，银行转账可能需要额外时间。本处理不影响您在《澳大利亚消费者法》下的权利。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 押金结算通知 bond_refund_statement
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '押金结算与退款 - {order_number}',
  body = '<h2>押金结算与退款</h2>

<p>您好 {customer_name}：</p>

<p>
    订单设备已完成归还与验机，押金结算如下。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>结算详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">租赁设备</td>
            <td style="padding:8px 0;">{device_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">押金</td>
            <td style="padding:8px 0;">{deposit_amount}</td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">退还金额</td>
            <td style="padding:8px 0;"><strong>{refund_amount}</strong></td>
        </tr>
    </tbody>
</table>

<p>
    如有扣款，逐项结算说明与相应凭证见订单详情页面。退款将在 10 个营业日内按您选择的方式处理。
    本结算不影响您在《澳大利亚消费者法》下的权利。
</p>

<p>
    如果您对结算结果有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'bond_refund_statement'
  AND body = '<p>您好 {customer_name}：</p><p>订单 {order_number} 的设备已完成归还与验机。押金结算如下：</p><p>押金：{deposit_amount}<br>退还金额：{refund_amount}</p><p>如有扣款，逐项结算说明与相应凭证见订单详情页面。退款将在 10 个营业日内按您选择的方式处理。</p><p>本结算不影响您在《澳大利亚消费者法》下的权利。如有疑问请回复 {company_email} 并注明订单编号。</p><p>{company_name}｜{company_address}</p>';

------------------------------------------------------------------------------
-- 税务发票已开具 tax_invoice_issued
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '税务发票 - {order_number}',
  body = '<h2>税务发票已开具</h2>

<p>您好 {customer_name}：</p>

<p>
    订单对应的税务发票（Tax Invoice）已开具。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>发票详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">订单编号</td>
            <td style="padding:8px 0;"><strong>{order_number}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">开票金额（含 GST）</td>
            <td style="padding:8px 0;"><strong>{total_amount}</strong></td>
        </tr>
    </tbody>
</table>

<p>
    您可在订单详情页面查看并下载税务发票。
</p>

<p>
    如果您对发票内容有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>，
    并提供订单编号 <strong>{order_number}</strong>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'tax_invoice_issued'
  AND body = '<p>您好 {customer_name}：</p><p>订单 {order_number} 的税务发票（Tax Invoice）已开具，金额已包含 GST。您可在订单详情页面查看并下载。</p><p>{company_name}（ABN {company_abn}）｜{company_address}｜{company_email}</p>';

------------------------------------------------------------------------------
-- 验证邮箱 email_verification
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '请验证您的邮箱 - {company_name}',
  body = '<h2>验证您的邮箱</h2>

<p>您好 {customer_name}：</p>

<p>
    感谢您注册 <strong>{company_name}</strong>。请验证您的邮箱地址以完成账户激活。
</p>

<h3>验证详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">邮箱地址</td>
            <td style="padding:8px 0;"><strong>{customer_email}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">链接有效期</td>
            <td style="padding:8px 0;">24 小时</td>
        </tr>
    </tbody>
</table>

<p>
    请点击以下链接验证您的邮箱地址：<br>
    <a href="{verification_url}">{verification_url}</a>
</p>

<p>
    如果链接已失效，请重新在网站发起验证。如需帮助，请联系
    <a href="mailto:{company_email}">{company_email}</a>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
    如果您并未注册 {company_name}，请忽略本邮件。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'email_verification'
  AND body IN (
    '您好 {customer_name}，请验证您的邮箱：{verification_url}',
    '<p>您好 {customer_name}：</p><p>感谢注册 {company_name}。请点击以下链接验证您的邮箱地址（链接 24 小时内有效）：</p><p><a href="{verification_url}">{verification_url}</a></p><p>如果这不是您本人的操作，请忽略本邮件。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 欢迎邮件 welcome_site
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '欢迎加入 {company_name}',
  body = '<h2>欢迎加入 {company_name}</h2>

<p>您好 {customer_name}：</p>

<p>
    欢迎使用 <strong>{company_name}</strong> 设备租赁服务。您的账户已创建成功。
</p>

<h3>账户信息</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">账户姓名</td>
            <td style="padding:8px 0;"><strong>{customer_name}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">登录邮箱</td>
            <td style="padding:8px 0;">{customer_email}</td>
        </tr>
    </tbody>
</table>

<p>
    您现在可以浏览设备、在线下单并电子签署租赁合同。所有价格均以澳元（AUD）标示并含 GST。
</p>

<p>
    如需帮助，请联系
    <a href="mailto:{company_email}">{company_email}</a>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'welcome_site'
  AND body IN (
    '欢迎您，{customer_name}！感谢您使用 PC Rental。',
    '<p>您好 {customer_name}：</p><p>欢迎使用 {company_name} 设备租赁服务。您现在可以浏览设备、在线下单并电子签署租赁合同。所有价格均以澳元（AUD）标示并含 GST。</p><p>如需帮助，请联系 {company_email} 或致电 {company_phone}。</p><p>{company_name}｜{company_address}</p>'
  );

------------------------------------------------------------------------------
-- 密码重置 password_reset
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '重置您的登录密码 - {company_name}',
  body = '<h2>重置登录密码</h2>

<p>您好 {customer_name}：</p>

<p>
    我们收到了重置您账户密码的请求。若非本人操作，请忽略本邮件，您的密码不会被更改。
</p>

<h3>重置详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">账户邮箱</td>
            <td style="padding:8px 0;"><strong>{customer_email}</strong></td>
        </tr>
        <tr>
            <td style="padding:8px 0; color:#666;">链接有效期</td>
            <td style="padding:8px 0;">24 小时</td>
        </tr>
    </tbody>
</table>

<p>
    请通过以下链接重置密码，链接过期后请重新申请：<br>
    <a href="{reset_url}">{reset_url}</a>
</p>

<p>
    如果您有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
    如果您并未申请重置密码，请立即联系 {company_name}。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'password_reset'
  AND body IN (
    '您好 {customer_name}，请在 24 小时内通过以下链接重置密码：{reset_url}',
    '您好 {customer_name}，请在 24 小时内通过以下链接重置密码：{reset_url}。',
    '<p>您好 {customer_name}：</p><p>我们收到了重置您账户密码的请求。请在 24 小时内通过以下链接重置（链接过期后请重新申请）：</p><p><a href="{reset_url}">{reset_url}</a></p><p>如果这不是您本人的操作，请忽略本邮件，您的密码不会被更改。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );

------------------------------------------------------------------------------
-- 协议更新通知 agreement_update
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '协议内容已更新 - {company_name}',
  body = '<h2>协议内容已更新</h2>

<p>您好 {customer_name}：</p>

<p>
    我们更新了以下协议内容，特此通知。感谢您选择 <strong>{company_name}</strong>。
</p>

<h3>更新详情</h3>

<table style="width:100%; border-collapse:collapse;">
    <tbody>
        <tr>
            <td style="padding:8px 0; color:#666;">更新内容</td>
            <td style="padding:8px 0;"><strong>{changed_agreements}</strong></td>
        </tr>
    </tbody>
</table>

<p>
    最新版本已在我们网站的对应页面公布。继续使用服务即视为接受更新后的内容；
    如不同意，您可以联系我们并停止使用相关服务。
</p>

<p>
    如果您对更新内容有任何疑问，请联系
    <a href="mailto:{company_email}">{company_email}</a>。
</p>

<p>
    <strong>{company_name}</strong><br>
    {company_email}
</p>

<hr style="border:0; border-top:1px solid #ddd; margin:24px 0;">

<p style="font-size:12px; color:#888;">
    此邮件由系统自动发送，请勿直接回复。
</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'agreement_update'
  AND body IN (
    '您好 {customer_name}，我们已更新以下协议内容：{changed_agreements}。请登录后查看最新版本。',
    '您好 {customer_name}，我们已更新以下协议内容：{changed_agreements}。请打开通知详情查看最新版本。',
    '<p>您好 {customer_name}：</p><p>我们已更新以下协议内容：{changed_agreements}。</p><p>最新版本已在我们网站的对应页面公布。继续使用服务即视为接受更新后的内容；如不同意，您可以联系我们并停止使用相关服务。</p><p>{company_name}｜{company_address}｜{company_email}</p>'
  );
