-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 完善.md 最终上线 Gate / Security — 提供一套遵守澳大利亚法律的默认协议与邮件模板。
--
-- 背景：迁移 0009 曾植入占位法律文本，迁移 0086 又把它清空，改由管理员在 D1
-- 中维护。本迁移重新植入一套「可直接上线」的默认文本，覆盖：
--   * 澳大利亚消费者法（Australian Consumer Law，CCA 2010 Sch 2）——不可排除的消费者保障、
--     不公平合同条款制度、单一价格（含 GST）披露；
--   * 1988 年隐私法（Privacy Act 1988 (Cth)）与澳大利亚隐私原则（APPs）、可通报数据泄露方案；
--   * 1999 年电子交易法（Electronic Transactions Act 1999 (Cth) / Vic 2000）——电子签名；
--   * 2003 年反垃圾邮件法（Spam Act 2003）——商业电子邮件的发件人身份与退订；
--   * GST（A New Tax System (Goods and Services Tax) Act 1999）——税务发票与含税报价；
--   * 短期租赁不构成《国家信贷法》（National Credit Code）下的「消费者租赁」。
--
-- 安全约定：只有当对应字段「不存在」或「为空」时才写入，绝不覆盖管理员已保存的内容。

------------------------------------------------------------------------------
-- 1. 用户协议（网站使用协议）——注册与正式账户升级时确认
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('userTerms',
'<h1>用户协议</h1>
<p>本用户协议（下称「本协议」）由 {company_name}（ABN {company_abn}，下称「我们」）与访问或使用本网站及相关服务的用户（下称「您」）订立。注册账户、提交租赁申请或以其他方式使用服务，即表示您已阅读、理解并同意本协议。</p>
<p><strong>版本：</strong>{user_agreement_version}　<strong>最后更新：</strong>{user_agreement_last_updated_date}</p>

<h2>一、资格与账户</h2>
<ul>
<li>您须年满 18 周岁、具备完全民事行为能力，并能提供澳大利亚境内的收货与联系地址。</li>
<li>您应提供真实、准确、完整且及时更新的注册与身份资料。提供虚假资料可能构成违反《澳大利亚消费者法》（Australian Consumer Law）下的误导性陈述。</li>
<li>您应妥善保管账户凭据，对通过您账户进行的所有活动负责，发现未经授权使用应立即通知我们。</li>
</ul>

<h2>二、服务说明</h2>
<p>本网站提供设备信息展示、在线下单、电子合同签署、付款、订单与售后管理等功能。具体的设备租赁权利义务，以您签署的《设备租赁协议》及生成的租赁合同为准。所有价格均以澳元（AUD）标示，并依据《澳大利亚消费者法》第 48 条以含商品及服务税（GST）的单一价格显示。</p>

<h2>三、合理使用</h2>
<ul>
<li>不得利用服务从事任何违法活动，或侵犯他人知识产权、隐私权或其他合法权益。</li>
<li>不得干扰、破坏网站运行，不得绕过安全措施、进行未经授权的访问、抓取或压力测试。</li>
<li>不得冒用他人身份下单或签署合同。</li>
</ul>

<h2>四、第三方支付</h2>
<p>信用卡付款由第三方支付服务商（如 Stripe）处理，须遵守其条款。我们不收取、不存储完整的信用卡号或安全码。以储值方式或银行转账付款的规则，见网站公示与订单页面说明。</p>

<h2>五、知识产权</h2>
<p>网站的文字、界面、标识、数据编排及软件均归我们或相应权利人所有，受 1968 年《版权法》（Copyright Act 1968 (Cth)）等法律保护。未经书面许可，您不得复制、改编、传播或用于商业目的。</p>

<h2>六、消费者保障与责任限制</h2>
<p>我们提供的商品与服务附带《澳大利亚消费者法》规定的消费者保障（consumer guarantees），这些保障<strong>不能被排除、限制或修改</strong>。就服务而言，您有权要求以合理的谨慎与技能提供服务；就重大失败，您有权解除合同并获得退款。</p>
<p>在法律允许的最大范围内，且不影响上述不可排除的权利，我们对因使用或无法使用网站而产生的间接、附带或后果性损失不承担责任；对于可依法限制的责任，我们的责任以重新提供服务或支付重新提供服务的合理费用为限。本协议中的任何内容均不排除或限制我们依法不能排除的责任。</p>

<h2>七、隐私</h2>
<p>我们依据 1988 年《隐私法》（Privacy Act 1988 (Cth)）及澳大利亚隐私原则处理您的个人信息，详见<a href="/privacy">《隐私政策》</a>。</p>

<h2>八、协议变更</h2>
<p>我们可基于运营、安全或法律要求修订本协议。重大变更将通过网站公告或电子邮件提前通知。变更生效后继续使用服务即视为接受；如不同意，您可停止使用并关闭账户。</p>

<h2>九、暂停与终止</h2>
<p>如您严重或重复违反本协议、或存在欺诈或违法行为，我们可在合理通知后暂停或终止您的账户；紧急情况下可立即处理。终止不影响双方在终止前已产生的权利义务。</p>

<h2>十、适用法律与争议</h2>
<p>本协议受澳大利亚维多利亚州法律管辖，双方服从该州法院的非专属管辖。如发生争议，请先通过下方方式联系我们协商解决；您亦可向维多利亚州消费者事务局（Consumer Affairs Victoria）或澳大利亚竞争与消费者委员会（ACCC）寻求协助。</p>

<h2>十一、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 2. 设备租赁协议（签署流程第一步阅读并同意，支持合同变量）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('rentalTerms',
'<h1>设备租赁协议</h1>
<p>本设备租赁协议（下称「本协议」）在 <strong>{company_name}</strong>（ABN {company_abn}，下称「出租方」）与 <strong>{signer_name}</strong>（下称「承租方」）之间订立，构成双方之间具有法律约束力的租赁（bailment）合同。</p>
<p><strong>协议版本：</strong>{rental_agreement_version}　<strong>最后更新：</strong>{rental_agreement_last_updated_date}　<strong>管辖地：</strong>{jurisdiction}</p>

<h2>一、租赁设备</h2>
<ul>
<li>设备名称：{device_name}（型号 {device_model}）</li>
<li>序列号：{device_sn}</li>
<li>交付状况：设备在交付时处于可正常使用的状况；承租方应在取件时当场检查并确认。</li>
</ul>

<h2>二、租期与费用</h2>
<ul>
<li>租期：{start_date} 至 {end_date}，共 {rental_days} 天。</li>
<li>日租金：AUD$ {daily_rate}；租金总额：AUD$ {total_rent}（已包含 GST：{gst_included}）。</li>
<li>押金（security bond）：AUD$ {deposit_amount}。</li>
<li>逾期费：每日 AUD$ {late_fee_per_day}，作为对逾期占用造成损失的合理预估，而非罚金。</li>
</ul>

<h2>三、押金</h2>
<p>押金用于担保承租方履行本协议，<strong>不是</strong>预付租金，也不作为惩罚性款项。设备归还并完成验机后，出租方将在 <strong>10 个营业日</strong>内退还可退部分。如需从押金中扣款，出租方将提供逐项说明及相应凭证，扣款金额以实际、合理的费用为限（例如超出正常损耗的维修或更换费用、缺件、必要清洁费、逾期费）。对扣款有异议的，可依本协议争议条款处理。</p>

<h2>四、所有权与使用限制</h2>
<ul>
<li>设备所有权始终归出租方所有。本协议为短期租赁，租期不超过 4 个月且承租方不享有购买设备的权利或义务，<strong>不构成</strong>《国家信贷法》（National Credit Code）下的「消费者租赁」或信贷合同。</li>
<li>承租方不得转租、转借、出售、质押设备，或将设备移出澳大利亚境外。</li>
<li>设备仅限合法用途；不得拆解、改装，不得移除资产标签或管理软件，不得越权刷写系统。</li>
<li>承租方应保持操作系统与安全更新为最新，妥善保管登录凭据。</li>
</ul>

<h2>五、风险、损坏与赔偿</h2>
<p>自交付时起至设备退还并经出租方确认接收时止，设备的丢失或损坏风险由承租方承担，<strong>正常损耗（fair wear and tear）除外</strong>。因承租方或其允许使用人造成的丢失或超出正常损耗的损坏，承租方应按实际维修费用赔偿；若无法修复，则按扣除折旧后的市场重置价值赔偿，二者取较低者。出租方将提供维修报价或重置价值的证明。承租方可自行投保以覆盖上述风险。</p>

<h2>六、设备管理软件</h2>
<p>设备可能预装出租方的管理软件，用于上报设备状态、硬件信息与租期信息，并在符合<a href="/software-terms">《软件使用协议》</a>所列情形时执行锁定、重启或数据清除等远程操作。相关个人信息处理见<a href="/privacy">《隐私政策》</a>。数据清除将删除设备上的用户数据，承租方应自行提前备份。</p>

<h2>七、归还</h2>
<p>承租方应在租期届满时，按约定的时间、地点，以交付时的状况（正常损耗除外）连同全部配件归还设备。未按时归还的，按第二条的每日逾期费计收，并不影响出租方依法追偿其他损失或依第九条取回设备。</p>

<h2>八、消费者保障</h2>
<p>本协议项下提供的商品与服务附带《澳大利亚消费者法》规定的消费者保障，包括设备须具有<strong>可接受的质量</strong>、与描述相符、适合告知的特定用途，服务须以合理的谨慎与技能提供。这些保障<strong>不能被排除</strong>。就重大失败，承租方有权解除本协议并要求退还相应款项，或要求就价值减损获得赔偿；就非重大失败，出租方将在合理时间内修理或更换。</p>

<h2>九、违约与取回</h2>
<p>如承租方未支付到期款项、违反使用限制或存在欺诈，出租方可在发出合理书面通知并给予补救期后终止本协议。出租方仅可通过合法方式取回设备，不得进入住宅或采用胁迫手段。终止不影响已产生的付款义务。</p>

<h2>十、责任限制</h2>
<p>在法律允许且不影响上述不可排除的消费者保障的前提下，出租方不对承租方的数据丢失、业务中断或其他间接或后果性损失负责；出租方可依法限制的责任，以重新提供服务或支付其合理费用为限，或以本协议项下已付租金总额为限。</p>

<h2>十一、不可抗力</h2>
<p>因超出一方合理控制的事件（如自然灾害、战争、罢工、电信或电力中断、政府行为）导致的履约迟延或不能，该方在受影响范围内不承担违约责任，但应尽快通知对方并努力减轻影响。</p>

<h2>十二、电子签名</h2>
<p>双方同意以电子方式订立与签署本协议。依据 1999 年《电子交易法》（Electronic Transactions Act 1999 (Cth)）及《2000 年电子交易（维多利亚）法》，电子签名与手写签名具有同等法律效力。系统会记录签署时间、IP 地址与设备信息作为签署证据。</p>

<h2>十三、一般条款</h2>
<p>本协议连同其引用的政策构成双方就设备租赁的完整约定。本协议受维多利亚州法律管辖，双方服从该州法院的非专属管辖。若任何条款被认定无效或不可执行，不影响其余条款的效力。</p>

<h2>十四、联系方式</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>
<p>付款账户　BSB：{bank_bsb}　账号：{bank_account}　账户名：{account_name}</p>

<hr>
<p>承租方签字：{signer_name}　　签署时间：{sign_time}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 3. 服务条款（全站页脚）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('serviceTerms',
'<h1>服务条款</h1>
<p>本服务条款适用于 {company_name}（ABN {company_abn}）运营的网站及在线服务。使用本网站、创建账户或提交租赁申请，即表示您接受本条款。</p>
<p><strong>版本：</strong>{service_terms_version}　<strong>最后更新：</strong>{service_terms_last_updated_date}</p>

<h2>一、服务范围</h2>
<p>我们通过网站提供设备浏览、在线预订、电子合同签署、付款、订单跟踪与售后支持。网站可能包含由第三方提供的内容或链接，我们不对第三方网站负责。</p>

<h2>二、下单与合同成立</h2>
<p>网站展示的设备与价格为要约邀请。您提交订单后，租赁合同在我们确认订单并且您完成电子合同签署与所需付款时成立。若设备缺货或信息有误，我们可在合同成立前拒绝订单并全额退款。</p>

<h2>三、价格、GST 与手续费</h2>
<ul>
<li>所有价格以澳元（AUD）标示，并依据《澳大利亚消费者法》第 48 条以含 GST 的单一价格显示。</li>
<li>我们按 1999 年《商品及服务税法》开具税务发票（tax invoice）。</li>
<li>以信用卡付款可能产生支付处理费，费率在结算页面明确披露（当前为本金的 2.5%）。</li>
</ul>

<h2>四、取消与退款</h2>
<p>订单取消、押金退还与提前归还的处理方式，见<a href="/refund-policy">《取消与退款政策》</a>。该政策为对您在《澳大利亚消费者法》下权利的补充，不构成对该等权利的限制。</p>

<h2>五、服务可用性</h2>
<p>我们努力保持网站可用，但不保证不中断或无差错。我们可因维护、安全或运营原因临时暂停服务，并尽量提前通知。</p>

<h2>六、合理使用</h2>
<p>您不得干扰网站运行、绕过安全措施、冒用他人身份、上传恶意代码，或将网站用于违法用途。</p>

<h2>七、消费者保障与责任</h2>
<p>我们以合理的谨慎与技能提供服务，此项《澳大利亚消费者法》保障不能被排除。在法律允许且不影响该等保障的范围内，我们对间接或后果性损失不承担责任，可依法限制的责任以重新提供相关服务或支付其合理费用为限。</p>

<h2>八、赔偿</h2>
<p>因您违反本条款或违法使用网站而使我们遭受的第三方索赔、直接损失与合理费用，您应予补偿；该责任按您的过错程度相应减免。</p>

<h2>九、条款变更</h2>
<p>我们可修订本条款，重大变更将在网站公示或以电子邮件通知。变更生效后继续使用即视为接受。</p>

<h2>十、适用法律</h2>
<p>本条款受澳大利亚维多利亚州法律管辖，双方服从该州法院的非专属管辖。</p>

<h2>十一、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 4. 隐私政策（Privacy Act 1988 (Cth) + APPs）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('privacyPolicy',
'<h1>隐私政策</h1>
<p>{company_name}（ABN {company_abn}，下称「我们」）依据 1988 年《隐私法》（Privacy Act 1988 (Cth)）及澳大利亚隐私原则（Australian Privacy Principles, APPs）处理个人信息。本政策说明我们收集哪些信息、如何使用与披露，以及您如何访问和更正这些信息。</p>
<p><strong>版本：</strong>{privacy_policy_version}　<strong>最后更新：</strong>{privacy_policy_last_updated_date}</p>

<h2>一、我们收集的个人信息</h2>
<ul>
<li><strong>身份与联系资料：</strong>姓名、出生日期、电话、电子邮箱、账单与收货地址。</li>
<li><strong>身份核验资料（敏感信息）：</strong>护照或驾照等证件类型与号码，仅在获得您同意的情况下收集，用于核实身份与防范欺诈。</li>
<li><strong>租赁与交易记录：</strong>订单、合同、付款与退款记录、押金结算、电子签名及其元数据（签署时间、IP 地址、设备与浏览器信息）。</li>
<li><strong>付款信息：</strong>由第三方支付服务商处理；我们不存储完整卡号或安全码。</li>
<li><strong>设备与技术信息：</strong>通过网站收集的日志、Cookie、设备标识；如设备安装了管理软件，还包括设备状态、硬件清单与粗略位置信息。</li>
</ul>

<h2>二、收集方式</h2>
<p>我们主要直接向您收集（注册、下单、签约、客服沟通时），也可能通过网站技术手段或设备管理软件收集。如果我们从第三方（如推荐人或支付服务商）获得您的信息，会在合理可行时告知您。</p>

<h2>三、使用目的（APP 6）</h2>
<ul>
<li>创建与管理账户、核实身份、评估与处理租赁申请；</li>
<li>订立并履行租赁合同、交付与回收设备、处理付款、押金与退款；</li>
<li>提供客户支持、处理争议与损坏理赔；</li>
<li>防范欺诈、保障网站与设备安全、追收欠款；</li>
<li>在您未退订的前提下，就同类服务向您发送营销信息；</li>
<li>履行法律义务及配合执法或监管要求。</li>
</ul>

<h2>四、披露对象</h2>
<p>我们可能在上述目的必需的范围内，向以下方披露个人信息：支付服务商（如 Stripe）、电子邮件服务商（如 Resend）、物流与维修服务商、专业顾问、征信或追账机构，以及在法律要求或授权时向政府机构与执法部门披露。我们不会为其自身营销目的向第三方出售个人信息。</p>

<h2>五、跨境披露（APP 8）</h2>
<p>我们的部分服务商在澳大利亚境外存储或处理数据，可能包括美国及其他国家。我们会采取合理步骤要求这些接收方以符合澳大利亚隐私原则的方式保护您的信息。</p>

<h2>六、直接营销（APP 7 与 Spam Act 2003）</h2>
<p>商业电子邮件会标明发件人身份并提供便捷的退订方式。您可随时退订或联系我们停止接收营销信息；交易类通知（如订单、付款、合同、安全提醒）不受退订影响。</p>

<h2>七、安全与保留</h2>
<p>我们采取合理的技术与管理措施保护个人信息，防止丢失、滥用与未经授权的访问。我们仅在实现收集目的或法律要求所需的期限内保留信息（例如税务与交易记录通常需保留 7 年），之后予以销毁或去标识化。敏感的身份证件信息在核验目的完成且无法律保留要求后尽快删除。</p>

<h2>八、可通报的数据泄露</h2>
<p>如发生可能对您造成严重损害的数据泄露，我们将依据《隐私法》第 IIIC 部分的「可通报数据泄露方案」（Notifiable Data Breaches scheme）通知您并报告澳大利亚信息专员办公室（OAIC）。</p>

<h2>九、访问与更正（APP 12 与 13）</h2>
<p>您有权要求查阅我们持有的您的个人信息，并要求更正不准确的信息。请通过下方方式联系我们。我们通常在 30 天内回应，且不对访问请求收取不合理费用。</p>

<h2>十、Cookie</h2>
<p>网站使用 Cookie 维持登录状态、保障安全并改进体验。您可在浏览器中管理或禁用 Cookie，但部分功能可能受影响。</p>

<h2>十一、投诉</h2>
<p>如您认为我们违反了澳大利亚隐私原则，请先联系我们的隐私事务联系人。我们将在合理期限内调查并回复。如您对处理结果不满意，可向澳大利亚信息专员办公室投诉（OAIC，www.oaic.gov.au，电话 1300 363 992）。</p>

<h2>十二、政策变更</h2>
<p>我们可能不时更新本政策，更新后的版本将在本页面公布并注明生效日期。</p>

<h2>十三、联系我们</h2>
<p>隐私事务联系人 — {company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 5. 软件使用协议（设备管理软件）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('softwareTerms',
'<h1>软件使用协议</h1>
<p>本软件使用协议（下称「本协议」）适用于 {company_name}（ABN {company_abn}）随出租设备提供的设备管理软件（下称「本软件」）。安装、运行或使用本软件即表示您同意本协议。</p>
<p><strong>版本：</strong>{software_terms_version}　<strong>最后更新：</strong>{software_terms_last_updated_date}</p>

<h2>一、授权范围</h2>
<p>我们授予您一项有限的、可撤销的、不可转让、非独占的许可，仅可在租期内、在您租用的设备上使用本软件，用于设备管理与技术支持目的。本软件的所有权与知识产权归我们或授权人所有。</p>

<h2>二、使用限制</h2>
<ul>
<li>不得复制、出租、再许可或分发本软件；</li>
<li>不得对本软件进行反向工程、反编译或反汇编，但 1968 年《版权法》（Copyright Act 1968 (Cth)）第 47D 条等法律明确允许的互操作性情形除外；</li>
<li>不得绕过、停用或干扰本软件的授权、安全或管理功能；</li>
<li>不得将本软件用于任何违法用途。</li>
</ul>

<h2>三、数据收集</h2>
<p>本软件会按管理需要收集并上报：设备开机与在线状态、硬件与系统清单、软件版本、电量与健康度、网络与粗略位置信息、以及租期与合规相关事件。相关个人信息的处理见<a href="/privacy">《隐私政策》</a>。</p>

<h2>四、远程操作</h2>
<p>在下列情形下，我们可对设备执行锁定、重启、注销、恢复出厂或数据清除等远程操作：</p>
<ul>
<li>租期届满后经通知仍未归还设备；</li>
<li>合理怀疑设备被盗、涉嫌欺诈或被用于违法活动；</li>
<li>存在安全风险或法律、监管要求。</li>
</ul>
<p>在合理可行的情况下，我们会事先通知您。<strong>数据清除会删除设备上的用户数据</strong>，您应自行定期备份。在法律允许且不影响《澳大利亚消费者法》不可排除保障的范围内，我们不对因合法远程操作造成的用户数据丢失负责。</p>

<h2>五、更新</h2>
<p>本软件可能自动检查并安装安全与功能更新，以维持服务与设备安全。</p>

<h2>六、消费者保障与免责</h2>
<p>本软件随附《澳大利亚消费者法》规定的、不可排除的消费者保障。在此范围之外，本软件按「现状」提供，我们不对其满足您的特定需求或不间断、无错误运行作额外担保。</p>

<h2>七、期限与终止</h2>
<p>本协议随租赁合同同时生效，并在租期结束或设备归还时终止。终止后您应停止使用并允许我们卸载本软件；我们可停用与本软件相关的账户与连接。</p>

<h2>八、适用法律</h2>
<p>本协议受澳大利亚维多利亚州法律管辖，双方服从该州法院的非专属管辖。</p>

<h2>九、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 6. 取消与退款政策（copyrightNotice 键沿用为「退款政策」）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('copyrightNotice',
'<h1>取消与退款政策</h1>
<p>本政策说明 {company_name}（ABN {company_abn}）在订单取消、押金退还、提前归还与设备故障情况下的处理方式。</p>
<p><strong>版本：</strong>{refund_policy_version}　<strong>最后更新：</strong>{refund_policy_last_updated_date}</p>

<h2>一、您在《澳大利亚消费者法》下的权利</h2>
<p>本政策是对您在《澳大利亚消费者法》（Australian Consumer Law）下权利的<strong>补充</strong>，不构成任何限制。若设备或服务存在<strong>重大失败</strong>，您有权取消并获得退款，或要求赔偿价值减损；若为<strong>非重大失败</strong>，我们将在合理时间内修理或更换。我们无权仅因超过某一时限而拒绝上述法定救济。</p>

<h2>二、改变主意的取消（取件前）</h2>
<ul>
<li>下单后 24 小时内且尚未取件：全额退还已付租金与押金。</li>
<li>超过 24 小时但在约定取件日之前：退还已付租金，扣除实际已发生且不可退的支付处理费；押金全额退还。</li>
</ul>

<h2>三、取件后取消或提前归还</h2>
<p>租金按已使用天数（含任何约定的最短租期）计收，已使用天数不予退款。剩余未使用天数在扣除已发生成本后退还。押金按第五条处理。</p>

<h2>四、未取件（No-show）</h2>
<p>未在约定时间取件且未提前通知的，我们可扣除已发生的备货、预留与处理成本；其余款项退还。</p>

<h2>五、押金退还</h2>
<ul>
<li>设备归还并完成验机后，我们在 <strong>10 个营业日</strong>内退还可退押金。</li>
<li>如需扣款，我们会提供<strong>逐项结算说明</strong>及维修报价、照片或发票等凭证。</li>
<li>扣款仅限实际、合理的费用：超出正常损耗的维修或更换费、缺件、必要清洁费、逾期费。正常损耗（fair wear and tear）不扣款。</li>
<li>扣款金额不得作为惩罚，且受《澳大利亚消费者法》不公平合同条款制度的约束。</li>
</ul>

<h2>六、设备故障</h2>
<p>如设备在租期内因非您的原因发生故障，我们将安排维修、更换或按未使用天数退款。若故障系因误用、事故或未经授权的改动造成，则可能按租赁协议向您收取相关费用。</p>

<h2>七、退款方式与时间</h2>
<ul>
<li>退款可按您的选择退回原支付方式或账户余额。</li>
<li>信用卡退款通常在我们处理后 5–10 个营业日到账；银行转账退款可能需要额外时间。</li>
<li>退款金额与币种与原付款一致（澳元 AUD）。</li>
</ul>

<h2>八、如何申请</h2>
<p>请通过订单详情页面或发送邮件至 {company_email} 申请，并注明订单编号。我们会在收到申请后 5 个营业日内回复处理结果。</p>

<h2>九、投诉</h2>
<p>如对退款结果有异议，请先联系我们。您也可以向维多利亚州消费者事务局（Consumer Affairs Victoria，consumer.vic.gov.au）或澳大利亚竞争与消费者委员会（ACCC，accc.gov.au）寻求协助。</p>

<h2>十、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 7. 协议版本元数据（仅在缺失或为空时写入）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('legalMetadata',
'{"software":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"user":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"rental":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"service":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"privacy":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"copyright":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"contract":{"version":"1.0","lastUpdatedDate":"2026-09-07"}}')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '' OR TRIM(systemSettings.value) = '{}';

------------------------------------------------------------------------------
-- 8. 默认邮件模板（Spam Act 2003：标明发件人身份；交易类通知）
--    表结构见 0042；此处仅：新增缺失模板 + 升级仍为「初版占位文案」的模板。
------------------------------------------------------------------------------
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

-- 8a. 新增模板（若同 id 已存在则不动）
INSERT OR IGNORE INTO email_templates (id, name, subject, body, format, theme_color) VALUES
('email_verification', '验证邮箱', '请验证您的邮箱 - {company_name}',
 '<p>您好 {customer_name}：</p><p>感谢注册 {company_name}。请点击以下链接验证您的邮箱地址（链接 24 小时内有效）：</p><p><a href="{verification_url}">{verification_url}</a></p><p>如果这不是您本人的操作，请忽略本邮件。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
 'html', '#f0a35b'),
('welcome_site', '欢迎邮件', '欢迎加入 {company_name}', '<p>您好 {customer_name}：</p><p>欢迎使用 {company_name} 设备租赁服务。您现在可以浏览设备、在线下单并电子签署租赁合同。所有价格均以澳元（AUD）标示并含 GST。</p><p>如需帮助，请联系 {company_email} 或致电 {company_phone}。</p><p>{company_name}｜{company_address}</p>', 'html', '#f0a35b'),
('bond_refund_statement', '押金结算通知', '押金结算与退款 - {order_number}', '<p>您好 {customer_name}：</p><p>订单 {order_number} 的设备已完成归还与验机。押金结算如下：</p><p>押金：{deposit_amount}<br>退还金额：{refund_amount}</p><p>如有扣款，逐项结算说明与相应凭证见订单详情页面。退款将在 10 个营业日内按您选择的方式处理。</p><p>本结算不影响您在《澳大利亚消费者法》下的权利。如有疑问请回复 {company_email} 并注明订单编号。</p><p>{company_name}｜{company_address}</p>', 'html', '#6b8f71'),
('tax_invoice_issued', '税务发票已开具', '税务发票 - {order_number}', '<p>您好 {customer_name}：</p><p>订单 {order_number} 的税务发票（Tax Invoice）已开具，金额已包含 GST。您可在订单详情页面查看并下载。</p><p>{company_name}（ABN {company_abn}）｜{company_address}｜{company_email}</p>', 'html', '#4f7d9c');

-- 8b. 升级仍是「初版占位文案」的内置模板（管理员改过的行 body 不匹配，自动跳过）
UPDATE email_templates SET
  subject = '订单已创建 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 已创建。</p><p>设备：{device_name}<br>租期：{start_date} 至 {end_date}（{rental_period}）<br>订单金额（含 GST）：{total_amount}<br>押金：{deposit_amount}</p><p>请在 {payment_due_date} 前完成付款并电子签署租赁合同。取消与退款规则见我们网站的《取消与退款政策》。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'order_created'
  AND body = '您好 {customer_name}，您的订单 {order_number} 已创建。设备：{device_name}，租期：{start_date} 至 {end_date}。订单金额：{total_amount}。';

UPDATE email_templates SET
  subject = '订单审核通过 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 已审核通过。请在 <strong>{payment_due_date}</strong> 前完成付款，逾期订单可能被取消。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'order_approved'
  AND body = '您好 {customer_name}，您的订单 {order_number} 已审核通过。请在 {payment_due_date} 前完成付款。';

UPDATE email_templates SET
  subject = '付款提醒 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 尚未完成付款，待付款金额为 <strong>{total_amount}</strong>（含 GST）。请在付款截止日 {payment_due_date} 前完成，以免订单被取消。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'payment_reminder'
  AND body IN (
    '您好 {customer_name}，您的订单 {order_number} 尚未完成付款，待付款金额为 {total_amount}。',
    '您好 {customer_name}，您的订单 {order_number} 尚未完成付款，待付款金额为 {total_amount}'
  );

UPDATE email_templates SET
  subject = '订单待付款 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 正等待付款。完成付款并签署租赁合同后，我们将安排设备交付。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'order_pending_payment'
  AND body = '您好 {customer_name}，您的订单 {order_number} 正等待付款。';

UPDATE email_templates SET
  subject = '付款已完成 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>我们已收到您订单 <strong>{order_number}</strong> 的付款。含 GST 的税务发票可在订单详情页面查看。我们将按约定安排设备交付。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'payment_completed'
  AND body = '您的订单 {order_number} 已完成付款。';

UPDATE email_templates SET
  subject = '请签署租赁合同 - {contract_number}',
  body = '<p>您好 {customer_name}：</p><p>您的租赁合同 <strong>{contract_number}</strong> 已生成，请通过以下链接阅读并电子签署：</p><p><a href="{sign_url}">{sign_url}</a></p><p>依据 1999 年《电子交易法》（Electronic Transactions Act 1999 (Cth)），电子签名与手写签名具同等效力。签署前请仔细阅读全文。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'contract_pending_sign'
  AND body = '您好 {customer_name}，请通过以下链接签署租赁合同：{sign_url}';

UPDATE email_templates SET
  subject = '取件提醒 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>请于 <strong>{pickup_date}</strong> 到 <strong>{pickup_location}</strong> 领取设备：{device_name}。</p><p>取件时请当场检查设备状况并确认。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'pickup_reminder'
  AND body = '您好 {customer_name}，请于 {pickup_date} 到 {pickup_location} 取件。设备：{device_name}。';

UPDATE email_templates SET
  subject = '设备归还提醒 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>您订单 <strong>{order_number}</strong> 的租期即将到期。请于 <strong>{return_date}</strong> 按约定方式将设备连同全部配件归还至 {return_location}。</p><p>逾期归还将按租赁协议约定的每日逾期费计收。如需续租，请在到期前联系我们。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'return_reminder'
  AND body = '您的设备租赁即将到期，请按预约时间归还设备。';

UPDATE email_templates SET
  subject = '设备归还确认 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>我们已确认收到订单 <strong>{order_number}</strong> 的设备，并将进行验机。押金结算与退款结果将另行通知（通常在 10 个营业日内）。</p><p>感谢您选择 {company_name}。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'return_confirmed'
  AND body = '您好 {customer_name}，我们已确认收到订单 {order_number} 的设备。感谢您的使用！';

UPDATE email_templates SET
  subject = '退款已处理 - {order_number}',
  body = '<p>您好 {customer_name}：</p><p>您的订单 <strong>{order_number}</strong> 已完成退款，退款金额：<strong>{refund_amount}</strong>（澳元 AUD）。</p><p>信用卡退款通常 5–10 个营业日到账，银行转账可能需要额外时间。本处理不影响您在《澳大利亚消费者法》下的权利。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'refund_completed'
  AND body = '您的订单 {order_number} 已完成退款，退款金额：{refund_amount}。';

UPDATE email_templates SET
  subject = '重置您的登录密码 - {company_name}',
  body = '<p>您好 {customer_name}：</p><p>我们收到了重置您账户密码的请求。请在 24 小时内通过以下链接重置（链接过期后请重新申请）：</p><p><a href="{reset_url}">{reset_url}</a></p><p>如果这不是您本人的操作，请忽略本邮件，您的密码不会被更改。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'password_reset'
  AND body IN (
    '您好 {customer_name}，请在 24 小时内通过以下链接重置密码：{reset_url}',
    '您好 {customer_name}，请在 24 小时内通过以下链接重置密码：{reset_url}。'
  );

UPDATE email_templates SET
  subject = '协议内容已更新 - {company_name}',
  body = '<p>您好 {customer_name}：</p><p>我们已更新以下协议内容：{changed_agreements}。</p><p>最新版本已在我们网站的对应页面公布。继续使用服务即视为接受更新后的内容；如不同意，您可以联系我们并停止使用相关服务。</p><p>{company_name}｜{company_address}｜{company_email}</p>',
  format = 'html', updated_at = CURRENT_TIMESTAMP
WHERE id = 'agreement_update'
  AND body IN (
    '您好 {customer_name}，我们已更新以下协议内容：{changed_agreements}。请登录后查看最新版本。',
    '您好 {customer_name}，我们已更新以下协议内容：{changed_agreements}。请打开通知详情查看最新版本。'
  );
