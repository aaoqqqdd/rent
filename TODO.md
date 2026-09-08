信心程度：高。你现在这份 TODO 已经把“能不能运营”这一层做得比较完整，但还缺几类真正上线后很容易出问题的东西：幂等性、并发一致性、财务对账、租赁变更、设备安全、隐私生命周期、故障恢复和自动化测试。

我建议不要只把现有 P1/P2 补完，而是把清单升级成下面这种结构。这样以后可以直接拿它作为开发 Roadmap。

系统完善清单

以 设计文档/完善.md、数据库迁移文件及对应 Verification Report 为准。

每项只有同时满足以下条件后才允许勾选：

* 业务逻辑完成
* 数据库迁移完成（如适用）
* RBAC 权限校验完成
* Audit Log 完成（高风险操作）
* API 参数验证完成
* 前端页面 / 管理入口完成
* 正常流程测试完成
* 异常流程测试完成
* 并发 / 幂等测试完成（如适用）
* TypeScript 检查通过
* 本地 D1 migration 全量通过

⸻

P0 — 核心运营与财务安全

订单 / 租赁

* 订单状态、付款状态、租赁状态分离。
* 租赁状态历史记录。
* 设备交付记录。
* 设备归还记录。
* 合同不可变快照。
* 损坏案例基础管理。
* 设备生命周期管理。
* 异常任务中心。

权限与审计

* Audit Log 基础系统。
* RBAC。
* MANAGER 角色。
* 高风险操作二次确认。
* 退款权限控制。
* 押金扣款权限控制。
* 余额调整权限控制。
* 合同作废权限控制。

押金

* Deposit 独立状态管理。
* HELD
* PARTIALLY_REFUNDED
* REFUNDED
* FORFEITED
* 押金扣款原因分类。
* Manager 审批。
* 押金结算凭证。
* 部分退款。

财务

* 不可变财务流水。
* Payment Ledger。
* Refund Ledger。
* Balance Ledger。
* Referral Ledger。
* Discount Ledger。

⸻

P1 — 上线前必须完成

进度（2026-09-07）：#2 身份验证/敏感资料脱敏 ✅、#3 远程命令状态机 ✅、#4 设备维护生命周期 ✅、#5 订单修改历史 ✅、#6 混合付款/退款分配 ✅、#7 Webhook 幂等 ✅。仅 #1 邮件事件幂等待做（用户暂缓）。迁移 0103–0106（0104 顺带修 0073/0074 遗留的 device_command_results 悬空外键；0106 为 0018 遗留的 users→users_old 加同步触发器，与 0060 对 devices 的做法一致）。测试 tests/orderChanges·deviceCommandStateMachine·deviceLifecycle·refundAllocation·core。

进度（2026-09-07，补充）：把 #5 / #6 的可见性下沉到员工与客户端（原计划外，仅前端只读展示，无新迁移 / 无新业务逻辑）。
* 员工订单详情 `src/pages/staff/orderDetail.ts`：新增“订单修改历史”只读表（`order_change_history` + `diffOrderSnapshots`）与“付款与退款对账”只读面板（`reconcileOrderPayments`，异常提示员工通知管理员）。订单关键字段修改入口仍仅管理员。
* 客户订单详情 `src/pages/customer/orderDetail.ts`：新增“订单变更记录”（客户友好措辞，隐去操作人与设备内部 ID）与“付款与退款明细”（按付款来源 / 退款来源列出金额，不展示对账异常代码）。对应 P6 #25 的“查看付款记录 / 查看收据 / 查看押金状态”。
* 合同视图脱敏（#2）此前已下沉到 `src/pages/staff/contractView.ts`、`src/pages/public/contractView.ts`。

推荐奖励账本整合（2026-09-07，计划外，用户指出）：迁移 0108。历史上"佣金"用 `commission_records`，推荐流程改版后只写 `referral_rewards` + `users.commission_balance`，但 `/customer/referral` 页面和 `createWithdrawalRequest` 的提现资格校验仍只读 `commission_records`（已无写入方）——结果客户推荐页归零、新流程赚的佣金完全无法提现。本次以 `referral_rewards` 为唯一赚取账本：新增 `withdrawn_at` / `withdrawal_id` 列 + 回填历史 `commission_records` 后 `DROP TABLE commission_records`；`createWithdrawalRequest` 改为按 `referral_rewards`（AVAILABLE 且未被划走）FIFO 消耗、跨越提现额的那笔奖励拆分（`planWithdrawalConsumption`，`tests/referralWithdrawal.test.ts`），并把失效的 `BEGIN IMMEDIATE` 事务换成"守卫式扣减 + batch + 失败补偿"；`/admin/withdrawals/:id/status` 驳回时把预留佣金退回 `commission_balance` 并释放奖励（原来驳回不退款，是个资金 bug），完成/驳回都写审计；客户推荐页与访客清理守卫改读 `referral_rewards`。`commission_withdrawals`（打款队列）保留不变。invariant：`commission_balance` 恒等于未划走的 AVAILABLE 奖励合计，全流程本地验证通过。

1. 邮件事件幂等

当前状态：数据库结构完成，业务逻辑未完成（用户暂缓，未实施）。

* 所有业务邮件通过统一 email_events 服务发送。
* 每个邮件事件生成唯一 idempotency_key。
* 同一业务事件禁止重复发送。
* 支持 PENDING。
* 支持 SENDING。
* 支持 SENT。
* 支持 FAILED。
* 支持 CANCELLED。
* 保存邮件 provider message ID。
* 保存发送时间。
* 保存失败原因。
* 保存 retry count。
* 实现失败重试。
* 设置最大重试次数。
* 后台可查看发送记录。
* Manager 可手动重新发送。
* 手动重新发送写入 Audit Log。
* 测试重复 webhook / API 请求不会产生重复邮件。

⸻

2. 身份验证与敏感资料保护

当前状态：已完成。Verification 部分原已实现（`/admin/users/:id/identity` + `/identity-status`：五状态 NOT_REQUIRED/PENDING/VERIFIED/REJECTED/EXPIRED、验证方式、操作员工 verified_by、拒绝原因、verified_at，状态变更写 `IDENTITY_STATUS_UPDATED` 审计）。本次补齐 Sensitive Data：`SENSITIVE_CONTRACT_FIELDS`（customer_id_number）在 `renderContractVariables` 里对所有内部视图默认脱敏（新增 `revealSensitive` 参数）——普通 STAFF 的合同视图不再显示完整证件号；仅 ADMIN 可通过 `?reveal=id` 查看完整值，每次查看写 `sensitive_data_access_logs` + `SENSITIVE_DATA_VIEWED` 审计（helper `logSensitiveDataAccess`）；客户查看本人合同仍显示完整本人证件号。订单 CSV 导出本就不含证件字段。测试见 `tests/core.test.ts`（脱敏/揭示）。数据保留周期属 P3 #18。

Verification

* 定义身份验证状态：
    * NOT_REQUIRED
    * PENDING
    * VERIFIED
    * REJECTED
    * EXPIRED
* 保存验证时间。
* 保存验证方式。
* 保存验证操作员工。
* 保存拒绝原因。
* 身份验证状态变更写入 Audit Log。

Sensitive Data

* Passport / Driver Licence 默认脱敏显示。
* 普通 STAFF 不得查看完整证件号码。
* MANAGER / ADMIN 根据权限查看。
* 查看完整敏感信息属于审计事件。
* API 默认不返回完整敏感字段。
* 日志禁止记录完整身份证件号码。
* Error Tracking 禁止上传敏感字段。
* CSV / 报表默认不导出完整证件信息。
* 定义敏感资料删除 / 保留周期。

⸻

3. 远程设备命令完整状态机

当前状态：已完成（迁移 0104：`idempotency_key` 唯一键 + 修复 0074 遗留的 `device_command_results` 悬空外键）。`canTransitionDeviceCommand` / `DEVICE_COMMAND_TERMINAL_STATES` / `isHighRiskDeviceCommand` 状态机；`/api/device-agent/commands/:id/{ack,start}` 与 `/command-results` 对重复上报返回 `{ok:true,duplicate:true}` 而非 409，终态命令不再重复触发副作用；`/admin/devices/:id/commands` 用幂等键折叠重复下发；新增 `/admin/devices/:id/commands/:cmdId/cancel`（MANAGER+，QUEUED→CANCELLED，写审计）；控制台展示状态时间线 + 取消按钮。测试 `tests/deviceCommandStateMachine.test.ts`。TTL 过期、二次确认、审计日志沿用既有实现。

实现：

QUEUED → SENT → ACKNOWLEDGED → RUNNING → SUCCESS

异常：

QUEUED / SENT / ACKNOWLEDGED / RUNNING → FAILED

其他：

QUEUED → EXPIRED

QUEUED → CANCELLED

* 每次状态变化记录时间。
* 保存发送时间。
* 保存 ACK 时间。
* 保存执行开始时间。
* 保存完成时间。
* 保存失败原因。
* 保存客户端返回结果。
* Command ID 唯一。
* 客户端重复 ACK 不重复执行。
* 客户端重复请求不会创建重复命令。
* 命令具有 TTL。
* 过期命令禁止执行。
* 已成功命令禁止再次执行。
* 高风险命令需要 Manager 权限。
* 高风险命令二次确认。
* 高风险命令写 Audit Log。

高风险命令至少包括：

* 锁定设备
* 重启
* 注销用户
* 数据清除
* 系统重置
* 客户端重新注册

⸻

4. 设备维护生命周期

当前状态：已完成（迁移 0105：维护记录增加 replacement_parts / data_wipe_method / repair_notes / failure_reason）。`canTransitionDeviceLifecycle` + `DEVICE_LIFECYCLE_FLOW`（RETURNED→INSPECTION→MAINTENANCE→READY，DAMAGED/MAINTENANCE→RETIRED）；设备控制台新增“维护生命周期”面板：新建维护、按阶段推进、归还前十项验证清单、编辑维护详情（成本/服务商/技师/部件/数据清除方式/维修说明/发票链接）、退役设备。`/admin/maintenance/:id/{update}` + `/admin/devices/:id/retire`（MANAGER+，写审计，进行中订单禁止退役，退役自动终止未完成维护）。硬性规则：存在未完成维护时设备不能在编辑页被置为可用 / READY，CLIENT_CHECK 需 10/10 项通过才能完成维护并回到 READY。测试 `tests/deviceLifecycle.test.ts`。附带修复迁移 0074 遗留的 `device_command_results` 悬空外键（见迁移 0104）。

归还后的推荐流程：

RETURNED → INSPECTION → MAINTENANCE → READY

存在损坏：

RETURNED → INSPECTION → DAMAGED → MAINTENANCE → READY

退役：

MAINTENANCE / DAMAGED → RETIRED

* 创建 Maintenance Record。
* 保存维护原因。
* 保存维护人员。
* 保存开始时间。
* 保存完成时间。
* 保存维修说明。
* 保存维修成本。
* 保存更换部件。
* 支持附件 / 照片。
* 完成维护前禁止进入 READY。

Data Wipe

* 创建数据清除任务。
* 保存清除方式。
* 保存执行设备。
* 保存执行时间。
* 保存结果。
* 保存失败原因。
* 清除完成后生成记录。

System Reset

* 系统恢复标准镜像。
* 验证 Windows 正常启动。
* 验证设备客户端存在。
* 验证客户端版本。
* 验证客户端可以连接服务器。
* 验证设备 SN。
* 验证磁盘状态。
* 验证网络。
* 验证基础硬件状态。

全部通过后：

MAINTENANCE → READY

⸻

5. 订单修改历史

当前状态：已完成（迁移 0103；`buildOrderChangePlan` / `orderChangeSnapshot` / `diffOrderSnapshots` + `/admin/orders/:id/changes` 路由 + 订单详情页“订单修改”表单与“订单修改历史”列表 + `tests/orderChanges.test.ts`）。支持调整租期、更换设备、调整价格/押金/折扣、修改取还地点，均写 `order_change_history` 与 Audit Log；换机与改期自动做库存冲突检查并释放/锁定设备。尚未接入：审批流 `approval_id`、缩短租期的按比例退费、把独立的取消/退款路由回写为 `CANCELLATION` 历史。

任何已经创建的订单禁止直接静默修改关键字段。

支持：

* 延长租期。
* 缩短租期。
* 更换设备。
* 修改价格。
* 添加折扣。
* 删除折扣。
* 修改押金。
* 修改取货地点。
* 修改归还地点。
* 取消订单。

每次变更保存：

* change_type
* old_value
* new_value
* reason
* changed_by
* changed_at
* approval_id（如需要）

库存一致性

* 延期前检查未来库存冲突。
* 换机释放旧设备库存。
* 换机锁定新设备库存。
* 取消订单自动释放库存。
* 修改日期重新执行库存检查。
* 使用 transaction / 原子操作避免双重预订。

⸻

6. 混合付款与退款分配

当前状态：已完成（无新迁移，复用 payment_allocations / refund_allocations + 触发器 0093/0100）。新增统一分配引擎 `buildRefundAllocation(sources, amount, 'proportional'|'priority')`：按各来源“剩余可退”比例或按顺序（原支付方式优先）分摊，强制单来源上限与订单总额上限，分币误差由靠前来源逐分吸收；`allocateProportionalRefund` 改为其薄封装。新增对账：纯函数 `evaluatePaymentReconciliation`（检测 ALLOCATION_MISMATCH / OVER_REFUND_SOURCE / OVER_REFUND_ORDER / ORPHAN_REFUND_ALLOCATION / UNALLOCATED_REFUND）+ D1 包装 `reconcileOrderPayments`；订单详情页新增只读“付款与退款对账”面板，展示各付款来源 / 拆分 / 退款单并高亮异常。单来源退款上限本就由触发器 `refund_allocations_cannot_exceed_payment` 在库层强制。测试 `tests/refundAllocation.test.ts`。注：系统当前每单仅产生单一 payments 行，本项是把“多来源结算 + 退款分摊 + 账目守恒”能力与检测补齐。

支持：

* Stripe
* Customer Balance
* Deposit
* Credit / Adjustment
* 未来其他 Payment Method

例如：

订单 $500

Stripe $300 + Balance $200

退款 $250 时必须明确退款资金来源。

* 创建统一 allocation engine。
* Payment Allocation 总额必须等于实际支付额。
* Refund Allocation 总额必须等于实际退款额。
* 禁止退款超过原始付款。
* 禁止某付款来源退款超过该来源可退金额。
* 支持部分退款。
* 支持多次退款。
* 保存每次退款对应的原始 Payment。
* Stripe 退款与内部 Ledger 对账。
* Balance Refund 正确返还余额。
* Stripe payment fee 根据退款政策正确处理。
* rounding difference 有统一处理规则。

⸻

7. Webhook 幂等

当前状态：已完成（迁移 0104：通用 `webhook_events` 表，`provider + event_id` 唯一，含 payload_hash / status(RECEIVED|PROCESSED|FAILED) / failure_reason / attempts / received_at / processed_at）。`claimWebhookEvent` / `markWebhookProcessed` / `markWebhookFailed` helper。Stripe webhook 改用该表做去重，处理失败时标记 FAILED 并返回 5xx（原来吞成 200 导致 Stripe 不再重投、事件静默丢失），配合幂等业务语句可安全重试；`stripe_webhook_events` 保留但改为 `INSERT OR IGNORE`。设备回调幂等见 P1 #3。邮件回调待 P1 #1（用户暂缓）。

这一项建议单独增加，不要只依赖邮件幂等。

适用于：

* Stripe webhook
* Device callback
* Payment callback
* Email callback
* 未来第三方服务
* 创建 webhook_events。
* provider event ID 唯一。
* 保存 payload hash。
* 保存 received_at。
* 保存 processed_at。
* 保存 processing status。
* 保存 failure reason。
* 同一 Event ID 只能产生一次业务副作用。
* 支持安全 retry。
* Webhook 顺序错乱时保持状态正确。

⸻

8. 财务对账

Ledger 完成不等于财务系统完成。

* Payment 与 Ledger 自动核对。
* Refund 与 Ledger 自动核对。
* Deposit 与 Ledger 自动核对。
* Customer Balance 与 Ledger 自动核对。
* Referral Reward 与 Ledger 自动核对。
* Stripe transaction 与内部 Payment 自动核对。
* 检测 orphan payment。
* 检测重复 payment。
* 检测金额不一致。
* 检测退款金额不一致。
* 检测 balance ledger 不平。
* 异常自动进入任务中心。
* Manager 可执行 reconciliation。
* 对账操作写 Audit Log。

⸻

P2 — 风控、争议与客户生命周期

进度（2026-09-07）：按用户要求，把「设计文档/完善.md 的 P2（后续增强）」整体做完（本 TODO 自己的 P2 #9–#13 编号与之不同；Referral 风控 / Coupon 并发由并行会话处理，迁移 0108 / 0111_coupon_scope_and_concurrency）。本轮改动全部新增文件 / 追加式 helper，尽量不与并行会话冲突。整体：`npm test` 105 通过、`tsc --noEmit` 0 error、本地 D1 迁移 0107 / 0109–0113 全通过。

* 支付争议 / Chargeback（= TODO #9）✅：迁移 0107 给 payment_disputes 加 device_id / risk_flag_id 并回填历史设备。site.ts 纯函数状态机 canTransitionPaymentDispute / isPaymentDisputeOpen / paymentsBlockedByDispute / mapStripeDisputeStatus（DISPUTE_OPENED→UNDER_REVIEW→WON|LOST|CLOSED，终态锁定）。Stripe webhook 现处理 charge.dispute.created / updated / closed：created 关联设备、closed 败诉自动写 financial_impact、并自动升起 HIGH 级 CHARGEBACK 风险标记（回写 risk_flag_id）。退款侧统一 helper hasOpenPaymentDispute 覆盖全部入口（押金退款、提前归还退款、取消全额退款、银行转账补款）。后台 /admin/finance/payment-disputes 放宽到 MANAGER+，改用状态机校验流转。测试 tests/paymentDisputes.test.ts。
* 风险标记与黑名单（= TODO #10）✅：CRUD / 8 类型 / MANAGER+ / 审计此前已具备。本轮 site.ts 新增 isRiskFlagCurrentlyActive / findBlockingRiskFlag + ORDER_BLOCKING_RISK_FLAG_TYPES（PAYMENT_RISK / DEVICE_NOT_RETURNED / CHARGEBACK / FRAUD_SUSPECTED）——自助下单拦截从「任意标记」改为「任意 HIGH 级 或 硬拦截类型」，并全面过滤已过期标记（下单校验、风险页有效列表、员工 / 管理员客户页风险提示，均按严重程度排序）。风险页展示「拦截下单」徽标与到期状态。测试 tests/riskFlags.test.ts。
* 报表与运营分析✅：新增 /admin/reports「运营分析报表」（ADMIN），覆盖全部 12 项指标（租金收入 / 退款 / 净收入 / 应收未收 / 押金在持·已退·没收 / 逾期租赁 / 车队利用率 / 损坏·维护·优惠码·推荐奖励成本 / 支付方式占比），金额全部从 payments / payment_refunds / financial_ledger_entries / orders 明细聚合。site.ts 纯函数 deviceUtilisationRate / paymentMethodBreakdown。测试 tests/operationsReport.test.ts。
* 合同验证页（= TODO #13）✅：/verify 此前已实现（六字段零 PII）。本轮加 IP 限流（contract-verify 30/10min）、常时比较 timingSafeEqualStr、无参数时的手动核验表单 renderContractVerifyForm、客户合同视图展示可对外分享的验证链接；迁移 0109 为历史已签署合同回填 64 位十六进制验证令牌。测试 tests/contractVerification.test.ts。
* 数据保留策略（P3 #18）✅：迁移 0110 建 data_retention_policies（9 类，保留天数 + 依据 + 到期动作 RETAIN/ARCHIVE/DELETE/ANONYMISE + 启用位）并 seed。/admin/data-retention（ADMIN）可编辑策略 + 只读「已过期条数」预览（合同 / 财务 / 审计禁止设为 DELETE），改动写 DATA_RETENTION_POLICY_UPDATED 审计。site.ts 纯函数 retentionCutoffDate / isPastRetention / retentionSweepActionable。实际清理任务留待 P4。测试 tests/dataRetention.test.ts。
* 备份与恢复（P4 #19、#20）✅：迁移 0112 建 backup_policy（单行 RPO/RTO + 最近恢复演练）/ backup_runs / restore_tests。/admin/backup（ADMIN）：下载 /admin/backup/export.json 离线快照（合同 / 付款 / 退款 / Ledger / 余额流水 / 审计 / 发票 + FNV-1a 校验和，写 backup_runs + BACKUP_EXPORTED 审计）、编辑 RPO/RTO 策略、记录恢复演练（写 RESTORE_TEST_RECORDED 审计）。site.ts 纯函数 backupHealth / restoreTestOverdue / fnv1aHex。测试 tests/backupRestore.test.ts。
* Referral 风控／Coupon 并发和预留：由并行会话负责（迁移 0108 referral 账本整合、0111_coupon_scope_and_concurrency + src/actions/coupons.ts / src/pages/customer/referral.ts / tests/referralWithdrawal.test.ts）。本会话未改动这两块以避免冲突。
* Agent Program 预留（Phase 4）✅：迁移 0113 建 agents / agent_attributions / feature_flags（agent_program 默认关闭），仅预留、不接入下单结算。/admin/agents（ADMIN）只读展示并显式提示「未启用」。site.ts 纯函数 agentCommission（含单单上限）。测试 tests/agentProgram.test.ts。
* 异常自动化与监控（P8 #32、#33）✅：runDataConsistencyChecks 增补剩余 5 项校验（RETURNED 无归还记录 / REFUNDED 无退款流水 / 发票无付款 / 设备 RENTED 无有效订单已有、AVAILABLE 却有活跃订单）。新增 /admin/monitoring（ADMIN）系统健康监控：API 错误率 / 付款·邮件失败率 / 设备离线率 / 远程命令·定时任务失败率 / 异常积压，按 OK/WARN/CRITICAL 分级。site.ts 纯函数 rateHealth / worstHealthLevel + collectMonitoringMetrics / runMonitoringSweep（CRITICAL 自动写 data_consistency_issues MONITORING_ALERT），并挂到 scheduled() cron 的 run_monitoring_sweep 步。测试 tests/monitoring.test.ts。

9. 支付争议 / Chargeback

* DISPUTE_OPENED
* DISPUTE_UNDER_REVIEW
* DISPUTE_WON
* DISPUTE_LOST
* DISPUTE_CLOSED

保存：

* disputed amount
* payment ID
* Stripe dispute ID
* reason
* evidence deadline
* evidence status
* result
* financial impact
* Chargeback 自动创建异常任务。
* 关联订单。
* 关联客户。
* 关联租赁。
* 关联付款。
* 关联设备。
* 防止争议金额被再次正常退款。

⸻

10. 风险标记与黑名单

不要只设计一个 is_blacklisted Boolean。

创建 Risk Flag：

* PAYMENT_RISK
* IDENTITY_RISK
* DEVICE_NOT_RETURNED
* SERIOUS_DAMAGE
* CHARGEBACK
* ABUSE
* FRAUD_SUSPECTED
* MANUAL_REVIEW

Risk Flag 保存：

* severity
* reason
* evidence
* created_by
* created_at
* expires_at
* resolved_at
* 高风险客户禁止自动创建新租赁。
* STAFF 可查看必要风险提示。
* Manager 可以解除。
* 解除必须填写原因。
* 创建 / 修改 / 删除风险标记写 Audit Log。

⸻

11. 优惠码并发控制

状态：

AVAILABLE → RESERVED → REDEEMED

失败 / 超时：

RESERVED → RELEASED

* Checkout 时 Reserve。
* Reservation 设置 expiry。
* Payment success 后 Redeem。
* Payment failure 后 Release。
* Checkout abandon 超时自动 Release。
* 防止同一优惠码并发超卖。
* Usage Limit 使用原子更新。
* per-customer limit。
* global limit。
* promotion budget limit。

⸻

12. 推荐奖励完整生命周期

已有资格延迟机制，在此基础上继续增加：

PENDING → QUALIFIED → AVAILABLE → USED

异常：

PENDING → REJECTED

QUALIFIED → REVOKED

* 防止自己推荐自己。
* 防止相同客户重复获得新客奖励。
* 防止循环推荐。
* 订单退款后重新判断奖励资格。
* Chargeback 后可以撤销奖励。
* 奖励撤销产生反向 Ledger Entry。
* 已使用奖励不得直接删除历史记录。

⸻

13. 合同公开验证页

例如通过：

contract_number + verification_token

验证合同真实性。

仅展示：

* Contract Number。
* Contract Status。
* Issue Date。
* Rental Period。
* Device Model。
* Contract Hash。
* 是否有效。
* 是否已作废。

禁止展示：

* 身份证件号码
* 地址
* 电话
* Email
* 签约 IP
* 客户完整个人资料
* Verification Token 使用高熵随机值。
* Rate Limit。
* 防枚举。
* 已作废合同显示 VOID。

⸻

P3 — 安全与合规

14. Session 与账户安全

* 登录失败限流。
* Account lock / cooldown。
* Password Reset Token 一次性使用。
* Reset Token 设置 expiry。
* 修改密码后撤销旧 Session。
* 管理员可撤销所有 Session。
* 高风险操作要求重新认证。
* 管理后台支持 MFA。
* Admin / Manager 强制 MFA。
* Session 保存创建时间。
* Session 保存最后活动时间。
* Session 可撤销。
* 权限变化后旧 Session 权限立即失效。

⸻

15. API 安全

* 所有 API 使用 schema validation。
* 禁止客户端提交服务端计算字段。
* Object-level authorization。
* 防止 IDOR。
* Rate Limit。
* Request Size Limit。
* Pagination Limit。
* Sort / Filter allowlist。
* CORS 明确定义。
* CSRF 防护（如认证架构需要）。
* Security Headers。
* Error Response 不泄露内部 Stack。
* Production 禁止 Debug Endpoint。

⸻

16. Secret 管理

* Stripe Secret 不进入数据库。
* API Secret 不进入 Git。
* Device Signing Secret 不进入前端。
* Production / Staging Secret 分离。
* Secret rotation 流程。
* 旧 Secret 可以安全撤销。
* Secret 使用记录可追踪。

⸻

17. Audit Log 防篡改

现有 Audit Log 继续增强：

* Audit Log 禁止 UPDATE。
* Audit Log 禁止 DELETE。
* 保存 actor。
* 保存 action。
* 保存 resource type。
* 保存 resource ID。
* 保存 timestamp。
* 保存 request ID。
* 保存 IP。
* 保存 User Agent。
* 保存 before / after metadata（敏感字段脱敏）。
* 高风险日志长期保留。
* 支持按订单 / 客户 / 员工 / 设备查询。

⸻

18. 数据保留与隐私生命周期

建立 Data Retention Policy。

至少覆盖：

* Customer Account
* Identity Documents
* Contracts
* Payments
* Deposits
* Audit Logs
* Device Logs
* Email Logs
* Support Records
* Uploaded Photos
* Damage Evidence

每种数据定义：

* Retention Period。
* Retention Reason。
* Legal / Operational Basis。
* Archive Rule。
* Delete Rule。
* Anonymisation Rule。

客户删除账户时：

* 判断哪些资料可以删除。
* 判断哪些资料必须保留。
* 非必要个人资料删除 / 匿名化。
* 财务和合同记录按适用要求保留。
* 删除操作写 Audit Log。

⸻

P4 — 可靠性与灾难恢复

19. Backup

* D1 Backup 策略。
* 定期数据库备份。
* 文件 / 图片备份。
* 合同文件备份。
* Backup encryption。
* Backup retention。
* Backup integrity verification。

⸻

20. Restore

不能只确认“有备份”。

必须实际测试：

* Database restore。
* Contract restore。
* Uploaded evidence restore。
* 配置恢复。
* 灾难恢复演练。
* 记录最后一次 restore test。

定义：

* RPO。
* RTO。

⸻

21. Scheduled Jobs

建立统一后台任务系统：

* Email retry。
* Expired coupon release。
* Expired remote command。
* Overdue rental detection。
* Deposit pending detection。
* Referral qualification。
* Maintenance reminder。
* Reconciliation。
* Data retention cleanup。

每个 Job：

* 有唯一 Job ID。
* 支持幂等。
* 保存开始时间。
* 保存完成时间。
* 保存失败原因。
* 支持 retry。
* 设置最大 retry。
* 连续失败进入异常任务中心。

⸻

P5 — 运营与报表

22. Dashboard

* 今日订单。
* 今日交付。
* 今日归还。
* Active Rentals。
* Overdue Rentals。
* Available Devices。
* Reserved Devices。
* Maintenance Devices。
* Damaged Devices。
* Deposit Pending。
* Failed Payments。
* Failed Device Commands。
* Pending Damage Cases。

⸻

23. 财务报表

* Gross Revenue。
* Net Revenue。
* GST。
* Discounts。
* Refunds。
* Stripe Fees。
* Deposit Held。
* Deposit Deduction。
* Referral Cost。
* Damage Recovery。
* Outstanding Amount。

所有报表金额必须来源于 Ledger / Payment 数据，不允许从 UI 状态推算。

⸻

24. 设备运营报表

* Fleet Utilisation Rate。
* Revenue per Device。
* Rental Days per Device。
* Downtime。
* Maintenance Frequency。
* Damage Frequency。
* Average Repair Cost。
* Device Lifetime Revenue。
* Retirement History。

⸻

P6 — 客户体验

25. Customer Portal

客户可以：

* 查看当前租赁。
* 查看历史租赁。
* 查看合同。
* 下载合同。
* 查看付款记录。
* 查看收据。
* 查看押金状态。
* 查看押金结算凭证。
* 查看推荐奖励。
* 查看优惠。
* 提交延期申请。
* 查看延期报价。
* 查看归还信息。
* 更新允许修改的个人资料。

⸻

26. Receipt / Invoice

每笔财务事件正确生成对应凭证。

* Payment Receipt。
* Refund Receipt。
* Deposit Receipt。
* Deposit Settlement Statement。
* Balance Adjustment Receipt。
* Rental Invoice（如业务流程需要）。

凭证保存不可变快照。

⸻

P7 — 测试与发布

27. Unit Tests

至少覆盖：

* Order state。
* Rental state。
* Device state。
* Deposit calculation。
* Refund allocation。
* Payment allocation。
* Discount calculation。
* Referral qualification。
* RBAC。
* Remote command state machine。
* Inventory conflict detection。

⸻

28. Integration Tests

必须测试完整流程：

正常租赁

Customer → Order → Payment → Reservation → Contract → Pickup → Active Rental → Return → Inspection → Deposit Settlement → Closed

* 全流程通过。

取消

Order → Payment → Cancel → Refund → Inventory Release

* 全流程通过。

损坏

Return → Inspection → Damage Case → Manager Approval → Deposit Deduction → Settlement

* 全流程通过。

延期

Active Rental → Extension → Inventory Check → Payment → Contract Amendment → New End Date

* 全流程通过。

换机

Rental → Replacement → Old Device Return → New Device Allocation → Audit

* 全流程通过。

⸻

29. 并发测试

必须专门测试：

* 两个客户同时预订最后一台设备。
* 两个 Staff 同时修改同一个订单。
* Manager 重复点击退款。
* Stripe webhook 重复发送。
* 优惠码同时使用。
* 推荐奖励重复结算。
* Device command 重复 ACK。
* Deposit settlement 重复提交。

预期结果：

所有金融、库存和奖励操作必须 exactly-once 或实现等效的幂等效果。

⸻

30. 发布检查

每次 Production Deployment：

* npm test
* TypeScript check
* lint
* build
* migration dry run
* D1 local migration
* staging migration
* staging smoke test
* production migration
* production smoke test
* rollback procedure confirmed

⸻

P8 — 可观测性

31. Request Trace

* 每个请求生成 request_id。
* Audit Log 保存 request ID。
* Payment 保存 request ID。
* Webhook 保存 request ID。
* Email Event 保存 request ID。
* Device Command 保存 request ID。

从一个订单应能够追踪：

Order → Payment → Webhook → Ledger → Contract → Rental → Device → Email → Audit

⸻

32. Error Monitoring

* Production Error Tracking。
* API Error Rate。
* Payment Failure Rate。
* Webhook Failure Rate。
* Email Failure Rate。
* Device Offline Rate。
* Remote Command Failure Rate。
* Scheduled Job Failure Rate。

严重错误自动进入异常任务中心或管理员告警。

⸻

33. Health Check

* API Health。
* Database Health。
* Stripe Integration Health。
* Email Provider Health。
* Device Service Health。
* Scheduled Job Health。

⸻

最终上线 Gate

以下条件全部满足才认为系统达到正式商业运营标准。

Database

* 所有 migration 全量通过。
* Production schema 与 migration 一致。
* Foreign Key 完整。
* Unique Constraint 完整。
* 必要 Index 完整。

Security

* RBAC 测试通过。
* 敏感数据脱敏。
* Rate Limit。
* Webhook 验签。
* Secret 管理。
* MFA。
* Audit Log。

Finance

* Payment Allocation。
* Refund Allocation。
* Deposit Settlement。
* Ledger。
* Reconciliation。
* Chargeback。

Rental

* Reservation。
* Pickup。
* Active Rental。
* Extension。
* Replacement。
* Return。
* Inspection。
* Maintenance。
* Retirement。

Reliability

* Backup。
* Restore Test。
* Scheduled Jobs。
* Idempotency。
* Concurrency Test。
* Monitoring。

Testing

* Unit Tests。
* Integration Tests。
* End-to-End Tests。
* Permission Tests。
* Financial Tests。
* Concurrency Tests。

Final

* npm test 全部通过。
* TypeScript 0 errors。
* Production build 成功。
* 本地 D1 全量迁移成功。
* Staging 全流程测试成功。
* Backup Restore 实际测试成功。
* 无未解决 P0 / P1 Critical Issue。

⸻

当前优先实施顺序

不要按照 P1 → P2 → P3 机械开发。

建议实际开发顺序：

1. 邮件幂等
2. Webhook 幂等
3. 订单修改历史
4. 混合付款 / Refund Allocation
5. 财务 Reconciliation
6. 身份验证与敏感资料脱敏
7. Remote Command 状态机
8. Maintenance / Data Wipe / Reset
9. 优惠码并发控制
10. Chargeback
11. Risk Flag
12. Session / MFA / API Security
13. Backup / Restore
14. Scheduled Jobs
15. Reporting
16. Customer Portal
17. Observability
18. 全量 Integration / Concurrency / E2E Test

其中 2、3、4、5、9 最需要优先处理，因为它们直接涉及重复扣款、重复退款、库存冲突、优惠超发和账目不一致等数据一致性问题。
