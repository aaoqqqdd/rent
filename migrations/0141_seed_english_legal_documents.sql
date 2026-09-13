-- Copyright (c) 2026 jiongjiong123441. All rights reserved.
-- Licensed under PolyForm Noncommercial 1.0.0.
-- Noncommercial use, modification, and distribution are permitted.
-- Keep this notice and the LICENSE file with all copies and modified versions.

-- 为 10 份法律文档（0114/0115 中植入的中文正本）新增对应的英文占位翻译字段
-- （*En 键）。这些英文内容是机器翻译起草稿，供管理员在 /admin/templates 复核、
-- 编辑或替换；公开页面会在英文版本上方额外显示一条"非官方翻译，以中文原文
-- 为准"的提示（提示文本由页面模板渲染，不存入本字段）。
--
-- 安全约定与 0114/0115 一致：仅当对应字段「不存在」或「为空」时才写入，
-- 绝不覆盖管理员已保存的内容。每个文档的标题、条款结构与列表都与中文原文
-- 一一对应；所有 {template_variable} 占位符原样保留，未做任何改写。

------------------------------------------------------------------------------
-- 1. User Terms (userTermsEn) — mirrors 0114 userTerms
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('userTermsEn',
'<h1>User Terms</h1>
<p>These User Terms (the "Terms") are entered into between {company_name} (ABN {company_abn}, "we", "us" or "our") and any person who accesses or uses this website and related services ("you"). By registering an account, submitting a rental application, or otherwise using the service, you confirm that you have read, understood, and agree to these Terms.</p>
<p><strong>Version:</strong> {user_terms_version}&emsp;<strong>Last updated:</strong> {user_terms_last_updated_date}</p>

<h2>1. Eligibility and Accounts</h2>
<ul>
<li>You must be at least 18 years old, have full legal capacity, and be able to provide a delivery and contact address within Australia.</li>
<li>You must provide true, accurate, complete, and up-to-date registration and identity information. Providing false information may constitute a misleading representation under the Australian Consumer Law.</li>
<li>You must keep your account credentials secure and are responsible for all activity carried out through your account. You must notify us immediately if you become aware of any unauthorised use.</li>
</ul>

<h2>2. Description of Services</h2>
<p>This website provides device listings, online ordering, electronic contract signing, payment, order management, and after-sales support. Your specific rights and obligations for a device rental are governed by the Device Rental Agreement you sign and the resulting rental contract. All prices are displayed in Australian dollars (AUD) as a single price inclusive of Goods and Services Tax (GST), in accordance with section 48 of the Australian Consumer Law.</p>

<h2>3. Acceptable Use</h2>
<ul>
<li>You must not use the service for any unlawful activity, or to infringe the intellectual property, privacy, or other legal rights of others.</li>
<li>You must not interfere with or disrupt the operation of the website, bypass security measures, gain unauthorised access, or perform scraping or stress testing.</li>
<li>You must not impersonate another person when placing an order or signing a contract.</li>
</ul>

<h2>4. Third-Party Payments</h2>
<p>Credit card payments are processed by a third-party payment provider (such as Stripe) and are subject to its terms. We do not collect or store your full credit card number or security code. Rules for paying by account balance or bank transfer are set out on the website and on the order page.</p>

<h2>5. Intellectual Property</h2>
<p>The text, interface, branding, data arrangement, and software of this website belong to us or the relevant rights holders and are protected by laws including the Copyright Act 1968 (Cth). You must not copy, adapt, distribute, or use them for commercial purposes without our written permission.</p>

<h2>6. Consumer Guarantees and Limitation of Liability</h2>
<p>The goods and services we supply come with consumer guarantees under the Australian Consumer Law that <strong>cannot be excluded, restricted, or modified</strong>. In relation to services, you are entitled to have the services provided with due care and skill; for a major failure, you are entitled to terminate the contract and obtain a refund.</p>
<p>To the maximum extent permitted by law, and without affecting the non-excludable rights above, we are not liable for indirect, incidental, or consequential loss arising from your use or inability to use the website; where our liability can be limited by law, it is limited to re-supplying the services or paying the reasonable cost of having the services re-supplied. Nothing in these Terms excludes or limits any liability that cannot lawfully be excluded.</p>

<h2>7. Privacy</h2>
<p>We handle your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles. See our <a href="/privacy">Privacy Policy</a> for details.</p>

<h2>8. Changes to This Agreement</h2>
<p>We may amend these Terms for operational, security, or legal reasons. Material changes will be notified in advance via a website announcement or email. Continuing to use the service after a change takes effect means you accept it; if you do not agree, you may stop using the service and close your account.</p>

<h2>9. Suspension and Termination</h2>
<p>If you seriously or repeatedly breach these Terms, or engage in fraud or unlawful conduct, we may suspend or terminate your account after reasonable notice; in urgent situations we may act immediately. Termination does not affect rights and obligations that arose before termination.</p>

<h2>10. Governing Law and Disputes</h2>
<p>These Terms are governed by the laws of the State of Victoria, Australia, and both parties submit to the non-exclusive jurisdiction of its courts. If a dispute arises, please contact us first using the details below to try to resolve it; you may also seek assistance from Consumer Affairs Victoria or the Australian Competition and Consumer Commission (ACCC).</p>

<h2>11. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 2. Device Rental Agreement (rentalTermsEn) — mirrors 0114 rentalTerms
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('rentalTermsEn',
'<h1>Device Rental Agreement</h1>
<p>This Device Rental Agreement (the "Agreement") is entered into between <strong>{company_name}</strong> (ABN {company_abn}, the "Lessor") and <strong>{signer_name}</strong> (the "Lessee"), and constitutes a legally binding rental (bailment) contract between the parties.</p>
<p><strong>Agreement version:</strong> {rental_agreement_version}&emsp;<strong>Last updated:</strong> {rental_agreement_last_updated_date}&emsp;<strong>Jurisdiction:</strong> {jurisdiction}</p>

<h2>1. Rented Device</h2>
<ul>
<li>Device name: {device_name} (model {device_model})</li>
<li>Serial number: {device_sn}</li>
<li>Condition on delivery: the device is in good working order at the time of delivery; the Lessee should inspect and confirm this at pickup.</li>
</ul>

<h2>2. Rental Period and Fees</h2>
<ul>
<li>Rental period: {start_date} to {end_date}, {rental_days} days in total.</li>
<li>Daily rate: AUD$ {daily_rate}; total rent: AUD$ {total_rent} (GST included: {gst_included}).</li>
<li>Security bond: AUD$ {deposit_amount}.</li>
<li>Overdue fee: AUD$ {late_fee_per_day} per day, being a reasonable pre-estimate of the loss caused by continued unauthorised possession, and not a penalty.</li>
</ul>

<h2>3. Security Bond</h2>
<p>The security bond secures the Lessee''s performance of this Agreement. It is <strong>not</strong> prepaid rent and is not a penal sum. Once the device has been returned and inspected, the Lessor will refund the refundable portion within <strong>10 business days</strong>. If any amount is deducted from the bond, the Lessor will provide an itemised explanation and supporting evidence, and deductions are limited to actual, reasonable costs (for example, repair or replacement costs beyond fair wear and tear, missing accessories, necessary cleaning fees, or overdue fees). Any dispute about a deduction may be raised under the dispute clause of this Agreement.</p>

<h2>4. Ownership and Use Restrictions</h2>
<ul>
<li>Ownership of the device remains with the Lessor at all times. This is a short-term rental not exceeding 4 months under which the Lessee has no right or obligation to purchase the device, and it does <strong>not</strong> constitute a "consumer lease" or credit contract under the National Credit Code.</li>
<li>The Lessee must not sublet, lend, sell, or pledge the device, or remove it from Australia.</li>
<li>The device may only be used for lawful purposes. It must not be disassembled or modified, and asset tags or management software must not be removed, nor may the operating system be re-flashed without authorisation.</li>
<li>The Lessee must keep the operating system and security updates current and keep login credentials secure.</li>
</ul>

<h2>5. Risk, Damage, and Compensation</h2>
<p>From the time of delivery until the device is returned and receipt is confirmed by the Lessor, the risk of loss or damage to the device is borne by the Lessee, <strong>excluding fair wear and tear</strong>. For loss or damage beyond fair wear and tear caused by the Lessee or a person the Lessee permitted to use the device, the Lessee must pay the actual repair cost; if the device cannot be repaired, compensation will be the lesser of the depreciated market replacement value or the repair cost. The Lessor will provide a repair quote or evidence of replacement value. The Lessee may take out their own insurance to cover these risks.</p>

<h2>6. Device Management Software</h2>
<p>The device may come pre-installed with the Lessor''s management software, used to report device status, hardware information, and rental-period information, and to carry out remote actions such as locking, restarting, or wiping data in the circumstances set out in the <a href="/software-terms">Software Terms</a>. The handling of related personal information is described in the <a href="/privacy">Privacy Policy</a>. A data wipe will delete user data stored on the device, so the Lessee should back up any data in advance.</p>

<h2>7. Return</h2>
<p>The Lessee must return the device at the end of the rental period, at the agreed time and location, in the condition it was delivered in (fair wear and tear excepted), together with all accessories. Failure to return the device on time will incur the daily overdue fee under clause 2, without affecting the Lessor''s right to recover other losses at law or to recover the device under clause 9.</p>

<h2>8. Consumer Guarantees</h2>
<p>The goods and services supplied under this Agreement come with consumer guarantees under the Australian Consumer Law, including that the device is of <strong>acceptable quality</strong>, matches its description, and is fit for any disclosed purpose, and that services are provided with due care and skill. These guarantees <strong>cannot be excluded</strong>. For a major failure, the Lessee is entitled to terminate this Agreement and seek a refund, or to compensation for any reduction in value; for a failure that is not major, the Lessor will repair or replace within a reasonable time.</p>

<h2>9. Breach and Recovery</h2>
<p>If the Lessee fails to pay amounts when due, breaches a use restriction, or engages in fraud, the Lessor may terminate this Agreement after giving reasonable written notice and an opportunity to remedy the breach. The Lessor may only recover the device by lawful means and must not enter a residence or use coercion. Termination does not affect payment obligations that have already accrued.</p>

<h2>10. Limitation of Liability</h2>
<p>To the extent permitted by law, and without affecting the non-excludable consumer guarantees above, the Lessor is not liable for the Lessee''s data loss, business interruption, or other indirect or consequential loss; where the Lessor''s liability can be limited by law, it is limited to re-supplying the services or paying the reasonable cost of doing so, or to the total rent paid under this Agreement.</p>

<h2>11. Force Majeure</h2>
<p>Neither party is liable for delay or failure to perform caused by an event beyond its reasonable control (such as natural disaster, war, strikes, telecommunications or power outages, or government action), to the extent affected, provided that the affected party notifies the other party promptly and takes reasonable steps to mitigate the impact.</p>

<h2>12. Electronic Signature</h2>
<p>The parties agree to enter into and sign this Agreement electronically. Under the Electronic Transactions Act 1999 (Cth) and the Electronic Transactions (Victoria) Act 2000, an electronic signature has the same legal effect as a handwritten signature. The system records the signing time, IP address, and device information as evidence of signing.</p>

<h2>13. General</h2>
<p>This Agreement, together with the policies it references, constitutes the entire agreement between the parties regarding the device rental. This Agreement is governed by the laws of the State of Victoria, and both parties submit to the non-exclusive jurisdiction of its courts. If any term is found invalid or unenforceable, the remaining terms remain in effect.</p>

<h2>14. Contact Details</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>
<p>Payment account&emsp;BSB: {bank_bsb}&emsp;Account number: {bank_account}&emsp;Account name: {account_name}</p>

<hr>
<p>Lessee signature: {signer_name}&emsp;&emsp;Signed at: {sign_time}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 3. Terms of Service (serviceTermsEn) — mirrors 0114 serviceTerms
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('serviceTermsEn',
'<h1>Terms of Service</h1>
<p>These Terms of Service apply to the website and online services operated by {company_name} (ABN {company_abn}). By using this website, creating an account, or submitting a rental application, you accept these Terms.</p>
<p><strong>Version:</strong> {service_terms_version}&emsp;<strong>Last updated:</strong> {service_terms_last_updated_date}</p>

<h2>1. Scope of Services</h2>
<p>We provide device browsing, online booking, electronic contract signing, payment, order tracking, and after-sales support through this website. The website may contain content or links provided by third parties, for which we are not responsible.</p>

<h2>2. Orders and Formation of Contract</h2>
<p>Devices and prices displayed on the website are an invitation to treat. A rental contract is formed once we have confirmed your order and you have completed electronic contract signing and any required payment. If a device is unavailable or information is incorrect, we may decline the order before the contract is formed and will provide a full refund.</p>

<h2>3. Price, GST, and Fees</h2>
<ul>
<li>All prices are displayed in Australian dollars (AUD) as a single price inclusive of GST, in accordance with section 48 of the Australian Consumer Law.</li>
<li>We issue tax invoices under A New Tax System (Goods and Services Tax) Act 1999.</li>
<li>Paying by credit card may incur a payment processing fee, the rate for which is clearly disclosed on the checkout page (currently 2.5% of the principal amount).</li>
</ul>

<h2>4. Cancellations and Refunds</h2>
<p>Order cancellations, security bond refunds, and early returns are handled in accordance with our <a href="/refund-policy">Cancellation and Refund Policy</a>. That policy supplements, and does not limit, your rights under the Australian Consumer Law.</p>

<h2>5. Availability of the Service</h2>
<p>We aim to keep the website available but do not guarantee that it will be uninterrupted or error-free. We may temporarily suspend the service for maintenance, security, or operational reasons and will endeavour to give advance notice.</p>

<h2>6. Acceptable Use</h2>
<p>You must not interfere with the operation of the website, bypass security measures, impersonate another person, upload malicious code, or use the website for unlawful purposes.</p>

<h2>7. Consumer Guarantees and Liability</h2>
<p>We provide services with due care and skill; this Australian Consumer Law guarantee cannot be excluded. To the extent permitted by law and without affecting that guarantee, we are not liable for indirect or consequential loss, and where our liability can be limited by law, it is limited to re-supplying the relevant services or paying the reasonable cost of doing so.</p>

<h2>8. Indemnity</h2>
<p>You must indemnify us for third-party claims, direct losses, and reasonable costs we incur as a result of your breach of these Terms or unlawful use of the website, reduced proportionately to reflect your degree of fault.</p>

<h2>9. Changes to These Terms</h2>
<p>We may amend these Terms; material changes will be announced on the website or notified by email. Continuing to use the service after a change takes effect means you accept it.</p>

<h2>10. Governing Law</h2>
<p>These Terms are governed by the laws of the State of Victoria, Australia, and both parties submit to the non-exclusive jurisdiction of its courts.</p>

<h2>11. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 4. Privacy Policy (privacyPolicyEn) — mirrors 0114 privacyPolicy
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('privacyPolicyEn',
'<h1>Privacy Policy</h1>
<p>{company_name} (ABN {company_abn}, "we", "us" or "our") handles personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs). This Policy explains what information we collect, how we use and disclose it, and how you can access and correct it.</p>
<p><strong>Version:</strong> {privacy_policy_version}&emsp;<strong>Last updated:</strong> {privacy_policy_last_updated_date}</p>

<h2>1. Personal Information We Collect</h2>
<ul>
<li><strong>Identity and contact details:</strong> name, date of birth, phone number, email address, billing and delivery address.</li>
<li><strong>Identity verification information (sensitive information):</strong> the type and number of an identity document such as a passport or driver licence, collected only with your consent, for identity verification and fraud prevention.</li>
<li><strong>Rental and transaction records:</strong> orders, contracts, payment and refund records, security bond settlements, electronic signatures and their metadata (signing time, IP address, device and browser information).</li>
<li><strong>Payment information:</strong> processed by a third-party payment provider; we do not store full card numbers or security codes.</li>
<li><strong>Device and technical information:</strong> logs, cookies, and device identifiers collected through the website; where management software is installed on a device, this also includes device status, a hardware inventory, and approximate location information.</li>
</ul>

<h2>2. How We Collect Information</h2>
<p>We mainly collect information directly from you (when you register, place an order, sign a contract, or contact customer support). We may also collect information through technical means on the website or through device management software. Where we obtain your information from a third party (such as a referrer or a payment provider), we will notify you where reasonably practicable.</p>

<h2>3. Purposes of Use (APP 6)</h2>
<ul>
<li>Creating and managing accounts, verifying identity, and assessing and processing rental applications;</li>
<li>Entering into and performing rental contracts, delivering and recovering devices, and processing payments, security bonds, and refunds;</li>
<li>Providing customer support and handling disputes and damage claims;</li>
<li>Preventing fraud, safeguarding the security of the website and devices, and recovering outstanding amounts;</li>
<li>Sending you marketing communications about similar services, unless you have opted out;</li>
<li>Complying with legal obligations and cooperating with law enforcement or regulatory requirements.</li>
</ul>

<h2>4. Who We Disclose Information To</h2>
<p>Where necessary for the purposes above, we may disclose personal information to: payment providers (such as Stripe), email service providers (such as Resend), logistics and repair providers, professional advisers, credit reporting or debt-recovery agencies, and government agencies or law enforcement where required or authorised by law. We do not sell personal information to third parties for their own marketing purposes.</p>

<h2>5. Overseas Disclosure (APP 8)</h2>
<p>Some of our service providers store or process data outside Australia, potentially including the United States and other countries. We take reasonable steps to require these recipients to protect your information in a manner consistent with the Australian Privacy Principles.</p>

<h2>6. Direct Marketing (APP 7 and the Spam Act 2003)</h2>
<p>Commercial emails will identify the sender and provide a convenient way to opt out. You may opt out of marketing communications at any time or contact us to stop receiving them; transactional notices (such as order, payment, contract, or security alerts) are not affected by opting out.</p>

<h2>7. Security and Retention</h2>
<p>We take reasonable technical and organisational measures to protect personal information from loss, misuse, and unauthorised access. We retain information only for as long as necessary to fulfil the purpose of collection or as required by law (for example, tax and transaction records are generally retained for 7 years), after which it is destroyed or de-identified. Sensitive identity document information is deleted as soon as practicable once verification is complete and there is no legal requirement to retain it.</p>

<h2>8. Notifiable Data Breaches</h2>
<p>If a data breach occurs that is likely to result in serious harm to you, we will notify you and report the breach to the Office of the Australian Information Commissioner (OAIC) under the Notifiable Data Breaches scheme in Part IIIC of the Privacy Act.</p>

<h2>9. Access and Correction (APP 12 and 13)</h2>
<p>You may request access to the personal information we hold about you and request correction of any inaccurate information. Please contact us using the details below. We generally respond within 30 days and do not charge an unreasonable fee for access requests.</p>

<h2>10. Cookies</h2>
<p>The website uses cookies to maintain your login session, protect security, and improve your experience. You may manage or disable cookies in your browser, but some features may be affected.</p>

<h2>11. Complaints</h2>
<p>If you believe we have breached the Australian Privacy Principles, please contact our privacy officer first. We will investigate and respond within a reasonable period. If you are not satisfied with the outcome, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC, www.oaic.gov.au, phone 1300 363 992).</p>

<h2>12. Changes to This Policy</h2>
<p>We may update this Policy from time to time. The updated version will be published on this page and will note its effective date.</p>

<h2>13. Contact Us</h2>
<p>Privacy Officer — {company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 5. Software Terms (softwareTermsEn) — mirrors 0114 softwareTerms
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('softwareTermsEn',
'<h1>Software Terms</h1>
<p>These Software Terms (the "Agreement") apply to the device management software (the "Software") provided by {company_name} (ABN {company_abn}) with a rented device. By installing, running, or using the Software, you agree to this Agreement.</p>
<p><strong>Version:</strong> {software_terms_version}&emsp;<strong>Last updated:</strong> {software_terms_last_updated_date}</p>

<h2>1. Scope of Licence</h2>
<p>We grant you a limited, revocable, non-transferable, non-exclusive licence to use the Software solely on your rented device during the rental period, for device management and technical support purposes. Ownership of and intellectual property rights in the Software remain with us or our licensors.</p>

<h2>2. Restrictions on Use</h2>
<ul>
<li>You must not copy, rent, sublicense, or distribute the Software;</li>
<li>You must not reverse engineer, decompile, or disassemble the Software, except to the extent expressly permitted by law, such as under section 47D of the Copyright Act 1968 (Cth) for interoperability purposes;</li>
<li>You must not bypass, disable, or interfere with the Software''s licensing, security, or management functions;</li>
<li>You must not use the Software for any unlawful purpose.</li>
</ul>

<h2>3. Data Collection</h2>
<p>The Software collects and reports, as required for management purposes: device power and online status, hardware and system inventory, software version, battery level and health, network and approximate location information, and events relevant to the rental period and compliance. The handling of related personal information is described in the <a href="/privacy">Privacy Policy</a>.</p>

<h2>4. Remote Actions</h2>
<p>We may perform remote actions on the device, such as locking, restarting, logging out, factory reset, or data wipe, in the following circumstances:</p>
<ul>
<li>the device has not been returned after notice following the end of the rental period;</li>
<li>there is reasonable suspicion that the device has been stolen, involved in fraud, or used unlawfully; or</li>
<li>there is a security risk or a legal or regulatory requirement.</li>
</ul>
<p>Where reasonably practicable, we will notify you in advance. <strong>A data wipe will delete user data on the device</strong>, so you should back up your data regularly. To the extent permitted by law and without affecting the non-excludable guarantees under the Australian Consumer Law, we are not liable for the loss of user data resulting from a lawful remote action.</p>

<h2>5. Updates</h2>
<p>The Software may automatically check for and install security and functionality updates to maintain the security of the service and the device.</p>

<h2>6. Consumer Guarantees and Disclaimer</h2>
<p>The Software comes with the non-excludable consumer guarantees under the Australian Consumer Law. Beyond those guarantees, the Software is provided "as is" and we make no further warranty that it will meet your particular requirements or operate uninterrupted or error-free.</p>

<h2>7. Term and Termination</h2>
<p>This Agreement takes effect together with the rental contract and terminates when the rental period ends or the device is returned. On termination, you must stop using the Software and allow us to uninstall it; we may disable accounts and connections associated with the Software.</p>

<h2>8. Governing Law</h2>
<p>This Agreement is governed by the laws of the State of Victoria, Australia, and both parties submit to the non-exclusive jurisdiction of its courts.</p>

<h2>9. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 6. Cancellation and Refund Policy (copyrightNoticeEn) — mirrors 0114 copyrightNotice
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('copyrightNoticeEn',
'<h1>Cancellation and Refund Policy</h1>
<p>This Policy explains how {company_name} (ABN {company_abn}) handles order cancellations, security bond refunds, early returns, and device faults.</p>
<p><strong>Version:</strong> {refund_policy_version}&emsp;<strong>Last updated:</strong> {refund_policy_last_updated_date}</p>

<h2>1. Your Rights Under the Australian Consumer Law</h2>
<p>This Policy <strong>supplements</strong>, and does not limit, your rights under the Australian Consumer Law. If a device or service has a <strong>major failure</strong>, you are entitled to cancel and obtain a refund, or to compensation for a reduction in value; for a failure that is not major, we will repair or replace within a reasonable time. We will not refuse these statutory remedies merely because a particular time limit has passed.</p>

<h2>2. Change-of-Mind Cancellation (Before Pickup)</h2>
<ul>
<li>Within 24 hours of placing the order and before pickup: rent and security bond already paid are refunded in full.</li>
<li>More than 24 hours after placing the order but before the agreed pickup date: rent already paid is refunded, less any payment processing fee actually incurred and non-refundable; the security bond is refunded in full.</li>
</ul>

<h2>3. Cancellation or Early Return After Pickup</h2>
<p>Rent is charged for the days actually used (including any agreed minimum rental period) and is not refundable for those days. The remaining unused days are refunded after deducting any costs actually incurred. The security bond is handled under clause 5.</p>

<h2>4. No-show</h2>
<p>If you do not collect the device at the agreed time without prior notice, we may deduct costs actually incurred for preparation, reservation, and processing; the remaining amount is refunded.</p>

<h2>5. Security Bond Refund</h2>
<ul>
<li>Once the device has been returned and inspected, we refund the refundable portion of the security bond within <strong>10 business days</strong>.</li>
<li>If any amount is deducted, we will provide an <strong>itemised settlement statement</strong> together with supporting evidence such as repair quotes, photographs, or invoices.</li>
<li>Deductions are limited to actual, reasonable costs: repair or replacement costs beyond fair wear and tear, missing accessories, necessary cleaning fees, and overdue fees. Fair wear and tear is not deducted.</li>
<li>Deductions must not be punitive and are subject to the unfair contract terms regime under the Australian Consumer Law.</li>
</ul>

<h2>6. Device Faults</h2>
<p>If a device develops a fault during the rental period through no fault of yours, we will arrange a repair, replacement, or a refund for unused days. If the fault results from misuse, an accident, or an unauthorised modification, related costs may be charged to you in accordance with the rental agreement.</p>

<h2>7. Refund Method and Timing</h2>
<ul>
<li>Refunds can be made to the original payment method or to your account balance, as you choose.</li>
<li>Credit card refunds are generally received within 5–10 business days of processing; bank transfer refunds may take additional time.</li>
<li>Refund amounts and currency match the original payment (Australian dollars, AUD).</li>
</ul>

<h2>8. How to Apply</h2>
<p>Please apply through the order details page or by emailing {company_email}, quoting your order number. We will respond with the outcome within 5 business days of receiving your application.</p>

<h2>9. Complaints</h2>
<p>If you disagree with a refund outcome, please contact us first. You may also seek assistance from Consumer Affairs Victoria (consumer.vic.gov.au) or the Australian Competition and Consumer Commission (ACCC, accc.gov.au).</p>

<h2>10. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 7. Cookie Policy (cookiePolicyEn) — mirrors 0115 cookiePolicy
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('cookiePolicyEn',
'<h1>Cookie Policy</h1>
<p>This Cookie Policy explains how {company_name} (ABN {company_abn}) uses cookies and similar technologies when you visit this website. It should be read together with our <a href="/privacy">Privacy Policy</a>.</p>
<p><strong>Version:</strong> {cookie_policy_version}&emsp;<strong>Last updated:</strong> {cookie_policy_last_updated_date}</p>
<h2>1. What Are Cookies</h2>
<p>Cookies are small text files stored on your device by a website to help it function correctly, remember your preferences, and understand how the website is used. Similar technologies include the browser''s localStorage and session storage.</p>
<h2>2. Cookies We Use</h2>
<ul>
<li><strong>Essential cookies:</strong> used to maintain your login session (<code>session</code>), for security checks, and for form anti-forgery protection. Without these cookies the website cannot function properly, so separate consent is not required.</li>
<li><strong>Functional cookies:</strong> remember preferences such as a referral code (<code>referral_code</code>, retained for up to 30 days) to make your experience smoother.</li>
<li><strong>Security and risk control:</strong> used for bot verification (Cloudflare Turnstile) and to prevent fraud and abuse.</li>
</ul>
<p>This website does not currently serve third-party advertising cookies and does not use cookies for cross-site behavioural tracking.</p>
<h2>3. Managing Cookies</h2>
<p>You can view, delete, or block cookies through your browser settings. Please note that disabling essential cookies will prevent you from logging in or completing an order.</p>
<h2>4. Updates to This Policy</h2>
<p>We may update this Policy from time to time. The updated version will be published on this page with its update date noted.</p>
<h2>5. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 8. Complaints and Dispute Resolution Policy (complaintsPolicyEn) — mirrors 0115 complaintsPolicy
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('complaintsPolicyEn',
'<h1>Complaints and Dispute Resolution Policy</h1>
<p>{company_name} (ABN {company_abn}) is committed to handling customer complaints fairly and promptly. This Policy explains how to make a complaint, how it will be handled, and available external escalation channels.</p>
<p><strong>Version:</strong> {complaints_policy_version}&emsp;<strong>Last updated:</strong> {complaints_policy_last_updated_date}</p>
<h2>1. How to Make a Complaint</h2>
<p>Please contact us by email at {company_email} or by phone at {company_phone}, providing your order number, a description of what happened, and your desired resolution. If your complaint relates to a specific order, you may also leave a message on the order details page.</p>
<h2>2. Process and Timeframes</h2>
<ul>
<li>We will acknowledge receipt of your complaint within <strong>3 business days</strong>.</li>
<li>We will generally provide a written outcome within <strong>15 business days</strong>; for complex matters, we will let you know the expected timeframe and keep you updated on progress.</li>
<li>The outcome will explain our conclusion, the reasons for it, and any remedy available.</li>
</ul>
<h2>3. Internal Escalation</h2>
<p>If you are not satisfied with the outcome, you may request that your complaint be escalated to management for review.</p>
<h2>4. External Dispute Resolution</h2>
<p>If the above process does not resolve your complaint, you may seek assistance from the following bodies (without affecting your other legal rights):</p>
<ul>
<li>your state or territory consumer affairs or fair trading body, such as Consumer Affairs Victoria or NSW Fair Trading;</li>
<li>the Australian Competition and Consumer Commission (ACCC); or</li>
<li>the Office of the Australian Information Commissioner (OAIC), if the dispute concerns the handling of personal information.</li>
</ul>
<h2>5. Consumer Guarantees</h2>
<p>This Policy does not exclude or limit any consumer guarantee rights you have under the Australian Consumer Law.</p>
<h2>6. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 9. Acceptable Use Policy (acceptableUsePolicyEn) — mirrors 0115 acceptableUsePolicy
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('acceptableUsePolicyEn',
'<h1>Acceptable Use Policy</h1>
<p>This Acceptable Use Policy (the "Policy") applies to everyone who rents a device from, or uses the device management software of, {company_name} (ABN {company_abn}), and forms part of the User Terms and the Device Rental Agreement.</p>
<p><strong>Version:</strong> {acceptable_use_policy_version}&emsp;<strong>Last updated:</strong> {acceptable_use_policy_last_updated_date}</p>
<h2>1. Permitted Use</h2>
<p>The rented device is provided for the Lessee''s lawful personal or business office use during the rental period.</p>
<h2>2. Prohibited Conduct</h2>
<ul>
<li>Any activity that breaches Australian federal, state, or territory law, including infringing intellectual property, distributing unlawful content, or committing fraud;</li>
<li>Storing, publishing, or distributing material involving child sexual abuse, terrorism, incitement to violence, or unlawful pornography;</li>
<li>Sending spam or commercial electronic messages in breach of the Spam Act 2003;</li>
<li>Gaining unauthorised access to other systems, carrying out network attacks or port scanning, or distributing malware or ransomware;</li>
<li>Using the device for cryptocurrency mining or other high-load tasks that cause abnormal hardware wear, excessive power consumption, or overheating risk;</li>
<li>Subletting, lending, selling, or pledging the device, or removing it from Australia without prior written consent;</li>
<li>Disassembling or modifying the device, or removing or tampering with asset tags, management software, or operating system security settings;</li>
<li>Bypassing, disabling, or interfering with the device management software or its status-reporting functions.</li>
</ul>
<h2>3. Data and Backups</h2>
<p>The Lessee is responsible for the lawfulness of, and for backing up, any personal data stored on the device. Please erase your personal data before returning the device; the device will be reset after return, and we are not responsible for any resulting data loss.</p>
<h2>4. Consequences of Breach</h2>
<p>Breach of this Policy may result in the device being remotely locked, the rental being terminated early, recovery of related costs and losses, and, where required by law, a report to law enforcement. We will make reasonable efforts to notify the Lessee before taking action, except in urgent situations or those involving safety or unlawful conduct.</p>
<h2>5. Reporting</h2>
<p>If you become aware of conduct that breaches this Policy, please contact {company_email}.</p>
<h2>6. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';

------------------------------------------------------------------------------
-- 10. Rights Under the Australian Consumer Law (consumerRightsEn) — mirrors 0115 consumerRights
------------------------------------------------------------------------------
INSERT INTO systemSettings (key, value) VALUES ('consumerRightsEn',
'<h1>Rights Under the Australian Consumer Law</h1>
<p>This page summarises the rights you have when renting a device from {company_name} (ABN {company_abn}) under the Australian Consumer Law (Schedule 2 to the Competition and Consumer Act 2010). This page is for information only, does not constitute legal advice, and does not replace the legislation.</p>
<p><strong>Version:</strong> {consumer_rights_version}&emsp;<strong>Last updated:</strong> {consumer_rights_last_updated_date}</p>
<h2>1. Non-excludable Consumer Guarantees</h2>
<p>The goods and services we supply come with consumer guarantees that cannot be excluded, restricted, or modified, including that:</p>
<ul>
<li>goods match their description and are of acceptable quality, and are fit for any disclosed or known particular purpose;</li>
<li>services are provided with due care and skill and completed within a reasonable time;</li>
<li>in relation to the rental (bailment), you have quiet possession of the device during the rental period.</li>
</ul>
<h2>2. Remedies When Something Goes Wrong</h2>
<ul>
<li><strong>Minor problems:</strong> we may choose to repair or replace the device, or provide a refund of the relevant fee, within a reasonable time.</li>
<li><strong>Major problems:</strong> you may end the rental and claim a refund for the unused rental period, or seek compensation for any reasonably foreseeable loss caused. If the device suffers a major fault through no fault of yours, you will not be charged for rental downtime while it is repaired.</li>
</ul>
<h2>3. Price and Tax</h2>
<p>Prices shown on the website are a single price in Australian dollars inclusive of Goods and Services Tax (GST). Fees such as the security bond, overdue fees, and damage compensation are shown separately and clearly at the time of order or settlement.</p>
<h2>4. Unfair Contract Terms</h2>
<p>Our standard form contract is subject to the unfair contract terms regime. If a term is found to be unfair, that term will not bind you, and the rest of the contract will continue to operate to the extent practicable.</p>
<h2>5. Security Bond</h2>
<p>The security bond secures the return of the device as agreed and without damage beyond fair wear and tear. After a normal return, the bond is refunded once the device has been inspected; any deduction will be explained in writing, stating the reason and amount. See our <a href="/refund-policy">Refund Policy</a> for details.</p>
<h2>6. How to Exercise Your Rights</h2>
<p>Please contact us first at {company_email} or {company_phone}, and see our <a href="/complaints">Complaints and Dispute Resolution Policy</a>. You may also contact your state or territory fair trading body or the ACCC.</p>
<h2>7. Contact Us</h2>
<p>{company_name}<br>Address: {company_address}<br>Phone: {company_phone}<br>Email: {company_email}</p>')
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
WHERE systemSettings.value IS NULL OR TRIM(systemSettings.value) = '';
