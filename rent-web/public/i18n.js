/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0. */
(function () {
  'use strict';
  var key = 'rent-language';
  var translations = {
    '跳到主要内容': 'Skip to main content', '打开菜单': 'Open menu', '主导航': 'Main navigation', '首页': 'Home',
    '设备方案': 'Devices', '租赁流程': 'How it works', '服务保障': 'Assurance', '常见问题': 'FAQ', '开始租赁': 'Start renting',
    '墨尔本电脑设备租赁': 'Computer rentals in Melbourne', '电脑不必买': 'You do not have to buy a computer', '性能随时租': 'Rent the performance you need',
    '从临时办公到高性能创作，用需要的时间租合适的设备。租期清楚、费用透明、订单全程在线管理。': 'From temporary work to demanding creative projects, rent the right equipment for as long as you need it. Clear terms, transparent pricing, and online order management.',
    '选择设备': 'Choose a device', '了解租赁流程': 'See how it works', '服务特点': 'Service highlights', '按日灵活租用': 'Flexible daily rental', '合同在线签署': 'Sign contracts online', '订单进度可查': 'Track your order',
    '设备在线': 'Device online', '租你需要的，不为闲置买单。': 'Rent what you need, without paying for idle hardware.', '状态': 'Status', '已检验': 'Inspected', '租期': 'Term', '按需选择': 'Choose as needed',
    'SCROLL TO EXPLORE': 'SCROLL TO EXPLORE', '服务摘要': 'Service summary', '状态透明': 'Transparent status', '下单前查看设备信息': 'See device information before ordering', '租期灵活': 'Flexible terms', '按实际使用周期选择': 'Choose the period you actually need', '流程在线': 'Online process', '合同、付款与订单集中管理': 'Contracts, payments, and orders in one place', '归还清楚': 'Clear returns', '验机与押金记录可追踪': 'Inspection and deposit records are traceable',
    '为任务选性能': 'Choose performance for the task', '不为配置做妥协': 'Do not compromise on configuration', '下面的设备、配置、日租金与状态直接来自租赁系统。数据会自动更新，最终费用以提交订单时的报价为准。': 'Devices, specifications, daily rates, and availability below come directly from the rental system. Data updates automatically; the final price is the quote shown when you submit your order.', '实时设备库': 'Live inventory', '正在读取最新数据…': 'Reading the latest data…', '台设备': ' devices', '正在同步设备信息': 'Syncing device information',
    '学习办公': 'Study & office', '设计创作': 'Design & creative', '高性能任务': 'High-performance work', '轻薄办公本': 'Lightweight office laptop', '创作性能本': 'Creative performance laptop', '高性能工作站': 'High-performance workstation',
    '适合网课、文档、远程会议与日常开发。优先考虑续航、重量和稳定性。': 'For online classes, documents, video calls, and everyday development. Prioritises battery life, weight, and stability.', '轻便好携带': 'Light and portable', '日常多任务': 'Everyday multitasking', '适合短期项目': 'Short projects', '独立图形性能': 'Dedicated graphics', '大容量内存': 'High-capacity memory', '创作软件友好': 'Creative software ready', '高性能处理器': 'High-performance processor', '专业图形配置': 'Professional graphics', '适合集中攻坚': 'Built for intensive work', '进入租赁系统': 'Enter rental system',
    '从选择到归还': 'From selection to return', '每一步都看得见': 'Every step is visible', '租赁流程不是黑箱。系统会保留订单、合同、付款与归还记录，方便你随时确认当前进度。': 'The rental process is not a black box. Orders, contracts, payments, and return records stay in the system so you can check progress at any time.', '选择设备与租期': 'Choose a device and term', '查看可租设备，按开始和归还日期提交租赁申请。': 'Browse available devices and submit a request with start and return dates.', '确认合同与费用': 'Confirm contract and fees', '在线核对设备、租金、押金与交付信息，再完成电子签署。': 'Review the device, rental fee, deposit, and handover details online, then sign electronically.', '取机并开始使用': 'Collect and start using', '按确认方式取机或收货，租期和订单状态可在账户中查看。': 'Collect or receive the device as agreed, then check the term and order status in your account.', '归还、验机与结算': 'Return, inspect, and settle', '设备归还后完成验机，押金处理结果与相关记录清晰可查。': 'After return, the device is inspected and the deposit outcome is recorded clearly.',
    '服务保障': 'Service assurance', '租来的设备': 'Rented equipment', '也该用得踏实': 'Should still feel dependable', '每笔订单的关键节点都有记录。你知道租的是什么、付的是什么，也知道归还之后发生了什么。': 'Every key order milestone is recorded. You know what you rented, what you paid, and what happened after return.', '查看常见问题': 'View FAQs', '设备信息明确': 'Clear device information', '型号、配置、押金与可用状态在下单前确认。': 'Model, specifications, deposit, and availability are confirmed before ordering.', '费用组成透明': 'Transparent pricing', '租金、押金、配送与支付费用分别列示。': 'Rental, deposit, delivery, and payment fees are shown separately.', '关键记录留存': 'Key records retained', '合同、发票、付款与订单变更集中在账户中。': 'Contracts, invoices, payments, and order changes stay in your account.', '归还处理可查': 'Returns you can track', '验机记录和押金结算结果保留清晰依据。': 'Inspection records and deposit outcomes have a clear audit trail.',
    '租之前': 'Before you rent', '先把问题说清楚': 'Let us answer your questions', '最短可以租多久？': 'What is the minimum rental period?', '费用里包含哪些项目？': 'What does the price include?', '设备出现问题怎么办？': 'What if there is a problem with the device?', '归还后押金如何处理？': 'What happens to the deposit after return?',
    '下一台电脑': 'Your next computer', '不必等到以后': 'Does not have to wait', '进入租赁系统，查看当前可用设备、选择租期并提交申请。': 'Enter the rental system to view available devices, choose a term, and submit an application.', '还有问题': 'Still have questions', '为需要短期设备的学生、创作者与灵活办公用户提供电脑租赁服务。': 'Computer rentals for students, creators, and flexible workers who need equipment for a shorter period.', '返回顶部': 'Back to top',
    '可租': 'Available', '暂不可租': 'Unavailable', '配置请咨询': 'Ask about configuration', '每日租金': 'Daily rental', '押金': 'Deposit', '当前没有可展示的设备，请稍后再来查看。': 'There are no devices to display right now. Please check again later.', '暂时离线': 'Temporarily offline', '设备数据读取失败': 'Unable to read device data', '暂时无法同步设备信息，请稍后刷新页面重试。': 'Device data could not be synced. Please refresh and try again later.', '更新于 ': 'Updated ', '按需选择': 'Choose as needed'
  };
  var keys = Object.keys(translations).sort(function (a, b) { return b.length - a.length; });
  var read = function () { try { return localStorage.getItem(key) === 'en' ? 'en' : 'zh'; } catch (_) { return 'zh'; } };
  var write = function (value) { try { localStorage.setItem(key, value); } catch (_) {} };
  var translate = function (value) {
    var text = String(value || ''), leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0];
    var core = text.slice(leading.length, text.length - trailing.length || undefined);
    if (Object.prototype.hasOwnProperty.call(translations, core)) return leading + translations[core] + trailing;
    keys.forEach(function (item) { if (core.indexOf(item) !== -1) core = core.split(item).join(translations[item]); });
    return leading + core + trailing;
  };
  var originalTitle = document.title;
  var apply = function () {
    var language = read();
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    var baseTitle = originalTitle.replace(/ - .+$/, '');
    document.title = language === 'en' ? translate(baseTitle) + ' - PC Rental' : originalTitle;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || node.parentElement.closest('script, style, textarea, pre, code')) continue;
      if (!node.__rentSource) node.__rentSource = node.nodeValue || '';
      node.nodeValue = language === 'en' ? translate(node.__rentSource) : node.__rentSource;
    }
    document.querySelectorAll('[data-language-label]').forEach(function (button) {
      var label = language === 'en' ? '中文' : 'English';
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换到英文');
      button.setAttribute('title', language === 'en' ? 'Switch to Chinese' : '切换到英文');
    });
  };
  document.addEventListener('click', function (event) {
    var toggle = event.target instanceof Element ? event.target.closest('[data-language-toggle]') : null;
    if (!toggle) return;
    event.preventDefault();
    write(read() === 'en' ? 'zh' : 'en');
    apply();
  });
  var observer = new MutationObserver(function () { window.setTimeout(apply, 0); });
  observer.observe(document.body, { childList: true, subtree: true });
  apply();
})();
