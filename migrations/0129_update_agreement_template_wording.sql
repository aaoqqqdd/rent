------------------------------------------------------------------------------
-- 协议更新通知 agreement_update：改为更简洁的条款更新通知措辞
------------------------------------------------------------------------------
UPDATE email_templates SET
  subject = '{changed_agreements}更新通知',
  body = '<h2>{changed_agreements}更新通知</h2>
<p>尊敬的 {customer_name}：</p>
<p>您好！</p>
<p>我们已更新《{changed_agreements}》，最新版本已在我们的网站相关页面公布。</p>
<p>继续使用我们的服务，即表示您接受更新后的条款。如您不同意相关更新，请停止使用相关服务，并联系我们处理后续事宜。</p>
<p>感谢您的理解与支持！</p>
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
    '<p>您好 {customer_name}：</p><p>我们已更新以下协议内容：{changed_agreements}。</p><p>最新版本已在我们网站的对应页面公布。继续使用服务即视为接受更新后的内容；如不同意，您可以联系我们并停止使用相关服务。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
    '<h2>协议内容已更新</h2>

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
    '<h2>协议内容已更新</h2><p>您好 {customer_name}：</p><p>我们更新了以下协议内容，特此通知。感谢您选择 <strong>{company_name}</strong>。</p><h3>更新详情</h3><table style="width:100%; border-collapse:collapse;"><tbody><tr><td style="padding:8px 0; color:#666;">更新内容</td><td style="padding:8px 0;"><strong>{changed_agreements}</strong></td></tr></tbody></table><p>最新版本已在我们网站的对应页面公布。继续使用服务即视为接受更新后的内容；如不同意，您可以联系我们并停止使用相关服务。如有疑问，请联系 <a href="mailto:{company_email}">{company_email}</a>。</p><p><strong>{company_name}</strong><br>{company_email}</p><hr style="border:0; border-top:1px solid #ddd; margin:24px 0;"><p style="font-size:12px; color:#888;">此邮件由系统自动发送，请勿直接回复。</p>'
  );
