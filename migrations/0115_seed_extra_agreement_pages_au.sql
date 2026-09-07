-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 补齐网站缺失的独立协议页面，延续迁移 0114 的做法：
--   * Cookie 政策（配合 1988 隐私法 / APP 1、APP 3、APP 5 的透明度要求）；
--   * 投诉与争议解决政策（ACL 下的投诉处理与外部争议渠道：州公平交易机构、ACCC、OAIC）；
--   * 可接受使用政策（租赁设备与设备管理软件的禁止用途，含 Spam Act 2003）；
--   * 澳大利亚消费者法下的权利（不可排除的消费者保障、不公平合同条款、含 GST 单一价格）。
--
-- 同时把这 4 项写入 legalMetadata（版本 + 最后更新日期）。
--
-- 安全约定与 0114 一致：仅当对应字段「不存在」或「为空」时写入，绝不覆盖管理员在 D1 中保存的内容。

------------------------------------------------------------------------------
-- 1. Cookie 政策（页脚 /cookies、/cookie-policy）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('cookiePolicy',
'<h1>Cookie 政策</h1>
<p>本 Cookie 政策说明 {company_name}（ABN {company_abn}）在您访问本网站时如何使用 Cookie 及类似技术。本政策与<a href="/privacy">《隐私政策》</a>一并阅读。</p>
<p><strong>版本：</strong>{cookie_policy_version}　<strong>最后更新：</strong>{cookie_policy_last_updated_date}</p>
<h2>一、什么是 Cookie</h2>
<p>Cookie 是网站存放在您设备上的小型文本文件，用于让网站正常运行、记住您的选择并了解网站使用情况。类似技术包括浏览器的 localStorage 与会话存储。</p>
<h2>二、我们使用的 Cookie</h2>
<ul>
<li><strong>必要 Cookie</strong>：用于登录会话保持（<code>session</code>）、安全校验与表单防伪。缺少这些 Cookie 网站无法正常工作，因此无需另行征得同意。</li>
<li><strong>功能 Cookie</strong>：记住推荐码（<code>referral_code</code>，最长保留 30 天）等偏好，使体验更顺畅。</li>
<li><strong>安全与风控</strong>：用于人机验证（Cloudflare Turnstile）及防止欺诈与滥用。</li>
</ul>
<p>本网站目前不投放第三方广告 Cookie，也不用于跨站行为跟踪。</p>
<h2>三、如何管理 Cookie</h2>
<p>您可以通过浏览器设置查看、删除或阻止 Cookie。请注意，禁用必要 Cookie 后将无法登录或完成下单。</p>
<h2>四、政策更新</h2>
<p>我们可能不时更新本政策，更新后的版本将在本页面公布并注明更新日期。</p>
<h2>五、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 2. 投诉与争议解决政策（页脚 /complaints、/dispute-resolution）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('complaintsPolicy',
'<h1>投诉与争议解决政策</h1>
<p>{company_name}（ABN {company_abn}）致力于公平、及时地处理客户投诉。本政策说明投诉的提出方式、处理流程以及外部升级渠道。</p>
<p><strong>版本：</strong>{complaints_policy_version}　<strong>最后更新：</strong>{complaints_policy_last_updated_date}</p>
<h2>一、如何提出投诉</h2>
<p>请通过邮箱 {company_email} 或电话 {company_phone} 联系我们，并提供订单编号、事情经过及您期望的解决方案。如投诉涉及某笔订单，也可在订单详情页留言。</p>
<h2>二、处理流程与时限</h2>
<ul>
<li>我们在收到投诉后 <strong>3 个工作日内</strong>确认收悉。</li>
<li>通常在 <strong>15 个工作日内</strong>给出书面处理结果；情况复杂时会告知您预计所需时间并保持进度更新。</li>
<li>处理结果将说明我们的结论、依据以及可采取的补救措施。</li>
</ul>
<h2>三、内部升级</h2>
<p>如您对处理结果不满意，可要求将投诉升级至管理层复核。</p>
<h2>四、外部争议解决</h2>
<p>如经上述流程仍未能解决，您可向以下机构寻求协助（不影响您的其他法定权利）：</p>
<ul>
<li>您所在州或领地的消费者事务或公平交易部门，例如维多利亚州消费者事务局（Consumer Affairs Victoria）、新南威尔士州公平交易厅（NSW Fair Trading）等；</li>
<li>澳大利亚竞争与消费者委员会（ACCC）；</li>
<li>如争议涉及个人信息处理，可向澳大利亚信息专员办公室（OAIC）投诉。</li>
</ul>
<h2>五、消费者保障</h2>
<p>本政策不排除、不限制您在《澳大利亚消费者法》下享有的消费者保障权利。</p>
<h2>六、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 3. 可接受使用政策（页脚 /acceptable-use、/aup）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('acceptableUsePolicy',
'<h1>可接受使用政策</h1>
<p>本可接受使用政策（下称「本政策」）适用于所有向 {company_name}（ABN {company_abn}）租用设备或使用其设备管理软件的用户，是《用户协议》与《设备租赁协议》的组成部分。</p>
<p><strong>版本：</strong>{acceptable_use_policy_version}　<strong>最后更新：</strong>{acceptable_use_policy_last_updated_date}</p>
<h2>一、允许的用途</h2>
<p>租赁设备供承租方在租期内用于合法的个人或商业办公用途。</p>
<h2>二、禁止的行为</h2>
<ul>
<li>用于任何违反澳大利亚联邦、州或领地法律的活动，包括侵犯知识产权、传播非法内容或进行欺诈；</li>
<li>存储、发布或传播含有儿童性虐待、恐怖主义、暴力煽动或非法色情的材料；</li>
<li>发送垃圾邮件或违反 2003 年《反垃圾邮件法》（Spam Act 2003）的商业电子信息；</li>
<li>未经授权访问他人系统、进行网络攻击、端口扫描、分发恶意软件或加密勒索；</li>
<li>利用设备进行加密货币挖矿或其他导致硬件异常损耗、过度耗电或散热风险的高负载作业；</li>
<li>转租、转借、出售、抵押设备，或将设备移出澳大利亚境内而未事先获得书面同意；</li>
<li>拆解、改装设备，移除或篡改资产标签、管理软件或操作系统安全设置；</li>
<li>绕过、禁用或干扰用于设备管理的软件及其状态上报功能。</li>
</ul>
<h2>三、数据与备份</h2>
<p>承租方应对设备上自有数据的合法性与备份负责。设备归还前请自行清除个人数据；归还后设备会被重置，我们不对由此造成的数据丢失负责。</p>
<h2>四、违反后果</h2>
<p>违反本政策可能导致远程锁定设备、提前终止租赁、追偿相关费用与损失，并在法律要求时向执法机关报告。我们在采取措施前会尽合理努力通知承租方，但紧急或涉及安全与违法的情形除外。</p>
<h2>五、举报</h2>
<p>如发现违反本政策的行为，请联系 {company_email}。</p>
<h2>六、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 4. 澳大利亚消费者法下的权利（页脚 /consumer-rights）
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('consumerRights',
'<h1>澳大利亚消费者法下的权利</h1>
<p>本页面概述您在向 {company_name}（ABN {company_abn}）租用设备时，依据《澳大利亚消费者法》（Australian Consumer Law，《2010 年竞争与消费者法》附表 2）享有的权利。本页面仅为说明，不构成法律建议，也不取代法律条文。</p>
<p><strong>版本：</strong>{consumer_rights_version}　<strong>最后更新：</strong>{consumer_rights_last_updated_date}</p>
<h2>一、不可排除的消费者保障</h2>
<p>我们提供的商品与服务附带无法排除、限制或修改的消费者保障（consumer guarantees），包括：</p>
<ul>
<li>商品与其描述相符、品质可接受、适合明示或已知的特定用途；</li>
<li>服务以合理的谨慎与技能提供，并在合理时间内完成；</li>
<li>就租赁（bailment）而言，您在租期内享有对设备的安宁占有（quiet possession）。</li>
</ul>
<h2>二、出现问题时的补救</h2>
<ul>
<li><strong>轻微问题</strong>：我们可选择在合理时间内维修、更换设备或退还相应费用。</li>
<li><strong>重大问题</strong>：您可以解除该次租赁并要求退还未使用租期的费用，或要求赔偿因此造成的可合理预见的损失。设备重大故障且非您造成的，租期内不因维修停机而计费。</li>
</ul>
<h2>三、价格与税费</h2>
<p>网站展示的价格均为含商品及服务税（GST）的澳元单一价格。押金、逾期费、损坏赔偿等费用会在下单或结算时单独、清晰列示。</p>
<h2>四、不公平合同条款</h2>
<p>我们的标准格式合同受不公平合同条款制度约束。若某项条款被认定为不公平，该条款对您不具约束力，合同其余部分在可行范围内继续有效。</p>
<h2>五、押金</h2>
<p>押金用于担保设备按约归还且无超出正常损耗的损坏。正常归还后，押金在验机完成后退还；任何扣款都会书面说明原因和金额。详见<a href="/refund-policy">《退款政策》</a>。</p>
<h2>六、如何主张权利</h2>
<p>请先通过 {company_email} 或 {company_phone} 联系我们，并参阅<a href="/complaints">《投诉与争议解决政策》</a>。您也可以联系所在州或领地的公平交易机构或 ACCC。</p>
<h2>七、联系我们</h2>
<p>{company_name}<br>地址：{company_address}<br>电话：{company_phone}<br>邮箱：{company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 5. 协议版本元数据：把新增 4 项并入 legalMetadata（仅补缺，不覆盖已有键）
------------------------------------------------------------------------------
-- 极端情况下（迁移 0114 未执行）该行可能不存在，先补一个空对象兜底。
INSERT OR IGNORE INTO systemSettings (key, value) VALUES ('legalMetadata', '{}');

-- json_patch(A, B)：以 B 为 RFC 7386 合并补丁作用于 A，B 的键覆盖 A。
-- 这里 A = 新增 4 项的默认值，B = 现有 legalMetadata，因此现有键保持不变，
-- 仅当 cookie/complaints/aup/consumer 不存在时才落入默认值。
UPDATE systemSettings
SET value = json_patch(
      '{"cookie":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"complaints":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"aup":{"version":"1.0","lastUpdatedDate":"2026-09-07"},"consumer":{"version":"1.0","lastUpdatedDate":"2026-09-07"}}',
      CASE
        WHEN value IS NULL OR TRIM(value) = '' OR json_valid(value) = 0 THEN '{}'
        ELSE value
      END
    ),
    updatedAt = CURRENT_TIMESTAMP
WHERE key = 'legalMetadata';
