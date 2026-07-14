# TODO - Rent app fixes & features

## Phase 1（先稳定线上 CF + D1）：计划 A + B
- [x] 修复 `src/pages/admin/contracts.ts`：当 `currentTemplate.content` 为空时避免 `.replace` 报错（合同管理页不再崩）。
- [ ] 在构建/运行中确认 `/admin/contracts` 入口函数支持 `async` 渲染（如路由未 await 需要同步修复）。


- [ ] 检查并补齐 `src/pages/admin/contracts.ts`：模板保存接口/Quill hidden input 数据类型与空值兼容。
- [ ] `src/pages/admin/settings.ts`：实现租赁条款富文本与邮件通知模板富文本内容的**真实持久化**（写入 CF D1 / 或已有设置表/KV）。
- [ ] 新增/修复后端 endpoint（在 `src/index.ts` / actions 中）以接收设置保存请求并写入数据库。

## Phase 2（签署与推荐/分成）：计划 C + D
- [ ] 修复“合同签署链接无效/已过期”（根因：`src/site.ts` 里 insertContract 被重复定义，导致签约数据没写入 DB）
- [ ] 修复“待退款也不能用/退款不可用”（若同样是 in-memory / DB 数据源不一致，统一到 DB）
- [ ] `src/pages/public/contractSign.ts`：手机号改为国际区号 + 本地号输入（如 +86/+61），UI 校验提示。
- [ ] `src/actions/public/signContract.ts`：服务端校验国际区号+手机号格式，并将标准化后的手机号落库。
- [ ] `src/pages/public/contractSign.ts`：客户端“是否参加推荐码”交互（勾选/可选）。
- [ ] `src/actions/public/signContract.ts`：根据推荐码/推荐人计算并落库分成（按管理员配置比例）。
- [ ] `src/pages/customer/referral.ts`：确保展示佣金余额/待结算/已提现与后端一致（需要补后端查询）。

## Phase 3（权限与模板渲染）：计划 E + F
- [ ] `src/pages/staff/customers.ts`：员工客户列表改为按订单 `created_by` 推导“自己的客户”，移除不存在的 `staffId` 依赖。
- [ ] 所有 staff/customer 列表页/详情页：统一校验过滤条件，确保员工只能看自己的数据。
- [ ] 合同模板变量渲染：建立统一替换函数，缺失变量替换为空字符串，避免 undefined 导致渲染错误。

## 验证清单（完成每一步后手动验证）
- [ ] `/admin/contracts` 打开不报错。
- [ ] 修复后：staff 生成签约链接 -> 客户打开 `/contract/sign?token=...` 不再显示“合同链接无效或已过期”。
- [ ] 修复后：待退款列表可正常打开并可处理退款。
- [ ] `/admin/settings` 保存后刷新仍能看到更新的租赁条款/邮件模板。
- [ ] 客户签约页 phone 输入支持 +86/+61，错误能返回提示。
- [ ] 客户选择参加推荐码后，合同/佣金分成按配置生效。
- [ ] 不同员工账号登录：staff 客户列表与订单/合同可见范围正确。

