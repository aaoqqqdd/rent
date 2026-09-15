-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 更新隐私政策与 Cookie 政策，覆盖在线客服、反馈问卷、营销邮件及设备管理功能。
-- tawk.to 的同意弹窗、数据保留期限及账户区域设置仍以实际供应商配置为准。

INSERT INTO systemSettings (key, value) VALUES ('privacyPolicy',
'<h1>隐私政策</h1>
<p>{company_name}（ABN {company_abn}，下称「我们」）重视您的隐私。本政策说明我们在提供设备租赁、网站、客户支持及相关服务时如何收集、使用、披露和保护个人信息。本政策适用于本网站、订单与合同流程、设备管理软件（如适用）以及在线客服和反馈服务。</p>
<p><strong>版本：</strong>{privacy_policy_version}　<strong>最后更新：</strong>{privacy_policy_last_updated_date}</p>

<h2>一、我们收集的信息</h2>
<ul>
<li><strong>账户与联系信息：</strong>姓名、电子邮箱、电话号码、账户凭据、账单地址、收货地址及其他您主动提交的资料。</li>
<li><strong>身份核验信息：</strong>出生日期、核验结果、证件类型及为完成核验所需的证件识别信息。我们只在业务需要、法律允许且向您说明的范围内收集；请勿通过普通客服聊天发送完整身份证件、银行卡密码或完整支付卡资料。</li>
<li><strong>订单、合同与付款信息：</strong>订单、租期、设备、租金、押金、退款、银行转账凭证、电子签名及签署时间、IP 地址、浏览器和设备信息等签署元数据。</li>
<li><strong>网站与安全信息：</strong>IP 地址、浏览器类型、设备标识、登录和操作日志、Cookie、会话信息、Cloudflare Turnstile 验证结果，以及用于防止欺诈、滥用和未授权访问的风险信号。</li>
<li><strong>设备管理信息（如适用）：</strong>设备在线和电源状态、硬件与系统清单、软件版本、电池状态、网络信息、租期相关事件及粗略位置信息。我们可能依据租赁协议执行锁定、重启、注销或数据清除等远程操作。</li>
<li><strong>客服与争议信息：</strong>您通过电子邮件、订单页面、在线客服、电话或其他渠道提供的咨询、聊天内容、附件、投诉、损坏或验机争议资料。</li>
<li><strong>tawk.to 在线客服信息：</strong>当在线客服组件启用并被加载时，tawk.to 可能处理聊天内容、您在聊天中填写的姓名或邮箱、聊天时间、页面地址、IP 地址、浏览器和设备信息，以及其 Cookie 或浏览器存储信息。tawk.to 的数据处理详情见其<a href="https://www.tawk.to/privacy-policy/">隐私政策</a>和<a href="https://help.tawk.to/article/what-are-tawkto-cookies-and-what-do-they-do">Cookie 说明</a>。</li>
<li><strong>问卷与奖励信息：</strong>在您自愿填写 Tally 反馈问卷时，我们可能收到问卷回答、表单和回复标识，以及为发放优惠券或礼品卡所需的奖励处理记录。</li>
<li><strong>营销信息：</strong>营销同意、退订、抑制名单、发送状态、退信或错误记录。我们目前不以本系统记录营销邮件打开或点击行为。</li>
</ul>

<h2>二、我们如何收集信息</h2>
<p>我们直接从您注册、下单、付款、签署合同、提交凭证、申请支持、填写问卷或与我们沟通时收集信息；也可能通过网站日志、Cookie、安全服务和设备管理软件自动收集技术信息。若从推荐人、支付服务商或其他第三方获得信息，我们会在合理可行的情况下向您说明。</p>

<h2>三、使用个人信息的目的</h2>
<ul>
<li>创建和管理账户，核验身份并处理租赁申请；</li>
<li>订立和履行租赁合同，交付、回收和管理设备；</li>
<li>处理租金、押金、退款、发票、银行转账和财务记录；</li>
<li>提供客服、在线聊天、技术支持，处理投诉、损坏和验机争议；</li>
<li>保障网站、账户和租赁设备安全，防止欺诈、滥用、盗用和未授权访问；</li>
<li>管理反馈问卷、优惠券、推荐奖励或礼品卡；</li>
<li>在法律允许并符合适用的直接营销规则时发送营销信息；</li>
<li>履行法律、税务、会计、保险、监管和执法要求，或行使和保护我们的合法权利。</li>
</ul>

<h2>四、我们向谁披露信息</h2>
<p>我们只在提供服务、履行合同、保障安全、处理奖励或履行法律义务所必要的范围内披露信息，接收方可能包括：</p>
<ul>
<li>支付和退款服务商，例如 Stripe、Square 或您选择的银行转账渠道；</li>
<li>邮件服务商，例如 Resend；</li>
<li>在线客服服务商 tawk.to；</li>
<li>反馈问卷服务商 Tally；</li>
<li>Cloudflare（包括网站托管、安全防护和 Turnstile）、地址或地图服务商；</li>
<li>物流、维修、设备管理、保险、专业顾问、审计、追收欠款或争议处理服务商；</li>
<li>在法律要求、授权或为保护人员、财产和服务安全所必要时，向政府机构、监管机构、法院或执法机关披露。</li>
</ul>
<p>我们不会出售个人信息供第三方自行开展营销。</p>

<h2>五、tawk.to 在线客服与境外处理</h2>
<p>tawk.to 由 tawk.to, Inc. 提供。根据其公开说明，tawk.to 可能收集访客的 IP、浏览器、设备、Cookie、聊天和通信信息，并可能在美国通过 Google Cloud 等基础设施存储或处理数据，也可能由其服务商或分包处理方访问。使用在线客服即表示相关信息可能按照 tawk.to 的条款、隐私政策和我们实际启用的客服配置进行处理。</p>
<p>在线客服不是提交支付卡、密码、完整身份证件、银行账户密码或其他不必要敏感信息的渠道。若您不希望使用在线客服，请通过 {company_email} 联系我们。tawk.to 聊天记录的具体保留期限取决于我们的账户设置及 tawk.to 的服务政策；我们会在合理范围内限制访问并在不再需要时删除或去标识化。</p>

<h2>六、境外披露</h2>
<p>部分服务商可能在澳大利亚境外存储或处理个人信息，包括美国及其他国家。我们会采取合理步骤选择可靠的服务商、签订适当的数据处理安排并要求其采取合理安全措施，但境外接收方所在国家的隐私保护法律可能与澳大利亚不同。</p>

<h2>七、直接营销</h2>
<p>我们可能向您发送与您使用过或询问过的类似服务有关的营销邮件。营销邮件会标明发件人身份并提供便捷的退订方式。您可以随时退订或联系 {company_email} 停止营销信息；订单、付款、合同、账户安全、设备归还和退款等服务通知不受退订影响。</p>

<h2>八、保存期限</h2>
<p>我们仅在实现收集目的、处理未完成事项或法律要求所需的期限内保存个人信息。根据当前数据保留设置，典型期限包括：合同及财务记录 7 年、身份核验记录 365 天、设备日志 18 个月、推荐和优惠券记录 3 年、客服记录 2 年、长期未活跃客户资料 3 年、审计记录 7 年。具体期限可能因法律、争议、欺诈调查、保险或账户设置而变化。tawk.to、Tally、支付和邮件服务商的记录按其服务设置、协议及隐私政策保留。期限届满后，我们会删除、匿名化或去标识化信息，除非法律允许或要求继续保留。</p>

<h2>九、信息安全与数据泄露</h2>
<p>我们采取合理的技术和管理措施保护个人信息，包括访问控制、加密传输、日志审计、限流和安全监控。互联网传输和第三方服务不存在绝对安全保证。如果发生可能导致严重伤害的数据泄露，我们会按照《隐私法》下的可通报数据泄露方案采取评估、通知和补救措施。</p>

<h2>十、您的访问、更正和其他请求</h2>
<p>您可以请求查阅我们持有的您的个人信息，并请求更正不准确、过时或不完整的信息。您也可以询问我们如何使用或披露您的信息，并在适用时请求删除或限制处理。部分记录可能因法律、合同、欺诈防范、争议处理或安全原因无法立即删除；我们会说明原因。请通过 {company_email} 联系我们，并尽可能提供姓名、账户邮箱和订单编号。我们通常会在 30 天内回应访问或更正请求。</p>

<h2>十一、投诉</h2>
<p>如您认为我们没有妥善处理您的个人信息，请先联系隐私事务联系人：{company_email}。我们会在合理期限内调查并回复。如果您对结果不满意，可以向澳大利亚信息专员办公室（OAIC）提出投诉，网址为 <a href="https://www.oaic.gov.au/">oaic.gov.au</a>，电话 1300 363 992。提出投诉不会影响您依法享有的其他权利。</p>

<h2>十二、Cookie 和类似技术</h2>
<p>我们使用必要 Cookie 维持登录和安全，也可能使用推荐码 Cookie、Cloudflare Turnstile、tawk.to 在线客服及 Tally 问卷所使用的浏览器存储。详细内容请参阅<a href="/cookies">《Cookie 政策》</a>。</p>

<h2>十三、政策更新与联系我们</h2>
<p>我们可能因业务、技术或法律变化更新本政策。更新后的版本会在本页面公布并注明版本和日期；重大变化会在适当情况下通过网站或邮件提示。</p>
<p>隐私事务联系人 — {company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP;

INSERT INTO systemSettings (key, value) VALUES ('cookiePolicy',
'<h1>Cookie 政策</h1>
<p>本 Cookie 政策说明 {company_name}（ABN {company_abn}）在您访问本网站、使用在线客服或打开反馈问卷时如何使用 Cookie 及类似技术。本政策应与<a href="/privacy">《隐私政策》</a>一并阅读。</p>
<p><strong>版本：</strong>{cookie_policy_version}　<strong>最后更新：</strong>{cookie_policy_last_updated_date}</p>

<h2>一、什么是 Cookie</h2>
<p>Cookie 是网站保存到浏览器或设备上的小型文本文件。类似技术还包括 localStorage、sessionStorage、浏览器缓存和设备标识。它们可以帮助网站维持登录、完成安全验证、记住推荐信息或提供在线客服功能。</p>

<h2>二、我们的网站 Cookie 和浏览器存储</h2>
<ul>
<li><strong>session（必要）：</strong>维持登录会话。通常在 12 小时后失效；选择“记住我”时最长 30 天。该 Cookie 设置为 HttpOnly，并在 HTTPS 下使用 Secure 属性。</li>
<li><strong>referral_code（功能）：</strong>保存推荐码，最长 30 天，用于归属推荐关系和计算适用奖励。</li>
<li><strong>安全验证（必要）：</strong>Cloudflare Turnstile 及相关安全机制可能使用临时 Cookie、令牌或浏览器存储，以确认请求来自真实用户并防止欺诈和滥用。</li>
<li><strong>界面存储（功能）：</strong>浏览器 localStorage 或 sessionStorage 可能保存通知已读状态、界面偏好等信息，不用于出售个人信息。</li>
</ul>

<h2>三、tawk.to 在线客服使用的技术</h2>
<p>当 tawk.to 在线客服组件加载时，tawk.to 可能使用 Cookie、localStorage、sessionStorage 及其他浏览器技术来建立聊天连接、识别访客、保存客服会话和改善组件功能。根据 tawk.to 的公开说明，可能出现的名称包括：</p>
<ul>
<li><code>tawk_uuid_*</code>：访客识别，必要功能；</li>
<li><code>twk_idm_key</code>：访客连接管理，会话期间使用；</li>
<li><code>twk_token_*</code>：保存在 HTML localStorage 中的必要令牌；</li>
<li><code>tawk_uuid_propertyId</code>：访客跟踪，公开说明的期限最长可达 6 个月；</li>
<li><code>TawkConnectionTime</code>：连接管理，会话期间使用。</li>
</ul>
<p>实际名称、用途和期限可能因 tawk.to 版本、区域和我们的账户设置而变化。详情请参阅 <a href="https://help.tawk.to/article/what-are-tawkto-cookies-and-what-do-they-do">tawk.to Cookie 说明</a> 和 <a href="https://www.tawk.to/privacy-policy/">tawk.to 隐私政策</a>。如果我们启用了 tawk.to 的同意表单，相关 Cookie 和浏览器存储应在您同意后才设置；如果未启用，则组件可能在加载时设置相关技术。请以页面实际显示的同意选项为准。</p>

<h2>四、Tally 反馈问卷</h2>
<p>反馈页面通过 Tally 的嵌入式表单加载。打开该页面时，Tally 可能使用其自己的 Cookie 或浏览器存储，并按照其隐私政策和 Cookie 政策处理技术信息。您可以不打开问卷或关闭页面；这不会影响租赁订单。问卷奖励仅在您主动提交反馈并符合活动规则时处理。</p>

<h2>五、广告和分析</h2>
<p>我们目前没有主动部署独立的第三方广告像素，也不使用本系统的 Cookie 记录跨站广告行为。tawk.to 在线客服和安全服务商可能为提供其功能而产生自己的技术日志或访客标识；这些处理受相应服务商的政策和实际配置约束。</p>

<h2>六、如何管理 Cookie</h2>
<p>您可以通过浏览器设置查看、删除、阻止或在关闭浏览器时清除 Cookie，也可以使用页面上提供的第三方客服同意选项。禁用必要 Cookie、拒绝安全验证或阻止第三方存储，可能导致无法登录、下单、签署合同、完成支付或使用在线客服。删除 Cookie 不会自动删除我们已经依法保存的账户、订单或客服记录；如需访问、更正或删除个人信息，请按<a href="/privacy">《隐私政策》</a>联系我们。</p>

<h2>七、政策更新与联系我们</h2>
<p>我们可能因网站功能、供应商或法律变化更新本政策。更新后的版本会在本页面公布并注明版本和日期。</p>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP;

INSERT INTO systemSettings (key, value) VALUES ('legalMetadata', '{}')
ON CONFLICT(key) DO NOTHING;

UPDATE systemSettings
SET value = json_patch(
  CASE WHEN json_valid(value) = 1 THEN value ELSE '{}' END,
  '{"privacy":{"version":"1.1","lastUpdatedDate":"2026-09-16"},"cookie":{"version":"1.1","lastUpdatedDate":"2026-09-16"}}'
), updatedAt = CURRENT_TIMESTAMP
WHERE key = 'legalMetadata';
