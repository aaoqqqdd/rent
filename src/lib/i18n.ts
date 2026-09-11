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
    '跳到主要内容': 'Skip to main content', '正在加载工作台': 'Loading workspace', '正在载入工作台': 'Loading workspace',
    '设备租赁控制台': 'Equipment rental console', '登录': 'Sign in', '注册': 'Register', '通知中心': 'Notifications',
    '正在加载通知…': 'Loading notifications…', '查看全部通知': 'View all notifications', '编辑个人信息': 'Edit profile',
    '登出': 'Sign out', '导航': 'Navigation', '控制台': 'Dashboard', '租赁工作区': 'Rental workspace',
    '我的租赁': 'My rentals', '订单管理': 'Order management', '账户与钱包': 'Account & wallet', '我的钱包': 'My wallet',
    '个人资料': 'Profile', '安全设置': 'Security', '推荐计划': 'Referral program', '工作台': 'Workspace',
    '租赁管理': 'Rental management', '租赁订单': 'Rental orders', '进行中的租赁': 'Active rentals', '验机记录': 'Inspection records',
    '合同管理': 'Contract management', '合同列表': 'Contracts', '新建合同': 'New contract', '待签署合同': 'Pending signatures',
    '设备运营': 'Device operations', '设备管理': 'Device management', '租赁追踪': 'Rental tracking', '人员管理': 'People management',
    'Staff 员工': 'Staff members', '通知管理': 'Notification management', '发布通知': 'Publish notification', '用户管理': 'User management',
    '租赁日历': 'Rental calendar', '财务管理': 'Finance', '财务总览': 'Finance overview', '运营分析报表': 'Operations reports',
    '异常任务中心': 'Exception center', '优惠码管理': 'Coupon management', '推荐奖励管理': 'Referral rewards', '退款管理': 'Refunds',
    '佣金提现': 'Commission withdrawals', '系统设置': 'System settings', '协议模板': 'Agreement templates',
    '邮件通知模板': 'Email templates', '通讯检测': 'Connectivity checks', '系统健康监控': 'System health', '数据保留策略': 'Data retention',
    '首页': 'Home', '通知': 'Notifications', '可租设备': 'Available devices', '租赁': 'Rentals', '订单': 'Orders', '钱包': 'Wallet', '我的': 'Profile',
    '管理端': 'Admin', '员工端': 'Staff', '访客合同': 'Guest contracts', '客户端': 'Customer', '合同中心': 'Contract center', '升级账户': 'Upgrade account',
    '正常': 'Healthy', '异常': 'Issue', '延迟': 'Delayed', '错误': 'Error', '网站法律信息': 'Legal information', '用户协议': 'User agreement',
    '服务条款': 'Terms of service', '隐私政策': 'Privacy policy', '更多': 'More', 'Cookie 政策': 'Cookie policy', '退款政策': 'Refund policy',
    '消费者权利': 'Consumer rights', '投诉与争议': 'Complaints & disputes', '可接受使用': 'Acceptable use', '软件协议': 'Software agreement',
    '打开导航菜单': 'Open navigation menu', '打开通知中心': 'Open notifications', '关闭通知': 'Close notification', '系统状态': 'System status',
    '查看详情': 'View details', '查看通知': 'View notifications', '网站通告': 'Site announcement', '以后不再展示此通告': 'Do not show this announcement again',
    '新通知': 'New notification', '暂无通知': 'No notifications', '上一页': 'Previous', '下一页': 'Next', '第 ': 'Page ', ' 页': '',
    '保存': 'Save', '取消': 'Cancel', '删除': 'Delete', '编辑': 'Edit', '查看': 'View', '操作': 'Actions', '搜索': 'Search', '筛选': 'Filter',
    '提交': 'Submit', '确认': 'Confirm', '关闭': 'Close', '返回': 'Back', '详情': 'Details', '添加': 'Add', '新增': 'New', '修改': 'Edit',
    '更新': 'Update', '创建': 'Create', '导出': 'Export', '打印': 'Print', '下载': 'Download', '重试': 'Retry', '刷新': 'Refresh',
    '处理中…': 'Processing…', '请确认操作': 'Please confirm', '确定继续吗？': 'Continue?', '正在加载，请稍候…': 'Loading, please wait…',
    '姓名': 'Name', '邮箱': 'Email', '电话': 'Phone', '地址': 'Address', '备注': 'Notes', '内容': 'Content', '原因': 'Reason', '状态': 'Status',
    '时间': 'Time', '日期': 'Date', '类型': 'Type', '金额': 'Amount', '押金': 'Deposit', '租金': 'Rental fee', '总计': 'Total', '合计': 'Total',
    '设备': 'Device', '客户': 'Customer', '订单号': 'Order number', '合同': 'Contract', '付款': 'Payment', '退款': 'Refund', '收据': 'Receipt',
    '发票': 'Invoice', '序列号': 'Serial number', '型号': 'Model', '品牌': 'Brand', '数量': 'Quantity', '说明': 'Description', '证明': 'Proof',
    '是': 'Yes', '否': 'No', '有效': 'Active', '无效': 'Invalid', '待处理': 'Pending', '待审核': 'Pending review', '已审核': 'Reviewed',
    '审核通过': 'Approved', '已拒绝': 'Rejected', '已完成': 'Completed', '已取消': 'Cancelled', '已过期': 'Expired', '已绑定': 'Bound',
    '未绑定': 'Not bound', '可用': 'Available', '租赁中': 'Rented', '维护中': 'In maintenance', '已归还': 'Returned', '待付款': 'Awaiting payment',
    '待签署': 'Awaiting signature', '待取货': 'Ready for pickup', '归还中': 'Return pending', '已暂停': 'Suspended', '未知': 'Unknown',
    '设备未找到': 'Device not found', '订单未找到': 'Order not found', '合同未找到': 'Contract not found', '客户未找到': 'Customer not found',
    '无权查看订单': 'You cannot view this order', '无权查看合同': 'You cannot view this contract', '无法加载推荐信息': 'Unable to load referral information',
    '请求的资源不存在': 'The requested resource does not exist', '页面未找到': 'Page not found', '访问被拒绝': 'Access denied', '服务器错误': 'Server error',
    '需要认证': 'Authentication required', '服务不可用': 'Service unavailable', '邮箱验证': 'Email verification', '邮箱验证成功': 'Email verified',
    '验证邮箱': 'Verify email', '验证链接已失效': 'Verification link expired', '验证链接无效': 'Invalid verification link', '前往登录': 'Go to sign in',
    '找回密码': 'Forgot password', '重置密码': 'Reset password', '重置链接已失效': 'Reset link expired', '重置链接无效': 'Invalid reset link',
    '密码已更新': 'Password updated', '密码已重置，请使用新密码登录': 'Password reset. Please sign in with your new password',
    '当前密码不正确': 'Current password is incorrect', '两次输入密码不一致': 'Passwords do not match', '两次输入的新密码不一致': 'New passwords do not match',
    '密码格式无效': 'Invalid password format', '密码至少需要 8 位，并同时包含字母、数字和符号': 'Password must be at least 8 characters and include letters, numbers, and symbols',
    '个人信息已更新': 'Profile updated', '密码已更新，其他设备已退出登录': 'Password updated; other devices have been signed out',
    '注册': 'Register', '登录失败': 'Sign-in failed', '邮箱或密码错误': 'Incorrect email or password', '账户已停用': 'Account disabled',
    '租赁设备': 'Rent a device', '设备目录': 'Device catalogue', '添加新设备': 'Add device', '编辑设备': 'Edit device', '设备详情': 'Device details',
    '设备列表': 'Devices', '租赁设备不存在': 'The rental device does not exist', '暂无可租设备': 'No devices are currently available',
    '租赁日期': 'Rental dates', '开始日期': 'Start date', '归还日期': 'Return date', '租赁天数': 'Rental days', '每天': 'per day',
    '选择设备': 'Select device', '选择日期': 'Select dates', '设备租赁日历': 'Device rental calendar', '本月': 'This month', '上个月': 'Previous month', '下个月': 'Next month',
    '我的订单': 'My orders', '订单详情': 'Order details', '订单管理': 'Order management', '我的租赁': 'My rentals', '当前租赁中': 'Currently rented',
    '余额充值': 'Top up balance', '账户余额': 'Account balance', '余额不足': 'Insufficient balance', '充值记录': 'Top-up history', '充值': 'Top up',
    '我的推荐': 'My referrals', '推荐码': 'Referral code', '推荐计划': 'Referral program', '加入推荐计划': 'Join referral program', '退出推荐计划': 'Leave referral program',
    '个人信息': 'Profile', '安全设置': 'Security settings', '客户管理': 'Customer management', '创建客户账户': 'Create customer account',
    '编辑客户': 'Edit customer', '客户详情': 'Customer details', '员工仪表盘': 'Staff dashboard', '进行中的订单': 'Ongoing orders', '当前租赁中': 'Active rentals',
    '合同管理': 'Contract management', '合同查看': 'Contract view', '合同签署进度': 'Contract signing progress', '新增合同': 'New contract', '归还验机': 'Return inspection',
    '验机记录': 'Inspection records', '保存交付记录并开始租赁': 'Save handover and start rental', '交付设备': 'Hand over device', '交付配件': 'Hand-over accessories',
    '管理员': 'Administrator', '管理员通知中心': 'Admin notifications', '用户详情': 'User details', '添加新用户': 'Add user', '编辑用户': 'Edit user',
    '数据保留策略': 'Data retention policy', '设备运营报表': 'Device operations report', '收入统计': 'Revenue statistics', '运营分析报表': 'Operations report',
    '系统健康监控': 'System health monitoring', '通讯检测': 'Connectivity check', '远程控制': 'Remote control', '优惠码': 'Coupon', '优惠码不存在': 'Coupon not found',
    '优惠码无效': 'Invalid coupon', '优惠码已存在，请换一个代码': 'Coupon already exists; choose another code', '优惠码创建成功': 'Coupon created', '优惠码已更新': 'Coupon updated',
    '退款失败': 'Refund failed', '退款成功': 'Refund successful', '佣金提现': 'Commission withdrawal', '押金结算审批': 'Deposit settlement approval',
    '待结算押金': 'Deposits awaiting settlement', '支付争议': 'Payment disputes', '待处理支付争议': 'Payment disputes awaiting review', '风险标记': 'Risk flags',
    '异常订单': 'Anomalous orders', '异常订单不存在或已审核': 'Anomalous order not found or already reviewed', '发布通知': 'Publish notification', '历史公告': 'Announcement history',
    '邮件通知模板': 'Email notification templates', '协议模板': 'Agreement templates', '合同数据': 'Contract data', '设备绑定': 'Device binding', '绑定设备': 'Bind device',
    '客户端安装信息': 'Client installation', '复制 6 位访问码': 'Copy 6-digit access code', '已复制': 'Copied', '安装程序会安装到系统目录并注册': 'The installer will install and register the client in the system directory',
    '前往处理': 'Handle now', '全选当前结果': 'Select all results', '匹配 ': 'Matched ', '共 ': 'Total ', '人': ' people', '条': ' items',
    '保存失败': 'Save failed', '加载失败': 'Failed to load', '操作成功': 'Operation successful', '操作失败': 'Operation failed', '提交成功': 'Submitted successfully',
    '请稍候': 'Please wait', '请重新提交': 'Please submit again', '请联系工作人员': 'Please contact staff', '暂无数据': 'No data', '没有找到记录': 'No records found',
    '打印合同': 'Print contract', '返回合同查看': 'Back to contract', '打印凭证': 'Print document', '返回收据查看': 'Back to receipt', '查看合同': 'View contract',
    '合同签署': 'Contract signing', '合同验证': 'Contract verification', '支付结果': 'Payment result', '发票与付款收据': 'Invoice & payment receipt',
    '用户协议': 'User agreement', '服务条款': 'Terms of service', '隐私政策': 'Privacy policy', '退款政策': 'Refund policy', '投诉与争议解决政策': 'Complaints and dispute resolution policy'
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
  var translateText = function (value) {
    var text = String(value || '');
    if (!text.trim()) return text;
    var leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0];
    var core = text.slice(leading.length, text.length - trailing.length || undefined);
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
      document.title = language === 'en' ? translateText(title) + ' - PC Rental' : originalTitle;
    }
    var scope = root || document.body;
    if (!scope) return;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (shouldSkip(node)) continue;
      var source = sourceFor(node, node.nodeValue || '');
      node.nodeValue = language === 'en' ? translateText(source) : source;
    }
    scope.querySelectorAll('input[placeholder], textarea[placeholder], [title], [aria-label], input[type="submit"], input[type="button"]').forEach(function (element) {
      ['placeholder', 'title', 'aria-label', 'value'].forEach(function (attribute) {
        if (!element.hasAttribute(attribute) || (attribute === 'value' && !/^(submit|button)$/i.test(element.type))) return;
        var value = element.getAttribute(attribute) || '';
        var source = element.getAttribute('data-i18n-' + attribute) || value;
        element.setAttribute('data-i18n-' + attribute, source);
        element.setAttribute(attribute, language === 'en' ? translateText(source) : source);
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
