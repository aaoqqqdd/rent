/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// The site is server-rendered in Chinese. Keeping this small client-side layer
// in one place lets every current and future page share the same language
// preference without duplicating page templates or persisting UI state in D1.
export const languageScript = String.raw`
(function () {
  'use strict';
  var storageKey = 'rent-language';
  var originalTitle = document.title;
  var translations = {
    '跳到主要内容': 'Skip to main content', '正在加载工作台': 'Loading workspace', '正在载入工作台': 'Loading workspace', '设备租赁控制台': 'Equipment rental console', '登录': 'Sign in',
    '注册': 'Register', '通知中心': 'Notifications', '🎉新优惠现已开启！': '🎉A new offer is now live!', '正在加载通知…': 'Loading notifications…',
    '查看全部通知': 'View all notifications', '编辑个人信息': 'Edit profile', '登出': 'Sign out', '导航': 'Navigation', '控制台': 'Dashboard', '租赁工作区': 'Rental workspace',
    '我的租赁': 'My rentals', '订单管理': 'Order management', '账户与钱包': 'Account & wallet', '我的钱包': 'My wallet', '个人资料': 'Profile', '安全设置': 'Security settings',
    '推荐计划': 'Referral program', '工作台': 'Workspace', '租赁管理': 'Rental management', '租赁订单': 'Rental orders', '进行中的租赁': 'Active rentals',
    '验机记录': 'Inspection records', '合同管理': 'Contract management', '合同列表': 'Contracts', '新建合同': 'New contract', '待签署合同': 'Pending signatures',
    '设备运营': 'Device operations', '设备管理': 'Device management', '租赁追踪': 'Rental tracking', '人员管理': 'People management', 'Staff 员工': 'Staff members',
    '通知管理': 'Notification management', '发布通知': 'Publish notification', '用户管理': 'User management', '租赁日历': 'Rental calendar', '财务管理': 'Finance',
    '财务总览': 'Finance overview', '运营分析报表': 'Operations report', '异常任务中心': 'Exception center', '优惠码管理': 'Coupon management', '推荐奖励管理': 'Referral rewards',
    '退款管理': 'Refunds', '佣金提现': 'Commission withdrawal', '系统设置': 'System settings', '协议模板': 'Agreement templates', '邮件通知模板': 'Email notification templates',
    '通讯检测': 'Connectivity check', '系统健康监控': 'System health monitoring', '数据保留策略': 'Data retention policy', '首页': 'Home', '通知': 'Notifications',
    '可租设备': 'Available devices', '租赁': 'Rentals', '订单': 'Orders', '钱包': 'Wallet', '我的': 'Profile', '管理端': 'Admin', '员工端': 'Staff', '访客合同': 'Guest contracts',
    '客户端': 'Customer', '合同中心': 'Contract center', '升级账户': 'Upgrade account', '正常': 'Healthy', '异常': 'Issue', '延迟': 'Delayed', '错误': 'Error',
    '网站法律信息': 'Legal information', '用户协议': 'User agreement', '服务条款': 'Terms of service', '隐私政策': 'Privacy policy', '更多': 'More',
    'Cookie 政策': 'Cookie policy', '退款政策': 'Refund policy', '消费者权利': 'Consumer rights', '投诉与争议': 'Complaints & disputes', '可接受使用': 'Acceptable use',
    '软件协议': 'Software agreement', '打开导航菜单': 'Open navigation menu', '打开通知中心': 'Open notifications', '关闭通知': 'Close notification', '系统状态': 'System status',
    '查看详情': 'View details', '查看通知': 'View notifications', '网站通告': 'Site announcement', '以后不再展示此通告': 'Do not show this announcement again',
    '新通知': 'New notification', '暂无通知': 'No notifications', '上一页': 'Previous', '下一页': 'Next', '第 ': 'Page ', ' 页': '', '保存': 'Save', '取消': 'Cancel',
    '删除': 'Delete', '编辑': 'Edit', '查看': 'View', '操作': 'Actions', '搜索': 'Search', '筛选': 'Filter', '提交': 'Submit', '确认': 'Confirm', '关闭': 'Close',
    '返回': 'Back', '详情': 'Details', '添加': 'Add', '新增': 'New', '修改': 'Edit', '更新': 'Update', '创建': 'Create', '导出': 'Export', '打印': 'Print', '下载': 'Download',
    '重试': 'Retry', '刷新': 'Refresh', '处理中…': 'Processing…', '请确认操作': 'Please confirm', '确定继续吗？': 'Continue?', '正在加载，请稍候…': 'Loading, please wait…',
    '姓名': 'Name', '邮箱': 'Email', '电话': 'Phone', '地址': 'Address', '备注': 'Notes', '内容': 'Content', '原因': 'Reason', '状态': 'Status', '时间': 'Time', '日期': 'Date',
    '类型': 'Type', '金额': 'Amount', '押金': 'Deposit', '租金': 'Rental fee', '总计': 'Total', '合计': 'Total', '设备': 'Device', '客户': 'Customer', '订单号': 'Order number',
    '合同': 'Contract', '付款': 'Payment', '退款': 'Refund', '收据': 'Receipt', '发票': 'Invoice', '序列号': 'Serial number', '型号': 'Model', '品牌': 'Brand',
    '数量': 'Quantity', '说明': 'Description', '证明': 'Proof', '是': 'Yes', '否': 'No', '有效': 'Active', '无效': 'Invalid', '待处理': 'Pending', '待审核': 'Pending review',
    '已审核': 'Reviewed', '审核通过': 'Approved', '已拒绝': 'Rejected', '已完成': 'Completed', '已取消': 'Cancelled', '已过期': 'Expired', '已绑定': 'Bound', '未绑定': 'Not bound',
    '可用': 'Available', '租赁中': 'Rented', '维护中': 'In maintenance', '已归还': 'Returned', '待付款': 'Awaiting payment', '待签署': 'Awaiting signature',
    '待取货': 'Ready for pickup', '归还中': 'Return pending', '已暂停': 'Suspended', '未知': 'Unknown', '设备未找到': 'Device not found', '订单未找到': 'Order not found',
    '合同未找到': 'Contract not found', '客户未找到': 'Customer not found', '无权查看订单': 'You cannot view this order', '无权查看合同': 'You cannot view this contract',
    '无法加载推荐信息': 'Unable to load referral information', '请求的资源不存在': 'The requested resource does not exist', '页面未找到': 'Page not found',
    '访问被拒绝': 'Access denied', '服务器错误': 'Server error', '需要认证': 'Authentication required', '服务不可用': 'Service unavailable', '邮箱验证': 'Email verification',
    '邮箱验证成功': 'Email verified', '验证邮箱': 'Verify email', '验证链接已失效': 'Verification link expired', '验证链接无效': 'Invalid verification link',
    '前往登录': 'Go to sign in', '找回密码': 'Forgot password', '重置密码': 'Reset password', '重置链接已失效': 'Reset link expired', '重置链接无效': 'Invalid reset link',
    '密码已更新': 'Password updated', '密码已重置，请使用新密码登录': 'Password reset. Please sign in with your new password', '当前密码不正确': 'Current password is incorrect',
    '两次输入密码不一致': 'Passwords do not match', '两次输入的新密码不一致': 'New passwords do not match', '密码格式无效': 'Invalid password format',
    '密码至少需要 8 位，并同时包含字母、数字和符号': 'Password must be at least 8 characters and include letters, numbers, and symbols', '个人信息已更新': 'Profile updated',
    '密码已更新，其他设备已退出登录': 'Password updated; other devices have been signed out', '登录失败': 'Sign-in failed', '邮箱或密码错误': 'Incorrect email or password',
    '账户已停用': 'Account disabled', '租赁设备': 'Rent a device', '设备目录': 'Device catalogue', '添加新设备': 'Add device', '编辑设备': 'Edit device', '设备详情': 'Device details',
    '设备列表': 'Devices', '租赁设备不存在': 'The rental device does not exist', '暂无可租设备': 'No devices are currently available', '租赁日期': 'Rental dates',
    '开始日期': 'Start date', '归还日期': 'Return date', '租赁天数': 'Rental days', '每天': 'per day', '选择设备': 'Select device', '选择日期': 'Select dates',
    '设备租赁日历': 'Device rental calendar', '本月': 'This month', '上个月': 'Previous month', '下个月': 'Next month', '我的订单': 'My orders', '订单详情': 'Order details',
    '当前租赁中': 'Active rentals', '余额充值': 'Top up balance', '账户余额': 'Account balance', '余额不足': 'Insufficient balance', '充值记录': 'Top-up history', '充值': 'Top up',
    '我的推荐': 'My referrals', '推荐码': 'Referral code', '加入推荐计划': 'Join referral program', '退出推荐计划': 'Leave referral program', '个人信息': 'Profile',
    '客户管理': 'Customer management', '创建客户账户': 'Create customer account', '编辑客户': 'Edit customer', '客户详情': 'Customer details', '员工仪表盘': 'Staff dashboard',
    '进行中的订单': 'Ongoing orders', '合同查看': 'Contract view', '合同签署进度': 'Contract signing progress', '新增合同': 'New contract', '归还验机': 'Return inspection',
    '保存交付记录并开始租赁': 'Save handover and start rental', '交付设备': 'Hand over device', '交付配件': 'Hand-over accessories', '管理员': 'Administrator',
    '管理员通知中心': 'Admin notifications', '用户详情': 'User details', '添加新用户': 'Add user', '编辑用户': 'Edit user', '设备运营报表': 'Device operations report',
    '收入统计': 'Revenue statistics', '远程控制': 'Remote control', '优惠码': 'Coupon', '优惠码不存在': 'Coupon not found', '优惠码无效': 'Invalid coupon',
    '优惠码已存在，请换一个代码': 'Coupon already exists; choose another code', '优惠码创建成功': 'Coupon created', '优惠码已更新': 'Coupon updated', '退款失败': 'Refund failed',
    '退款成功': 'Refund successful', '押金结算审批': 'Deposit settlement approval', '待结算押金': 'Deposits awaiting settlement', '支付争议': 'Payment disputes',
    '待处理支付争议': 'Payment disputes awaiting review', '风险标记': 'Risk flags', '异常订单': 'Anomalous orders',
    '异常订单不存在或已审核': 'Anomalous order not found or already reviewed', '历史公告': 'Announcement history', '合同数据': 'Contract data', '设备绑定': 'Device binding',
    '绑定设备': 'Bind device', '客户端安装信息': 'Client installation', '复制 6 位访问码': 'Copy 6-digit access code', '已复制': 'Copied',
    '安装程序会安装到系统目录并注册': 'The installer will install and register the client in the system directory', '前往处理': 'Handle now', '全选当前结果': 'Select all results',
    '匹配 ': 'Matched ', '共 ': 'Total ', '人': ' people', '条': ' items', '保存失败': 'Save failed', '加载失败': 'Failed to load', '操作成功': 'Operation successful',
    '操作失败': 'Operation failed', '提交成功': 'Submitted successfully', '请稍候': 'Please wait', '请重新提交': 'Please submit again', '请联系工作人员': 'Please contact staff',
    '暂无数据': 'No data', '没有找到记录': 'No records found', '打印合同': 'Print contract', '返回合同查看': 'Back to contract', '打印凭证': 'Print document',
    '返回收据查看': 'Back to receipt', '查看合同': 'View contract', '合同签署': 'Contract signing', '合同验证': 'Contract verification', '支付结果': 'Payment result',
    '发票与付款收据': 'Invoice & payment receipt', '投诉与争议解决政策': 'Complaints and dispute resolution policy', '设备租赁': 'Device rental', '合同已签署': 'Contract signed',
    '租期': 'Rental period', '设备名称': 'Device name', '日租金': 'Daily rate', '合同编号': 'Contract number', '其他': 'Other', '银行转账': 'Bank transfer',
    '配送费': 'Delivery fee', '内存': 'Memory', '账号': 'Account', '已签署': 'Signed', '银行': 'Bank', '付款后生成': 'Generated after payment',
    '租赁已确认，等待开始': 'Rental confirmed, awaiting start', '待归还': 'Pending return', '归还时间': 'Return time', '租金及服务费': 'Rental fee & service fee', '员工': 'Staff',
    '未生成': 'Not yet generated', '暂未生成': 'Not yet generated', '未设置': 'Not set', '已逾期': 'Overdue', '信用卡支付': 'Credit card payment', '手机': 'Mobile',
    '取货时间': 'Pickup time', '备注（选填）': 'Notes (optional)', '处理中': 'Processing', '电池健康': 'Battery health', '待确认': 'Awaiting confirmation', '信用卡': 'Credit card',
    '登录密码': 'Sign-in password', '至少 8 位，包含字母、数字和符号': 'At least 8 characters, including letters, numbers, and symbols', '合同版本': 'Contract version',
    '公司': 'Company', '银行名称': 'Bank name', '交付方式': 'Delivery method', '存储': 'Storage', '显卡': 'Graphics card', '未签署': 'Unsigned',
    '软件使用协议': 'Software use agreement', '政策': 'Policy', '澳大利亚消费者法': 'Australian Consumer Law', '租期结束': 'End of rental period',
    '已延期 / 租赁中': 'Extended / Rented', '归还地点': 'Return location', '账户名': 'Account name', '返回上一步': 'Back to previous step',
    '付款凭证图片链接': 'Payment proof image link', '保存卡片并支付租金': 'Save card and pay rental fee', '电池循环次数': 'Battery cycle count', '归还方式': 'Return method',
    '客户不存在': 'Customer not found', '项目': 'Item', '优惠': 'Discount', '小计': 'Subtotal', '原路退回': 'Refund to original payment method',
    '至少 8 位，并同时包含字母、数字和符号': 'At least 8 characters, including letters, numbers, and symbols', '签署日期': 'Signing date', '创建员工': 'Create staff member',
    '欢迎回来': 'Welcome back', '可接受使用政策': 'Acceptable use policy', '用户未找到': 'User not found', '信用卡预授权总额': 'Total credit card authorization',
    '优惠金额': 'Discount amount', '配送方式': 'Delivery method', '取货地点': 'Pickup location', '逾期费用': 'Overdue fee', '待结算': 'Awaiting settlement',
    '新密码': 'New password', '确认新密码': 'Confirm new password', '正式合同尚未生成': 'The formal contract has not been generated yet', '刷新页面': 'Refresh page',
    '网关错误': 'Gateway error', '电子签名': 'Electronic signature', '确认并完成签约': 'Confirm and complete signing', '损坏说明': 'Damage description',
    '验机备注': 'Inspection notes', '开机测试': 'Power-on test', '损坏照片': 'Damage photos', '方式': 'Method', '历史通告': 'Announcement history', '租赁报价': 'Rental quote',
    '收款码': 'Payment QR code', '已收取的服务费不退款': 'Service fees already charged are non-refundable', '升级正式账户': 'Upgrade to a full account',
    '访客合同中心': 'Guest contract center', '保险': 'Insurance', '紧急联系人': 'Emergency contact', '设备租赁协议': 'Device rental agreement',
    '请重新申请密码重置链接': 'Please request a new password reset link', '标题': 'Title', '付款方式': 'Payment method', '已退款': 'Refunded', '快捷操作': 'Quick actions',
    '请验证您的邮箱': 'Please verify your email', '验证您的邮箱': 'Verify your email', '租赁期间': 'During the rental', '取件地点': 'Pickup location',
    '重置您的登录密码': 'Reset your sign-in password', '已发送': 'Sent', '设置': 'Settings', '通知渠道': 'Notification channels', '配置': 'Configuration',
    '支付宝收款码': 'Alipay payment QR code', '微信收款码': 'WeChat payment QR code', '临时账户': 'Temporary account', '合同模板': 'Contract template',
    '澳大利亚消费者法下的权利': 'Rights under the Australian Consumer Law', '用户': 'User', '结束日期': 'End date', '有效至': 'Valid until', '当前步骤': 'Current step',
    '尚未开始': 'Not started', '待签合同': 'Pending contract', '退款处理中': 'Refund processing', '签名': 'Signature', '合同真伪核验': 'Contract authenticity verification',
    '立即注册': 'Register now', '支付成功': 'Payment successful', '您的订单': 'Your order', '正在生成': 'Generating', '返回客户中心': 'Back to customer center',
    '访客账户': 'Guest account', '切换到英文': 'Switch to English', '确认密码': 'Confirm password', '同意协议': 'Agree to the terms', '登录账号': 'Sign-in account',
    '登录账户': 'Sign in to account', '阅读并同意租赁协议': 'Read and agree to the rental agreement', '注册正式账户': 'Register a full account',
    '两次输入的密码不一致': 'Passwords do not match', '无服务费': 'No service fee', '优惠码（选填）': 'Promo code (optional)',
    '包含租金及服务费、押金和手续费': 'Includes rental fee & service fee, deposit, and processing fee',
    '选择后获取实时汇率': 'The real-time exchange rate is fetched after you select this option', '信用卡最终扣款': 'Final credit card charge',
    '暂时无法获取实时汇率，请稍后重试': 'Unable to fetch the exchange rate right now. Please try again later',
    '请填写有效的 HTTPS 截图链接': 'Please enter a valid HTTPS screenshot link', '放弃 / 重新选择': 'Cancel / choose again', '确认支付': 'Confirm payment', '余额': 'Balance',
    '订单信息': 'Order information', '下单时间': 'Order time', '预约时间变更记录': 'Appointment time change history', '新增服务费': 'Additional service fee',
    '待生成': 'Pending generation', '查看合同状态、签署记录和正式合同文件': 'View contract status, signing records, and the formal contract file',
    '签署时间（墨尔本）': 'Signed at (Melbourne time)', '尚未签署': 'Not yet signed', '有效期': 'Valid until', '暂无相关租赁合同': 'No related rental contract',
    '支付信息': 'Payment information', '人民币': 'RMB', '送货地址': 'Delivery address', '手续费': 'Processing fee', '历史通告分页': 'Announcement history pagination',
    '暂无历史通告': 'No announcement history', '到店自取': 'In-store pickup', '最终应付': 'Final amount due', '支付宝': 'Alipay', '提交付款凭证': 'Submit payment proof',
    '银行转账充值': 'Bank transfer top-up', '修改密码': 'Change password', '删除账户': 'Delete account', '下午': 'PM', '上午': 'AM', '订单差价': 'Order price difference',
    '保留当前邮箱': 'Keep current email', '逾期归还': 'Overdue return', '验机': 'Inspection', '损坏': 'Damage', '代表与确认': 'Representations & acknowledgements',
    '取还时间': 'Pickup/return time', '系统': 'System', '退款政策版本': 'Refund policy version', '协议最后更新日期': 'Agreement last updated',
    '租赁协议版本': 'Rental agreement version', '租赁协议最后更新日期': 'Rental agreement last updated', '正式合同版本': 'Formal contract version',
    '正式合同最后更新日期': 'Formal contract last updated', '司法管辖区': 'Jurisdiction', '客户出生日期': 'Customer date of birth', '客户国家': 'Customer country', '证件类型': 'ID type',
    '证件号码': 'ID number', '驾照到期日': 'Driver\\\'s licence expiry', '紧急联系电话': 'Emergency contact phone', '发票编号': 'Invoice number', '归还状态': 'Return status',
    '实际归还日期': 'Actual return date', '检查日期': 'Inspection date', '检查员工': 'Inspecting staff', '设备操作系统': 'Device operating system', '充电器': 'Charger',
    '公司资产编号': 'Company asset number', '设备状况': 'Device condition', '客户电子签名': 'Customer electronic signature', '公司电子签名': 'Company electronic signature',
    '签约 GPS 位置': 'Signing GPS location', '签约浏览器': 'Signing browser', '签约操作系统': 'Signing operating system', '公司代表': 'Company representative',
    '客户姓名首字母': 'Customer initials', '维修发票': 'Repair invoice', '更换费用': 'Replacement cost', '维修费用': 'Repair cost', '是否需要追回': 'Recovery required',
    '回收日期': 'Recovery date', '屏幕状况': 'Screen condition', '键盘状况': 'Keyboard condition', '触控板状况': 'Touchpad condition', '外壳状况': 'Body condition',
    '摄像头状况': 'Camera condition', '状况': 'Condition', '已归还配件': 'Accessories returned', '审批员工': 'Approving staff', '内部备注': 'Internal notes',
    '合同二维码图片': 'Contract QR code image', '是否选择保险': 'Insurance selected', '保险费用': 'Insurance fee', '保险公司': 'Insurance provider', '是否签署免责': 'Waiver signed',
    '隐私政策版本': 'Privacy policy version', '系统内部设备': 'Internal system device', '币种': 'Currency', '已支付押金': 'Deposit paid', '已支付租金': 'Rental fee paid',
    '剩余应付款': 'Remaining balance due', '押金扣除金额': 'Deposit deduction amount', '逾期天数': 'Overdue days', '签署时间': 'Signing time', '出租方（甲方）': 'Lessor (Party A)',
    '联系方式': 'Contact information', '承租方（乙方）': 'Lessee (Party B)', '证件': 'ID document', '标准租赁合同模板': 'Standard rental contract template',
    '身份验证': 'Identity verification', '充值记录不存在或已处理': 'Top-up record not found or already processed', '提前归还申请已批准': 'Early return request approved',
    '请查看通知详情中的最新版本': 'Please check the latest version in the notification details', '下架日期和时间（选填）': 'Unpublish date & time (optional)',
    '发布通告': 'Publish announcement', '下架日期和时间格式无效': 'Invalid unpublish date/time format', '下载 Windows 安装程序': 'Download Windows installer',
    '请输入您注册时使用的邮箱': 'Please enter the email you registered with', '请输入邮箱': 'Please enter your email', '发送重置邮件': 'Send reset email',
    '已想起密码': 'Remembered your password?', '去登录': 'Go to sign in', '设置新密码': 'Set new password', '保存新密码': 'Save new password',
    '专业设备租赁管理平台': 'Professional device rental management platform', '显示密码': 'Show password', '显示': 'Show', '隐藏': 'Hide', '记住我': 'Remember me',
    '忘记密码': 'Forgot password?', '还没有账号': 'Don\\\'t have an account?', '余额支付已完成': 'Balance payment completed',
    '信用卡预授权成功': 'Credit card authorization successful', '已从您的账户余额即时扣除': 'Deducted instantly from your account balance',
    '订单已完成付款，网站发票与收据已生成': 'Order payment complete; the invoice and receipt have been generated', '已预授权': 'Authorized', '已成功支付': 'Payment successful',
    '网站发票与收据已生成': 'The invoice and receipt have been generated', '已取消 Stripe 支付': 'Stripe payment cancelled',
    '本次没有扣款，订单仍等待付款。您可以手动返回选择其他支付方式': 'No charge was made; the order is still awaiting payment. You can go back and choose another payment method',
    '返回订单重新支付': 'Back to order to pay again', '登录后重新支付': 'Sign in to pay again', '银行转账等待审核': 'Bank transfer awaiting review',
    '转账资料已提交，管理员核对到账信息后会更新订单状态。请耐心等待，审核结果会通过邮件通知您': 'Transfer details submitted. The order status will update once an admin confirms receipt. Please wait; you\\\'ll be notified by email',
    '查看订单与审核状态': 'View order & review status', '支付失败': 'Payment failed',
    '合同付款未能成功，订单目前仍为待付款状态。请查看订单状态，系统不会自动重复扣款': 'Contract payment was unsuccessful; the order is still awaiting payment. Please check the order status — the system will not charge you again automatically',
    '超过 24 小时仍未付款时订单会自动取消并释放设备': 'If payment is not made within 24 hours, the order will be automatically cancelled and the device released',
    '正在确认 Stripe 支付': 'Confirming Stripe payment', '正在确认合同付款结果': 'Confirming contract payment result',
    '确认后会生成订单编号，本页面会自动刷新': 'An order number will be generated once confirmed; this page will refresh automatically', '刷新支付状态': 'Refresh payment status',
    '支付结果已同步到上一页，可关闭此标签页继续': 'The payment result has synced to the previous page; you can close this tab',
    '您请求的合同不存在': 'The contract you requested does not exist', '请登录合同所属账户后查看': 'Please sign in to the account this contract belongs to',
    '合同尚未生成': 'The contract has not been generated yet',
    '客户完成电子签署后，合同才可查看和下载': 'The contract can be viewed and downloaded once the customer completes electronic signing',
    '把下面的链接提供给第三方，可在不暴露任何个人信息的情况下核实本合同的编号、状态与文件哈希': 'Share the link below with a third party to verify this contract\\\'s number, status, and file hash without exposing any personal information',
    '仅可查看和下载本次租赁合同，账户将在租期结束后自动失效': 'You can only view and download this rental contract; the account will automatically expire after the rental period ends',
    '注册账户绑定此合同': 'Register an account linked to this contract', '抱歉，您访问的页面不存在或已被移除': 'Sorry, the page you requested does not exist or has been removed',
    '资源不存在': 'Resource not found', '您没有权限访问此页面，请联系管理员获取相应权限': 'You do not have permission to access this page. Please contact an administrator',
    '权限不足': 'Insufficient permissions',
    '服务器遇到了一些问题，请稍后重试。如持续出现此问题，请联系技术支持': 'The server encountered a problem. Please try again later. If this keeps happening, contact support',
    '服务器内部错误': 'Internal server error', '您需要登录或提供有效凭证才能访问此页面': 'You need to sign in or provide valid credentials to access this page',
    '服务器作为网关或代理，从上游服务器收到了无效的响应。请稍后重试': 'The server, acting as a gateway or proxy, received an invalid response from the upstream server. Please try again later',
    '服务器当前无法处理请求，这通常是由于临时过载或正在进行维护。请稍后重试': 'The server cannot currently process the request, usually due to temporary overload or maintenance. Please try again later',
    '创建您的专业设备租赁账户': 'Create your professional device rental account', '手机号': 'Mobile number', '请输入手机号': 'Please enter your mobile number',
    '请再次输入密码': 'Please re-enter your password', '请完成安全验证后注册': 'Please complete the security check before registering',
    '推荐码 (选填)': 'Referral code (optional)', '来自朋友的推荐码': 'A referral code from a friend', '我已阅读并同意': 'I have read and agree to',
    '已有账号': 'Already have an account?', '直接登录': 'Sign in directly', '填写资料并签署': 'Fill in details and sign', '填写资料': 'Fill in details',
    '选择支付': 'Choose payment', '填写资料并完成签署': 'Fill in details and complete signing', '合同链接无效或已过期': 'This contract link is invalid or has expired',
    '请联系工作人员获取新的签约链接': 'Please contact staff for a new signing link', '合同链接已过期': 'This contract link has expired',
    '该签约链接已超过有效期，请联系工作人员重新生成新的签约链接': 'This signing link has expired. Please contact staff to generate a new one',
    '合同链接已失效': 'This contract link is no longer valid',
    '该合同已被取消或已过期，请联系工作人员获取新的签约链接': 'This contract has been cancelled or has expired. Please contact staff for a new signing link',
    '合同关联的订单不存在，请联系我们': 'The order linked to this contract does not exist. Please contact us',
    '合同已签署，订单已确认，无需在线付款': 'The contract is signed and the order is confirmed; no online payment is needed',
    '付款已完成，发票与收据已生成': 'Payment complete; the invoice and receipt have been generated',
    '合同已签署，订单仍未完成付款。请前往订单查看付款状态或联系工作人员': 'The contract is signed but the order has not been paid yet. Please check the order\\\'s payment status or contact staff',
    '租赁协议已完成': 'Rental agreement complete',
    '未注册正式账户，系统已为您创建临时账户，可用以下资料登录查看合同与订单': 'You haven\\\'t registered a full account, so the system created a temporary account. Use the details below to sign in and view the contract and order',
    '密码': 'Password',
    '系统已自动生成设备登录密码。该密码不是网站登录密码，不支持自定义修改': 'The system generated a device sign-in password automatically. This is not your website sign-in password and cannot be customized',
    '以后可在订单详情中重复查看': 'You can view this again later in the order details', '待签署人填写': 'To be filled in by the signer', '步骤 1': 'Step 1',
    '本步骤仅用于确认租赁协议。正式合同将在完成电子签署后生成': 'This step only confirms the rental agreement. The formal contract will be generated after electronic signing is complete',
    '我已仔细阅读并完全同意上述所有租赁条款': 'I have carefully read and fully agree to all the rental terms above',
    '请先滚动阅读至协议底部': 'Please scroll to the bottom of the agreement first', '同意并进入下一步': 'Agree and continue',
    '已阅读至协议底部，可以勾选同意': 'You\\\'ve reached the bottom of the agreement and can now check to agree', '步骤 2': 'Step 2', '无法保存资料': 'Unable to save details',
    '已注册': 'Registered', '登录后继续': 'Sign in to continue', '已关联账户': 'Account linked', '已登录': 'Signed in', '保存后将同步更新账户': 'This will also update your account',
    '电子邮箱': 'Email address', '推荐人代码（选填）': 'Referrer code (optional)', '联系电话': 'Contact phone', '澳大利亚': 'Australia', '中国': 'China', '美国/加拿大': 'US/Canada',
    '英国': 'United Kingdom', '香港': 'Hong Kong', '台湾': 'Taiwan', '新加坡': 'Singapore', '韩国': 'South Korea', '日本': 'Japan',
    '勾选后设置自己的密码': 'Check this to set your own password',
    '不勾选将自动创建访客账户并在签署完成后显示临时密码': 'If left unchecked, a guest account will be created automatically and a temporary password shown after signing',
    '选择注册即表示默认同意': 'Choosing to register means you agree to', '不勾选': 'Leave unchecked',
    '即可继续作为访客签署。签署完成后系统会为您创建临时账户，并显示可登录的临时密码': 'to continue signing as a guest. After signing, the system will create a temporary account for you and show a temporary password',
    '设置密码': 'Set password', '至少 8 位，必须包含字母、数字和符号': 'At least 8 characters, must include letters, numbers, and symbols', '电子签署': 'Electronic signing',
    '输入全名签名': 'Type your full name as your signature', '请输入与上方姓名一致的签名': 'Please enter a signature matching the name above',
    '请先修正标记的资料': 'Please correct the flagged details first', '保存信息并进入下一步': 'Save details and continue', '请填写名': 'Please enter your given name',
    '请填写姓': 'Please enter your family name', '请输入有效的电子邮箱': 'Please enter a valid email address',
    '电话号码格式与所选国家代码不匹配': 'The phone number format doesn\\\'t match the selected country code', '步骤 3': 'Step 3', '开始签署': 'Start signing', '拒绝': 'Decline',
    '签名后点击完成签署': 'Sign, then click to complete signing', '可输入姓名，或在签名板上手写签名': 'You can type your name or sign by hand on the pad',
    '签署完成后合同将立即确认，无需付款': 'The contract will be confirmed immediately after signing, with no payment required', '输入姓名签名': 'Type your name as a signature',
    '输入时必须与步骤2填写的完整姓名一致': 'This must match the full name entered in step 2', '手写签名': 'Handwritten signature', '清除手写签名': 'Clear handwritten signature',
    '完成签署': 'Complete signing', '完成签署并进入付款': 'Complete signing and proceed to payment',
    '步骤 2/2: 确认取还时间并完成签约': 'Step 2/2: Confirm pickup/return times and complete signing', '步骤 3/3: 选择支付方式': 'Step 3/3: Choose payment method',
    '合同签署不需要在线付款。请确认取货和归还时间，提交后合同立即完成签署': 'Contract signing does not require online payment. Please confirm the pickup and return times; the contract will be completed once submitted',
    '仅预授权，不立即扣款': 'Authorization only; no immediate charge', '使用 SetupIntent 保存卡片，不预扣': 'Uses SetupIntent to save the card; no pre-authorization',
    '含押金': 'Includes deposit', '早间服务费': 'Morning service fee', '晚间服务费': 'Evening service fee', '一次性预授权总额': 'Total one-time authorization',
    '租金及已确定的时段服务费即时扣款': 'The rental fee and confirmed time-slot service fee are charged immediately', '其中支付手续费': 'Of which the payment processing fee is',
    '本订单使用 SetupIntent 保存卡片，押金不预扣': 'This order uses SetupIntent to save the card; the deposit is not pre-authorized',
    '查看账户资料并提交转账凭证截图': 'View account details and submit a transfer proof screenshot', '支付宝（人民币）': 'Alipay (RMB)', '微信支付（人民币）': 'WeChat Pay (RMB)',
    '账户余额支付': 'Pay with account balance', '当前余额': 'Current balance', '银行转账资料': 'Bank transfer details', '转账备注（选填）': 'Transfer note (optional)',
    '这里只提交租金及服务费': 'Only the rental fee & service fee are submitted here',
    '押金按单独选择的押金方式处理。请先把截图上传到可公开访问的 HTTPS 图床，再粘贴图片链接': 'The deposit is handled separately based on the deposit method you chose. Please upload the screenshot to a public HTTPS image host first, then paste the link',
    '人民币付款': 'RMB payment', '选择支付宝或微信后获取实时汇率': 'The real-time exchange rate is fetched after choosing Alipay or WeChat',
    '信用卡支付手续费': 'Credit card processing fee', '信用卡只创建一笔预授权': 'Only one authorization is created on the credit card',
    '手续费按这两项计算，不按押金计算': 'The processing fee is calculated on these two items, not on the deposit', '支付手续费': 'Payment processing fee',
    '付款全程由 Stripe 安全处理，本网站不存储您的银行卡号、有效期或安全码。继续付款即表示您已阅读并同意我们的': 'Payment is securely processed by Stripe throughout; this site does not store your card number, expiry, or security code. Continuing means you\\\'ve read and agree to our',
    '并同意 Stripe 的相关服务条款及隐私政策': 'and agree to Stripe\\\'s terms of service and privacy policy', '退款接收方式': 'Refund method',
    '退回账户余额（推荐，到账更快）': 'Refund to account balance (recommended, faster)', '退款将原路退回': 'The refund will go back to the original payment method',
    '只有已登录的正式客户账户可以选择退款到账户余额': 'Only signed-in full customer accounts can choose to refund to account balance',
    '访客及未登录签署者不能退回余额': 'Guests and signers who are not signed in cannot receive refunds to balance', '信用卡原路退回': 'Refunded to the original credit card',
    '银行转账原路退回您填写的银行账户': 'Refunded by bank transfer to the account you provided', '余额付款仍退回余额': 'Balance payments are refunded back to balance',
    '已自动填写系统中保存的银行资料；如本次退款账户不同，可以直接修改。': 'Your saved bank details have been filled in automatically; edit them directly if this refund should go elsewhere.',
    '请填写用于接收本次退款的银行账户资料。': 'Please provide the bank account details to receive this refund.', '优惠后应付总额': 'Total due after discount',
    '已优惠': 'Discount applied', '正在获取实时汇率': 'Fetching real-time exchange rate', '请使用对应收款码支付': 'Please pay using the matching payment QR code',
    '金额按两位小数上舍入': 'Amounts are rounded up to two decimal places', '请填写有效的 HTTPS 截图链接。': 'Please enter a valid HTTPS screenshot link.',
    '请填写付款': 'Please provide payment', '尚未收到支付确认，完成付款后请稍候再试': 'Payment confirmation hasn\\\'t arrived yet. Please wait a moment after paying and try again',
    '网络异常，请稍后重试': 'Network error. Please try again later', '正在等待支付完成': 'Waiting for payment to complete',
    '已在新标签页打开支付页面，完成付款后回到此页即可，我们会自动核对': 'The payment page has opened in a new tab. Complete payment, then return here — we\\\'ll verify it automatically',
    '打开支付页面': 'Open payment page', '支付失败 / 重新选择': 'Payment failed / choose again', '我已完成支付': 'I\\\'ve completed payment',
    '支付未完成，请重新选择支付方式': 'Payment was not completed. Please choose a payment method again',
    '你的临时账户已可登录。请立即保存以下资料，密码离开本页后不再显示': 'Your temporary account is ready to sign in. Please save the details below now — the password won\\\'t be shown again after you leave this page',
    '临时密码': 'Temporary password', '订单已完成付款，正在带你前往订单详情': 'Order payment complete. Taking you to the order details',
    '提交失败，请重试': 'Submission failed. Please try again', '卡片验证成功，但租金支付初始化失败': 'Card verified successfully, but rental payment setup failed',
    '先验证并保存卡片，随后只支付租金及服务费': 'Verify and save the card first, then pay only the rental fee & service fee',
    '押金不会放入这笔': 'The deposit is not included in this charge',
    '卡片验证组件加载失败，请刷新重试': 'The card verification component failed to load. Please refresh and try again',
    '卡信息由 Stripe 处理，本站不保存卡号、有效期或安全码': 'Card details are handled by Stripe; this site does not store your card number, expiry, or security code',
    '支付组件加载失败，请刷新重试': 'The payment component failed to load. Please refresh and try again',
    '邀请你使用 PC Rental 租赁电脑，注册时可通过我的推荐链接加入': 'Invite you to rent a computer on PC Rental — sign up using my referral link',
    '邀请好友，获得推荐奖励': 'Invite friends and earn referral rewards', '推荐分享内容': 'Referral share text',
    '确定要退出推荐计划吗？退出后您的推荐码将失效，且无法再获得新的佣金': 'Are you sure you want to leave the referral program? Your referral code will be deactivated and you won\\\'t earn new commissions',
    '请输入整数金额': 'Please enter a whole number amount', '银行转账提现金额必须为大于 100 的整数': 'The bank transfer withdrawal amount must be a whole number greater than 100',
    '余额提现金额必须大于 0': 'The balance withdrawal amount must be greater than 0', '好友名称': 'Friend\\\'s name', '推荐奖励': 'Referral reward',
    '您还没有成功推荐任何好友': 'You haven\\\'t successfully referred any friends yet', '推荐码已复制到剪贴板': 'Referral code copied to clipboard',
    '推荐语和完整链接已复制到剪贴板': 'Referral message and link copied to clipboard', '选择您需要的设备和租赁期限': 'Choose the device and rental period you need', '分类': 'Category',
    '立即租赁': 'Rent now', '暂无可用设备': 'No devices are currently available', '账户流水': 'Account transactions',
    '充值、租赁付款、押金退款、退款和余额调整都会记录在这里': 'Top-ups, rental payments, deposit refunds, refunds, and balance adjustments are all recorded here',
    '账户余额明细': 'Account balance details', '时间（墨尔本）': 'Time (Melbourne)', '暂无账户流水': 'No account transactions',
    '充值、租赁付款或退款到账后会显示在这里': 'Top-ups, rental payments, and refunds will appear here once received', '请确认归还日期': 'Please confirm the return date',
    '今天到期': 'Due today', '明天到期': 'Due tomorrow', '天后到期': 'days until due',
    '管理您的设备租赁、查看订单状态、完成支付': 'Manage your device rentals, check order status, and complete payments', '当前租赁': 'Current rentals', '台设备使用中': 'device(s) in use',
    '笔订单待处理': 'order(s) pending', '查看余额明细': 'View balance details', '历史租赁': 'Rental history', '浏览可租设备': 'Browse available devices',
    '查找下一台设备': 'Find your next device', '邀请好友赚佣金': 'Invite friends and earn commission', '分享你的推荐链接': 'Share your referral link',
    '完善账户信息': 'Complete your account details', '更新资料与联系方式': 'Update your details and contact information', '查看全部': 'View all',
    '您请求租赁的设备不存在': 'The device you requested to rent does not exist', '填写租赁信息并确认订单': 'Fill in rental details and confirm the order',
    '设备交付方式': 'Device delivery method', '送货上门（运费由管理员/员工确认）': 'Home delivery (fee confirmed by admin/staff)',
    '请填写完整的街道、Suburb、州和邮编': 'Please provide the full street, suburb, state, and postcode',
    '提交后由绑定员工或管理员确认配送范围和运费，暂不在此页面收取': 'After submission, the assigned staff member or admin will confirm the delivery area and fee; it is not charged on this page',
    '申请备注（选填）': 'Request notes (optional)', '例如配送时间、设备使用要求等': 'e.g. delivery time, device requirements, etc.', '输入优惠码': 'Enter promo code',
    '最短租赁时间': 'Minimum rental period', '天。不可用日期': 'days. Unavailable dates',
    '请选择租期后查看租金、押金和配送费用': 'Select a rental period to see the rental fee, deposit, and delivery cost', '优惠后报价': 'Quote after discount',
    '原租金': 'Original rental fee', '暂时无法验证优惠码，请稍后重试': 'Unable to verify the promo code right now. Please try again later',
    '归还日期必须晚于租赁开始日期': 'The return date must be after the rental start date', '天租金': 'days\\\' rental fee',
    '运费（如需配送）由管理员/员工审核后另行通知': 'The delivery fee (if applicable) will be confirmed separately by admin/staff after review',
    '选择充值金额和支付方式，充值到账后可用于租赁订单付款': 'Choose a top-up amount and payment method; once received, it can be used to pay for rental orders', '支付': 'Payment',
    '微信': 'WeChat', '提交凭证后由管理员审核': 'After submission, an admin will review the proof',
    '取消本次待付款充值？取消后可重新选择金额和支付方式。': 'Cancel this pending top-up? You can choose a new amount and payment method afterward.',
    '取消并更换金额/方式': 'Cancel and change amount/method', '取消并返回余额': 'Cancel and return to balance', '例如 100.00': 'e.g. 100.00',
    '信用卡支付会额外收取 2.5% 手续费；人民币付款会在选择后按实时汇率上舍入到两位小数。': 'Credit card payment incurs an extra 2.5% processing fee; RMB payment is rounded up to two decimals at the real-time rate once selected.',
    '信用卡充值（收手续费）': 'Credit card top-up (fee applies)', '支付宝充值': 'Alipay top-up', '微信充值': 'WeChat top-up', '预计到账金额：CNY': 'Estimated amount received: CNY',
    '查看您的所有租赁订单': 'View all your rental orders', '去支付': 'Pay now', '您目前没有待付款订单': 'You have no orders awaiting payment',
    '您目前没有正在租赁的设备': 'You have no devices currently on rent', '您目前没有已完成的订单': 'You have no completed orders', '您目前没有已取消的订单': 'You have no cancelled orders',
    '查看您的当前和历史租赁记录': 'View your current and past rentals', '您当前没有正在租赁的设备': 'You have no devices currently on rent', '租赁历史记录': 'Rental history',
    '您还没有租赁历史记录': 'You don\\\'t have any rental history yet', '管理您的账户安全': 'Manage your account security', '当前密码': 'Current password',
    '新密码至少需要10位': 'The new password must be at least 10 characters', '新密码和确认密码不匹配': 'The new password and confirmation do not match',
    '登录记录': 'Sign-in history', '此处将显示您的近期登录活动': 'Your recent sign-in activity will appear here', '设备/浏览器': 'Device/Browser', '暂无登录记录': 'No sign-in history',
    '个人信息管理': 'Profile management', '编辑您的基本资料和支付账户信息': 'Edit your basic details and payment account information', '推荐人': 'Referrer',
    '绑定后禁止修改推荐人': 'The referrer cannot be changed once linked', '账户已进入冷静期，将于': 'Your account has entered the cooling-off period and will be',
    '后删除。7 天内重新登录即可取消': 'deleted after. Sign back in within 7 days to cancel',
    '申请后进入 7 天冷静期。冷静期结束后账户才会永久删除，余额和佣金余额会清零且不退还': 'A 7-day cooling-off period begins after you apply. The account is permanently deleted only after this period; balance and commission balance will be cleared and not refunded',
    '请先勾选确认项': 'Please check the confirmation box first',
    '最终确认：账户将进入7天冷静期，期间重新登录可取消删除。确定继续吗？': 'Final confirmation: your account will enter a 7-day cooling-off period, during which signing back in cancels the deletion. Continue?',
    '我已了解账户进入冷静期，余额及佣金余额不会退还，合同和订单只保留匿名记录': 'I understand the account will enter a cooling-off period, balance and commission balance will not be refunded, and contracts and orders will only be retained anonymously',
    '申请删除账户': 'Request account deletion', '信用额度 / 调整': 'Credit / adjustment', '押金退还': 'Deposit refund', '服务费退款': 'Service fee refund',
    '您请求的订单不存在或无权访问': 'The order you requested does not exist or you don\\\'t have access', '部分退款': 'Partially refunded',
    '查看订单状态、设备信息、租金明细及合同。': 'View order status, device information, rental fee breakdown, and the contract.',
    '订单编号将在付款确认后生成': 'The order number will be generated after payment is confirmed', '领取/归还地点': 'Pickup/return location', '预约时间': 'Appointment time',
    '预授权': 'Authorization', '单独处理': 'Handled separately', '设备信息': 'Device information', '出租前验机报告': 'Pre-rental inspection report',
    '该报告为设备交付前的验机记录': 'This report documents the inspection before the device was handed over', '记录时间（墨尔本时间）': 'Recorded at (Melbourne time)',
    '暂无出租前验机记录': 'No pre-rental inspection record', '归还验机报告': 'Return inspection report', '与押金扣除': 'and deposit deduction', '扣除金额': 'Deducted amount',
    '提出异议': 'Raise a dispute', '提交异议': 'Submit dispute', '订单变更记录': 'Order change history',
    '您的订单关键信息（租期、设备、金额、取还地点）曾被调整，明细如下': 'Key details of your order (rental period, device, amount, pickup/return location) have been adjusted; details below',
    '付款与退款明细': 'Payment & refund details', '付款 / 预授权': 'Payment / Authorization',
    '如对付款或退款金额有疑问，请联系您的专属客服': 'If you have questions about a payment or refund amount, please contact your dedicated support',
    '更改预约时间': 'Change appointment time', '如新时段产生更高服务费，将追加到订单': 'If the new time slot incurs a higher service fee, it will be added to the order',
    '领取/送货时间': 'Pickup/delivery time', '保存预约时间': 'Save appointment time', '提前归还申请待审批': 'Early return request awaiting approval',
    '申请提前归还': 'Request early return', '提前归还已批准，等待归还验机': 'Early return approved, awaiting return inspection',
    '正式合同将在签署完成后开放下载': 'The formal contract will be available for download once signing is complete', '签署租赁协议': 'Sign rental agreement',
    '公开验证链接（可提供给需要核实合同真实性的第三方，不包含任何个人信息）': 'Public verification link (share with third parties who need to verify this contract; no personal information is included)',
    '这是系统为租赁设备自动生成的独立 Windows 密码，不是网站登录密码。密码会保存并在此处重复显示，不支持自定义修改': 'This is a separate Windows password automatically generated by the system for the rental device. It is not your website sign-in password. It is saved and shown here again, and cannot be customized',
    '转账凭证待审核': 'Transfer proof awaiting review', '转账审核未通过': 'Transfer review not approved', '转账审核已通过': 'Transfer review approved',
    '管理员正在核对付款信息，请耐心等待': 'An admin is verifying the payment information. Please wait', '已驳回': 'Rejected', '收款明细': 'Payment received details',
    '信用卡一次性预授权': 'One-time credit card authorization', '时段服务费': 'Time-slot service fee', '不预扣': 'No pre-authorization',
    '手续费按租金及服务费计算': 'The processing fee is calculated on the rental fee & service fee', '请转账': 'Please transfer',
    '到以上账户，并在备注中填写合同编号': 'to the account above, and include the contract number in the note', '转账凭证图片链接': 'Transfer proof image link',
    '图床域名/凭证图片': 'Image host domain / proof image',
    '请先上传到图床，再粘贴公开 HTTPS 图片链接': 'Please upload to an image host first, then paste the public HTTPS image link', '提交转账信息': 'Submit transfer information',
    '提交付款凭证前获取实时汇率并计算人民币金额': 'Fetch the real-time exchange rate and calculate the RMB amount before submitting payment proof',
    '在本页安全填写卡信息完成支付，卡号由 Stripe 处理，本站不保存卡号、有效期或安全码': 'Securely enter your card details on this page to pay. Your card is processed by Stripe; this site does not store your card number, expiry, or security code',
    '使用 SetupIntent 保存卡片，不预扣，仅在损坏或逾期时按实际费用扣款': 'Uses SetupIntent to save the card with no pre-authorization; charges only apply for actual damage or overdue fees',
    '手续费不计入押金': 'The processing fee is not included in the deposit', '订单已下调，待退差价': 'Order was reduced; price difference refund pending',
    '由于您使用': 'Because you used', '付款，差价将在管理员退押金时一并退还': 'as your payment method, the difference will be refunded together with the deposit by an admin',
    '订单价格已增加，需要补交': 'The order price has increased; an additional payment is required', '信用卡支付含手续费': 'Credit card payment includes a processing fee',
    '本次实际扣款': 'Actual amount charged this time', '差价付款': 'Price difference payment', '请支付': 'Please pay',
    '提交付款凭证前获取实时汇率': 'Fetch the real-time exchange rate before submitting payment proof', '提交差价付款凭证': 'Submit price difference payment proof',
    '在本页安全填写卡信息完成差价支付，卡号由 Stripe 处理': 'Securely enter your card details on this page to pay the difference; your card is processed by Stripe',
    '支付差价': 'Pay the difference', '订单下调差价': 'Order reduction price difference', '已自动退回': 'Automatically refunded',
    '设置新密码后将解除访客限制，账户不会在租期结束时失效': 'Setting a new password removes guest restrictions; the account will not expire when the rental period ends',
    '升级账户即表示您已阅读并同意': 'Upgrading your account means you\\\'ve read and agree to', '升级为正式账户': 'Upgrade to a full account',
    '保留当前邮箱，设置密码后即可继续使用完整账户功能': 'Keep your current email; set a password to keep using full account features', '返回访客中心': 'Back to guest center',
    '此账户仅用于本次租赁的付款、合同和收据': 'This account is only used for this rental\\\'s payment, contract, and receipt', '本次租赁': 'This rental',
    '未找到关联订单，请联系工作人员': 'No linked order found. Please contact staff',
    '升级后可使用完整账户功能，账户也不会在本次租期结束后失效': 'After upgrading, you\\\'ll have access to full account features, and the account won\\\'t expire when this rental ends',
    '前往升级账户': 'Go to upgrade account', '搜索姓名或邮箱': 'Search by name or email', '请打开邮件中的链接完成验证': 'Please open the link in the email to complete verification',
    '如果没有收到邮件，请检查垃圾邮件文件夹': 'If you didn\\\'t receive the email, please check your spam folder', '秒后可重新发送': 'Resend available in seconds',
    '重新发送验证邮件': 'Resend verification email', '请输入邮箱地址': 'Please enter your email address',
    '如果该邮箱已注册，验证邮件将发送到您的邮箱': 'If this email is registered, a verification email will be sent to it',
    '验证邮件已发送，请 60 秒后再试': 'Verification email sent. Please try again in 60 seconds', '验证邮件已重新发送，请查收': 'Verification email resent. Please check your inbox',
    '请使用邮件中的完整链接': 'Please use the full link from the email', '请重新发送验证邮件': 'Please resend the verification email',
    '您的邮箱已验证，可以登录账户': 'Your email has been verified. You can now sign in', '请输入有效的邮箱地址': 'Please enter a valid email address',
    '请在 30 分钟内打开以下链接重置密码': 'Please open the link below within 30 minutes to reset your password',
    '如果该邮箱已注册，重置链接将发送到您的邮箱': 'If this email is registered, a reset link will be sent to it', '汇率暂不可用': 'Exchange rate temporarily unavailable',
    '请输入 1 至 10,000 AUD 的有效充值金额': 'Please enter a valid top-up amount between 1 and 10,000 AUD', '请选择有效的充值方式': 'Please choose a valid top-up method',
    '信用卡充值当前未启用': 'Credit card top-up is not currently enabled', '该人民币支付方式当前未启用': 'This RMB payment method is not currently enabled',
    '无权访问': 'Access denied', '无法创建信用卡支付': 'Unable to create credit card payment', '充值记录或 Reference 无效': 'Invalid top-up record or reference',
    '用户不存在': 'User not found', '余额变动金额必须不为 0': 'The balance change amount must not be 0',
    '管理员调整余额必须填写原因': 'A reason is required when an admin adjusts the balance',
    '扣减后余额不能小于 0，或余额已被其他操作更新，请重试': 'The balance cannot go below 0 after deduction, or it was updated by another operation — please try again',
    '新密码至少需要 8 位，并同时包含字母、数字和符号': 'The new password must be at least 8 characters and include letters, numbers, and symbols',
    '预约时段无效': 'Invalid appointment time slot', '预约时间已更新，新增服务费': 'Appointment time updated; additional service fee applied',
    '预约时间已更新': 'Appointment time updated', '当前订单不能申请提前归还': 'This order is not eligible for an early return request',
    '提前归还申请已提交，请等待工作人员或管理员审批': 'Early return request submitted. Please wait for staff or admin approval',
    '没有待审批的提前归还申请': 'There are no early return requests awaiting approval', '当前订单不能提交已归还通知': 'This order cannot submit a return notice', '我们的': 'our',
    '相关条款': 'related terms', '已更新，请查看最新内容': 'have been updated. Please review the latest version', '自定义通知': 'Custom notifications',
    '订单和归还提醒': 'Order and return reminders', '已选': 'Selected', '请输入完整注册信息': 'Please fill in the complete registration information',
    '该电子邮箱已被注册': 'This email is already registered', '无效的推荐码': 'Invalid referral code', '验证邮件已发送至': 'Verification email sent to',
    '（服务费10%）': ' (10% service fee)', '网站订单审核': 'Website order review', '无法读取地址详情，请手工填写': 'Unable to look up address details; please fill it in manually',
    '支付宝/微信交易单号': 'Alipay/WeChat transaction ID', '无效的步骤': 'Invalid step', '请从第一步开始签署合同': 'Please start signing the contract from step 1',
    '点击这里返回第一步': 'Click here to return to step 1', '租赁协议签署': 'Rental agreement signing', '发送通知': 'Send notification',
    '例如 CT-2026-000123': 'e.g. CT-2026-000123', '合同页脚 / 二维码中的校验码': 'The verification code on the contract footer / QR code',
    // 取消订阅页（公开，无需登录）
    '取消订阅营销邮件': 'Unsubscribe from marketing emails', '确认要取消订阅': 'Confirm you want to unsubscribe',
    '的营销推广邮件吗？您仍会正常收到订单、合同、付款等账户相关的重要通知邮件。': ' from marketing emails? You will still receive important account notifications such as orders, contracts, and payments.',
    '确认取消订阅': 'Confirm unsubscribe', '已取消订阅': 'Unsubscribed', '链接无效': 'Invalid link', '返回首页': 'Back to home',
    '您已成功取消订阅营销邮件，我们不会再向您发送促销邮件。您仍会收到订单、合同等账户相关的重要通知邮件。': 'You have successfully unsubscribed from marketing emails. We will no longer send you promotional emails. You will still receive important account notifications such as orders and contracts.',
    '您已成功取消订阅营销邮件，无需重复操作。': 'You have already unsubscribed from marketing emails — no further action is needed.',
    '取消订阅链接无效，请从营销邮件中重新点击链接。': 'This unsubscribe link is invalid. Please click the link again from the marketing email.',
    '取消订阅链接无效或已失效。': 'This unsubscribe link is invalid or has expired.',
    // 管理员 / 营销邮件
    '营销邮件': 'Marketing emails',
    '创建可复用的营销模板，向客户群发促销邮件，并可选择性地为每位收件人生成专属一次性优惠码。': 'Create reusable marketing templates, send promotional emails to customers in bulk, and optionally generate a unique one-time coupon for each recipient.',
    '新建营销邮件': 'New marketing email', '选择模板或自定义内容，可选择性附带优惠码': 'Choose a template or custom content, and optionally attach a coupon',
    '批次名称（仅后台可见）': 'Batch name (internal only)', '批次名称': 'Batch name', '使用模板': 'Use template', '自定义内容': 'Custom content',
    '邮件主题': 'Email subject', '邮件主题色': 'Email accent color',
    '正文（支持完整 HTML：可直接粘贴带样式、图片、按钮、表格排版的邮件设计稿）': 'Body (full HTML supported: paste a styled email design with images, buttons, and table layouts)',
    '正文（支持完整 HTML）': 'Body (full HTML supported)', '收件人': 'Recipients', '或选择指定客户（可多选）': 'Or select specific customers (multiple allowed)',
    '清空选择': 'Clear selection', '不附带优惠码': 'No coupon', '使用已有优惠码（所有人共用）': 'Use an existing coupon (shared by everyone)',
    '为每位收件人生成专属唯一优惠码': 'Generate a unique coupon for each recipient', '选择优惠码': 'Select coupon',
    '暂无可用优惠码，请先在优惠码管理中创建': 'No coupons available yet — create one in coupon management first',
    '优惠码前缀（可留空，例如 VIP）': 'Coupon code prefix (optional, e.g. VIP)',
    '系统会为每位收件人生成一个仅限本人使用一次的独立优惠码，并自动填充到邮件正文的 {coupon_code} 中。': 'The system generates a separate one-time coupon for each recipient and fills it into {coupon_code} in the email body automatically.',
    '发送营销邮件': 'Send marketing email', '营销模板库': 'Marketing template library', '新建营销模板': 'New marketing template',
    '可反复用于不同批次的营销邮件': 'Reusable across different marketing email batches', '模板名称': 'Template name', '添加模板': 'Add template',
    '暂无自定义营销模板': 'No custom marketing templates yet', '发送历史': 'Send history', '暂无营销邮件发送记录': 'No marketing email send history yet',
    '收件人数': 'Recipients', '发送情况': 'Delivery', '发送中': 'Sending', '共用优惠码': 'Shared coupon', '专属唯一优惠码': 'Unique coupon', '待发送': 'Pending',
    '收件人明细': 'Recipient details', '错误信息': 'Error message', '返回营销邮件': 'Back to marketing emails',
    '发送给全部活跃客户（': 'Send to all active customers (', ' 人）': ' people)', '另有 ': 'An additional ',
    ' 位客户已取消订阅营销邮件，未在下方收件人列表中显示。': ' customer(s) have unsubscribed from marketing emails and are not shown in the recipient list below.',
    ' 批次': ' batches', '可用变量（': 'Available variables (', ' 项）': ' items)', '主题色': 'Accent color'
  };

  var keys = Object.keys(translations).sort(function (a, b) { return b.length - a.length; });
  var readLanguage = function () {
    try {
      var stored = localStorage.getItem(storageKey);
      if (stored === 'en' || stored === 'zh') return stored;
    } catch (_) {}
    var browserLanguages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    return browserLanguages.some(function (language) { return /^en(?:-|$)/i.test(String(language)); }) ? 'en' : 'zh';
  };
  var writeLanguage = function (value) { try { localStorage.setItem(storageKey, value); } catch (_) {} };
  var cleanChinesePunctuation = function (value) { return String(value || '').replace(/[。；]/g, ''); };
  var translateText = function (value) {
    var text = String(value || '');
    if (!text.trim()) return text;
    var leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0];
    var core = text.slice(leading.length, text.length - trailing.length || undefined);
    var couponNotice = core.match(/^🎉新优惠现已开启！\s*\n\s*\n使用优惠码 <strong>([^<]+)<\/strong>，即可享受下次租赁 <strong>([^<]+)<\/strong>。\s*\n\s*\n有效期至 <strong>((\d{4})年(\d{1,2})月(\d{1,2})日|长期有效)<\/strong>$/);
    if (couponNotice) {
      var dateParts = couponNotice[3].match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
      var expiry = dateParts ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])) : null;
      var expiryText = couponNotice[3] === '长期有效' ? 'No expiry' : expiry && !isNaN(expiry.getTime()) ? expiry.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' }) : couponNotice[3];
      return leading + '🎉A new offer is now live!\n\nUse promo code **' + couponNotice[1] + '** to get **' + couponNotice[2].replace(' 的折扣', ' off').replace(' 的优惠', ' off') + '** on your next rental.\n\nValid until **' + expiryText + '**' + trailing;
    }
    if (Object.prototype.hasOwnProperty.call(translations, core)) return leading + translations[core] + trailing;
    keys.forEach(function (key) { if (core.indexOf(key) !== -1) core = core.split(key).join(translations[key]); });
    return leading + core + trailing;
  };
  var sourceFor = function (node, value) {
    if (!node.__rentI18nSource) node.__rentI18nSource = value;
    return node.__rentI18nSource;
  };
  var shouldSkip = function (node) {
    var parent = node.parentElement;
    return !parent || parent.closest('script, style, textarea, pre, code, [data-i18n-ignore]');
  };
  var apply = function (root) {
    var language = readLanguage();
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    if (document.title && /[\u4e00-\u9fff]/.test(document.title)) originalTitle = document.title;
    if (originalTitle) {
      var titleNode = { __rentI18nSource: originalTitle.replace(/ - (?:电脑租赁管理系统|PC Rental)$/, '') };
      var title = sourceFor(titleNode, titleNode.__rentI18nSource);
      document.title = cleanChinesePunctuation(language === 'en' ? translateText(title) + ' - PC Rental' : originalTitle);
    }
    var scope = root || document.body;
    if (!scope) return;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (shouldSkip(node)) continue;
      var source = sourceFor(node, node.nodeValue || '');
      node.nodeValue = cleanChinesePunctuation(language === 'en' ? translateText(source) : source);
    }
    scope.querySelectorAll('input[placeholder], textarea[placeholder], [title], [aria-label], input[type="submit"], input[type="button"]').forEach(function (element) {
      ['placeholder', 'title', 'aria-label', 'value'].forEach(function (attribute) {
        if (!element.hasAttribute(attribute) || (attribute === 'value' && !/^(submit|button)$/i.test(element.type))) return;
        var value = element.getAttribute(attribute) || '';
        var source = element.getAttribute('data-i18n-' + attribute) || value;
        element.setAttribute('data-i18n-' + attribute, source);
        element.setAttribute(attribute, cleanChinesePunctuation(language === 'en' ? translateText(source) : source));
      });
    });
    document.querySelectorAll('[data-language-label]').forEach(function (button) {
      var nextLabel = language === 'en' ? '中文' : 'English';
      if (button.textContent !== nextLabel) button.textContent = nextLabel;
      button.setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换到英文');
      button.setAttribute('title', language === 'en' ? 'Switch to Chinese' : '切换到英文');
    });
  };
  window.applySiteLanguage = apply;
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target.closest('[data-language-toggle]') : null;
    if (!target) return;
    event.preventDefault();
    writeLanguage(readLanguage() === 'en' ? 'zh' : 'en');
    apply(document.body);
  });
  var observer = new MutationObserver(function () { window.setTimeout(function () { apply(document.body); }, 0); });
  observer.observe(document.body, { childList: true, subtree: true });
  apply(document.body);
})();
`;
