/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { Context } from 'hono'
import rawLayoutTemplate from './layout.html'
import { styleSheetHref, appScriptHref } from './lib/assetVersion'
import { nanoid } from 'nanoid'

// 给 styles.css / app.js 链接注入内容指纹版本号，配合 ?v=<hash> 的一年期 immutable 缓存。
const layoutTemplate = rawLayoutTemplate
  .replace('href="/styles.css"', `href="${styleSheetHref}"`)
  .replace('src="{{APP_SCRIPT}}"', `src="${appScriptHref}"`)

// ---------------------------------------------------------------------------
// 通用工具函数已拆分到 src/lib/*。这里 import 供本文件内部使用，并在文件内
// 统一 re-export，让既有 `import { ... } from './site'`（页面 / action / 测试）
// 保持零改动。
// ---------------------------------------------------------------------------
import { generateReferenceNumber, generateContractNumber } from './lib/reference'
import {
  sanitizeRichHtml, sanitizePlainText, neutralizeTemplateTokens,
  renderNotificationMarkdown, renderFlexibleContent, renderEmailNotificationHtml, createPageBreakHtml,
} from './lib/html'
import { splitPersonName, combinePersonName, getAvatarInitials } from './lib/personName'
import { getAccessLevel, canManageUser, canUseAccountBalance } from './lib/access'
import type { Role, AccessLevel } from './lib/access'
import { formatCurrency, formatMelbourneDateTime, formatMelbourneDate, formatDate } from './lib/format'
import { hashPassword, verifyPassword, isStrongPassword, generateTemporaryPassword } from './lib/password'
import { timingSafeEqualStr } from './lib/checksum'
import { parseCookie } from './lib/cookie'
import { generateUserId, generateReferralCode } from './lib/userId'
import { validateHostedImageUrls } from './lib/hostedImages'
import { safeJsonParse } from './lib/json'
import { dispatchChannelAlert } from './notifyChannels'

export {
  generateReferenceNumber, generateContractNumber,
  sanitizeRichHtml, sanitizePlainText, neutralizeTemplateTokens,
  renderNotificationMarkdown, renderFlexibleContent, renderEmailNotificationHtml, createPageBreakHtml,
  splitPersonName, combinePersonName, getAvatarInitials,
  getAccessLevel, canManageUser, canUseAccountBalance,
  formatCurrency, formatMelbourneDateTime, formatMelbourneDate, formatDate,
  hashPassword, verifyPassword, isStrongPassword, generateTemporaryPassword,
  timingSafeEqualStr,
  parseCookie,
  generateUserId, generateReferralCode,
  validateHostedImageUrls,
}
export type { Role, AccessLevel }

// ---------------------------------------------------------------------------
// 纯业务逻辑 / 状态机已拆分到 src/domain/*（均有独立单元测试）。同样 import
// 供本文件使用并统一 re-export。
// ---------------------------------------------------------------------------
import { canTransitionOrder } from './domain/orderStatus'
import {
  ORDER_CHANGE_TYPES, ORDER_CHANGE_TYPE_LABELS,
  orderChangeSnapshot, diffOrderSnapshots, buildOrderChangePlan,
} from './domain/orderChanges'
import type { OrderChangeType, OrderChangePlan } from './domain/orderChanges'
import {
  DEVICE_COMMAND_STATES, DEVICE_COMMAND_TERMINAL_STATES,
  canTransitionDeviceCommand, HIGH_RISK_DEVICE_COMMANDS, isHighRiskDeviceCommand,
} from './domain/deviceCommand'
import type { DeviceCommandState } from './domain/deviceCommand'
import {
  DEVICE_LIFECYCLE_FLOW, canTransitionDeviceLifecycle,
  MAINTENANCE_OPEN_STATES, MAINTENANCE_ADVANCE_NEXT, MAINTENANCE_CHECK_TYPES,
} from './domain/deviceLifecycle'
import {
  PAYMENT_DISPUTE_STATES, PAYMENT_DISPUTE_OPEN_STATES, PAYMENT_DISPUTE_TERMINAL_STATES,
  canTransitionPaymentDispute, isPaymentDisputeOpen, paymentsBlockedByDispute, mapStripeDisputeStatus,
} from './domain/paymentDispute'
import type { PaymentDisputeState } from './domain/paymentDispute'
import {
  RISK_FLAG_TYPES, RISK_FLAG_SEVERITIES, ORDER_BLOCKING_RISK_FLAG_TYPES,
  isRiskFlagCurrentlyActive, findBlockingRiskFlag,
} from './domain/riskFlags'
import type { RiskFlagType, RiskFlagLike } from './domain/riskFlags'
import { deviceUtilisationRate, paymentMethodBreakdown } from './domain/operationsReport'
import type { PaymentMethodRow, PaymentMethodShare } from './domain/operationsReport'
import {
  RETENTION_ACTIONS, retentionCutoffDate, isPastRetention, retentionSweepActionable,
} from './domain/dataRetention'
import type { RetentionAction, RetentionPolicyLike } from './domain/dataRetention'
import { rateHealth, countHealth, worstHealthLevel, summarizeMetricHistory } from './domain/monitoring'
import type { HealthLevel, MonitorMetric, MonitorMetricKind, MetricHistoryPoint, MetricHistorySummary } from './domain/monitoring'
import { agentCommission } from './domain/agentProgram'
import { buildRefundAllocation, evaluatePaymentReconciliation } from './domain/refundAllocation'
import type {
  RefundSource, RefundAllocationLine, ReconInput, ReconIssue, ReconResult,
} from './domain/refundAllocation'

export {
  canTransitionOrder,
  ORDER_CHANGE_TYPES, ORDER_CHANGE_TYPE_LABELS,
  orderChangeSnapshot, diffOrderSnapshots, buildOrderChangePlan,
  DEVICE_COMMAND_STATES, DEVICE_COMMAND_TERMINAL_STATES,
  canTransitionDeviceCommand, HIGH_RISK_DEVICE_COMMANDS, isHighRiskDeviceCommand,
  DEVICE_LIFECYCLE_FLOW, canTransitionDeviceLifecycle,
  MAINTENANCE_OPEN_STATES, MAINTENANCE_ADVANCE_NEXT, MAINTENANCE_CHECK_TYPES,
  PAYMENT_DISPUTE_STATES, PAYMENT_DISPUTE_OPEN_STATES, PAYMENT_DISPUTE_TERMINAL_STATES,
  canTransitionPaymentDispute, isPaymentDisputeOpen, paymentsBlockedByDispute, mapStripeDisputeStatus,
  RISK_FLAG_TYPES, RISK_FLAG_SEVERITIES, ORDER_BLOCKING_RISK_FLAG_TYPES,
  isRiskFlagCurrentlyActive, findBlockingRiskFlag,
  deviceUtilisationRate, paymentMethodBreakdown,
  RETENTION_ACTIONS, retentionCutoffDate, isPastRetention, retentionSweepActionable,
  rateHealth, countHealth, worstHealthLevel, summarizeMetricHistory,
  agentCommission,
  buildRefundAllocation, evaluatePaymentReconciliation,
}
export type {
  OrderChangeType, OrderChangePlan, DeviceCommandState, PaymentDisputeState,
  RiskFlagType, RiskFlagLike, PaymentMethodRow, PaymentMethodShare,
  RetentionAction, RetentionPolicyLike, HealthLevel, MonitorMetric, MonitorMetricKind, MetricHistoryPoint, MetricHistorySummary,
  RefundSource, RefundAllocationLine, ReconInput, ReconIssue, ReconResult,
}

// ---------------------------------------------------------------------------
// 数据库句柄与领域实体类型已拆到 src/db/*。同样 import 使用并 re-export，
// 让既有 `import { getDB, type User, ... } from './site'` 保持不变。
// ---------------------------------------------------------------------------
import { getDB } from './db/client'
import type { User, Device, DeviceLifecycleStatus, Order, Contract, ContractTemplate } from './db/types'
export { getDB }
export type { User, Device, DeviceLifecycleStatus, Order, Contract, ContractTemplate }

// ---------------------------------------------------------------------------
// 系统设置的内存默认值 + 访问器已拆到 src/settings/*。loadSystemSettingsFromDB /
// updateSystemSettings 仍在本文件，就地读写导入的 systemSettings（同一引用）。
// ---------------------------------------------------------------------------
import { systemSettings, getSystemSettings, rentalTerms } from './settings/systemSettings'
import type { SystemSettingsKey } from './settings/systemSettings'
export { systemSettings, getSystemSettings, rentalTerms }
export type { SystemSettingsKey }

// ---------------------------------------------------------------------------
// 领域实体 CRUD（用户 / 订单 / 设备 / 合同）已拆到 src/db/repositories.ts。
// 编排逻辑（updateOrderStatus、调度清理、webhook、对账）仍在本文件，从这里
// import 需要的 CRUD。site.ts 统一 re-export，pages/actions/tests 零改动。
// ---------------------------------------------------------------------------
import {
  normalizeUserRow, userHasColumn,
  generateUniqueUserId, getUserById, findUserByEmail, verifyUserCredentials, findUserByReferralCode,
  getUsers, getUsersByIds, getUsersAsync, insertUser, updateUser,
  getOrderById, getOrders, getOrdersForUser, getOrdersWithDetailsForUser, getOrdersByIds, getOrdersAsync,
  insertOrder, ensureOrderNumber, updateOrder, updateOrderInDB, hasDeviceBookingConflict,
  getDeviceById, getDeviceBySerialNumber, getDevices, getDevicesByIds, getDevicesAsync,
  insertDevice, updateDevice, deleteDevice, updateDeviceStatus, recordDeviceLifecycle, releaseDeviceIfUnbooked,
  getContractById, getContractByOrderId, getAllContracts, getContractByContractNumber, getContractBySignToken,
  insertContract, updateContractStatus, updateContractStatusInDB,
} from './db/repositories'

export {
  generateUniqueUserId, getUserById, findUserByEmail, verifyUserCredentials, findUserByReferralCode,
  getUsers, getUsersByIds, getUsersAsync, insertUser, updateUser,
  getOrderById, getOrders, getOrdersForUser, getOrdersWithDetailsForUser, getOrdersByIds, getOrdersAsync,
  insertOrder, ensureOrderNumber, updateOrder, updateOrderInDB, hasDeviceBookingConflict,
  getDeviceById, getDeviceBySerialNumber, getDevices, getDevicesByIds, getDevicesAsync,
  insertDevice, updateDevice, deleteDevice, updateDeviceStatus, recordDeviceLifecycle, releaseDeviceIfUnbooked,
  getContractById, getContractByOrderId, getAllContracts, getContractByContractNumber, getContractBySignToken,
  insertContract, updateContractStatus, updateContractStatusInDB,
}

// ---------------------------------------------------------------------------
// 审计 / 错误日志已拆到 src/services/audit.ts（叶子层：仅依赖 db/client + nanoid）。
// 拆在这里是为了让其它服务模块能 import logError 而不与 site.ts 形成循环依赖。
// ---------------------------------------------------------------------------
import { createAuditLog, logError, cleanupOldErrorLogs } from './services/audit'
import type { ErrorLevel } from './services/audit'
export { createAuditLog, logError, cleanupOldErrorLogs }
export type { ErrorLevel }

// ---------------------------------------------------------------------------
// 业务服务已拆到 src/services/*：ledger（余额 / 财务台账）、notifications（站内
// 通知 + cron 邮件）、referral（推荐计划）、rentalProvisioning（外部付款入账 +
// Windows 账户命令）。依赖方向 services → db/lib/settings/audit，无回边。
// site.ts 仅 import 自身编排逻辑（updateOrderStatus / issueInvoice 等）需要的，
// 并统一 re-export。
// ---------------------------------------------------------------------------
import { recordBalanceTransaction, recordFinancialLedgerEntry } from './services/ledger'
import {
  ensureNotificationsTable, createNotification, getNotifications,
  createDueDateNotifications, deliverPendingAgreementEmails, notifyOverduePaymentProofs,
} from './services/notifications'
import {
  ensureReferralProgram, lockReferralRelationship, syncReferralOrderState,
  revokeReferralRewardForOrder, releaseQualifiedReferralRewards, releaseReferralRewardNow,
} from './services/referral'
import {
  recordExternalRentalFlow, enqueueRentalUserCreation, enqueueRentalUserDeletion,
} from './services/rentalProvisioning'
import { issueInvoice, issueCreditNote } from './services/invoice'
import { planWithdrawalConsumption, createWithdrawalRequest } from './services/withdrawal'
import type { WithdrawableReward, WithdrawalPlan } from './services/withdrawal'
import { getPendingOrdersWithDetails, getStaffDashboardData } from './services/staffDashboard'

export {
  recordBalanceTransaction, recordFinancialLedgerEntry,
  ensureNotificationsTable, createNotification, getNotifications,
  createDueDateNotifications, deliverPendingAgreementEmails, notifyOverduePaymentProofs,
  ensureReferralProgram, lockReferralRelationship, syncReferralOrderState,
  revokeReferralRewardForOrder, releaseQualifiedReferralRewards, releaseReferralRewardNow,
  recordExternalRentalFlow, enqueueRentalUserCreation, enqueueRentalUserDeletion,
  issueInvoice, issueCreditNote,
  planWithdrawalConsumption, createWithdrawalRequest,
  getPendingOrdersWithDetails, getStaffDashboardData,
}
export type { WithdrawableReward, WithdrawalPlan }

// ---------------------------------------------------------------------------
// Cookie 会话 + 限流已拆到 src/auth/session.ts（依赖 db + lib/cookie）。
// ---------------------------------------------------------------------------
import {
  findUserBySession, createAuthSession, revokeAllSessions, deleteAuthSession, enforceRateLimit,
} from './auth/session'
export {
  findUserBySession, createAuthSession, revokeAllSessions, deleteAuthSession, enforceRateLimit,
}

function renderLayoutTemplate(values: Record<string, string>): string {
  return layoutTemplate.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : placeholder
  )
}

export function renderSiteVariables(content: string, currentUser: any = {}, extraValues: Record<string, unknown> = {}): string {
  const values: Record<string, unknown> = {
    company_name: systemSettings.companyDetails.name,
    company_abn: systemSettings.companyDetails.abn,
    company_address: systemSettings.companyDetails.address,
    company_phone: systemSettings.companyDetails.phone,
    company_email: systemSettings.companyDetails.email,
    company_website: systemSettings.companyDetails.website,
    company_logo: systemSettings.companyDetails.logo,
    user_agreement_version: systemSettings.legalMetadata.user.version,
    user_agreement_last_updated_date: systemSettings.legalMetadata.user.lastUpdatedDate,
    service_terms_version: systemSettings.legalMetadata.service.version,
    service_terms_last_updated_date: systemSettings.legalMetadata.service.lastUpdatedDate,
    privacy_policy_version: systemSettings.legalMetadata.privacy.version,
    privacy_policy_last_updated_date: systemSettings.legalMetadata.privacy.lastUpdatedDate,
    refund_policy_version: systemSettings.legalMetadata.copyright.version,
    refund_policy_last_updated_date: systemSettings.legalMetadata.copyright.lastUpdatedDate,
    cookie_policy_version: systemSettings.legalMetadata.cookie.version,
    cookie_policy_last_updated_date: systemSettings.legalMetadata.cookie.lastUpdatedDate,
    complaints_policy_version: systemSettings.legalMetadata.complaints.version,
    complaints_policy_last_updated_date: systemSettings.legalMetadata.complaints.lastUpdatedDate,
    acceptable_use_policy_version: systemSettings.legalMetadata.aup.version,
    acceptable_use_policy_last_updated_date: systemSettings.legalMetadata.aup.lastUpdatedDate,
    consumer_rights_version: systemSettings.legalMetadata.consumer.version,
    consumer_rights_last_updated_date: systemSettings.legalMetadata.consumer.lastUpdatedDate,
    user_name: currentUser?.name || '',
    user_email: currentUser?.email || '',
    ...extraValues,
  }

  const filled = Object.entries(values).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`\\$\\{${key}\\}|\\{${key}\\}`, 'g'), escapeContractValue(value))
  }, String(content ?? ''))

  return sanitizeRichHtml(filled)
}


export function isContractExpired(contract: Contract, now = Date.now()): boolean {
  if ((contract.status as string) === 'expired') return true
  if (!['draft', 'pending_sign'].includes(contract.status)) return false
  const expiry = contract.signExpiresAt || contract.sign_expires_at || contract.validUntil || contract.valid_until
  if (!expiry) return false
  const expiryTime = new Date(expiry).getTime()
  return Number.isFinite(expiryTime) && expiryTime < now
}

export function isContractFinalized(contract: Contract | null | undefined): boolean {
  return Boolean(contract && ['signed', 'completed'].includes(contract.status) && contract.signedAt && contract.signed_content)
}

// 将数据库行归一化为同时包含 snake_case 和 camelCase 字段的 User 对象
export async function cancelExpiredPendingPaymentOrders(c: Context): Promise<number> {
  const orders = await c.env.RENT.prepare(`
    SELECT id, deviceId FROM orders
    WHERE status = 'pending_payment'
      AND datetime(createdAt) <= datetime('now', '-24 hours')
  `).all() as any
  let cancelled = 0
  for (const order of (orders.results || []) as any[]) {
    const result = await c.env.RENT.prepare(`
      UPDATE orders SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending_payment'
    `).bind(order.id).run() as any
    const changes = Number(result.meta?.changes ?? result.changes ?? 0)
    if (changes > 0) {
      cancelled += changes
      await c.env.RENT.prepare(`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE rental_id = ? AND status = 'pending'`).bind(order.id).run()
      await releaseDeviceIfUnbooked(c, order.deviceId)
      const { releaseCouponForOrder } = await import('./actions/coupons')
      await releaseCouponForOrder(c, order.id)
    }
  }
  return cancelled
}

// Periodically scans for known invariant violations (e.g. a paid order with no
// successful payment row) and records them so they surface in the admin
// Exception Queue instead of only being discoverable by manual investigation.
// Runs one named step of the scheduled() cron in isolation: records a
// scheduled_job_runs row, and — critically — catches its own error so one
// failing step can no longer abort every step queued after it in the same
// cron tick (the previous design was one flat try/catch around everything).
// Returns the step's result, or null if it threw (the error is logged both
// to scheduled_job_runs and via logError, matching existing convention).
export async function runScheduledJob<T>(c: Context, jobName: string, fn: () => Promise<T>): Promise<T | null> {
  const runId = `sjr-${nanoid(16)}`
  await c.env.RENT.prepare("INSERT INTO scheduled_job_runs (id, job_name, status) VALUES (?, ?, 'RUNNING')").bind(runId, jobName).run()
  try {
    const result = await fn()
    await c.env.RENT.prepare("UPDATE scheduled_job_runs SET status = 'SUCCESS', completed_at = CURRENT_TIMESTAMP, result_summary = ? WHERE id = ?").bind(JSON.stringify(result ?? null).slice(0, 2000), runId).run()
    return result
  } catch (error: any) {
    await c.env.RENT.prepare("UPDATE scheduled_job_runs SET status = 'FAILED', completed_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?").bind(String(error?.message || error).slice(0, 2000), runId).run()
    await logError(c, 'ERROR', `Scheduled job failed: ${jobName}`, error as Error)
    return null
  }
}

export async function runDataConsistencyChecks(c: Context): Promise<number> {
  const checks: Array<{ issueType: string; entityType: string; sql: string; autoSuspend?: boolean }> = [
    {
      issueType: 'PAID_ORDER_WITHOUT_PAYMENT',
      entityType: 'ORDER',
      autoSuspend: true,
      sql: `SELECT o.id FROM orders o WHERE o.payment_status = 'PAID' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.rental_id = o.id AND p.status = 'paid')`,
    },
    {
      issueType: 'ACTIVE_ORDER_WITHOUT_HANDOVER',
      entityType: 'ORDER',
      autoSuspend: true,
      sql: `SELECT o.id FROM orders o WHERE o.status IN ('active', 'extended', 'overdue') AND o.handover_completed_at IS NULL`,
    },
    {
      issueType: 'COMPLETED_ORDER_DEPOSIT_HELD',
      entityType: 'ORDER',
      sql: `SELECT o.id FROM orders o WHERE o.status = 'completed' AND o.deposit_status = 'HELD'`,
    },
    {
      issueType: 'DEVICE_RENTED_WITHOUT_ACTIVE_ORDER',
      entityType: 'DEVICE',
      sql: `SELECT d.id FROM devices d WHERE d.lifecycle_status = 'RENTED' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.deviceId = d.id AND o.status IN ('active', 'paid', 'extended', 'overdue', 'pending_return'))`,
    },
    {
      issueType: 'RETURNED_ORDER_WITHOUT_RETURN_RECORD',
      entityType: 'ORDER',
      sql: `SELECT o.id FROM orders o WHERE o.status IN ('returned', 'pending_return', 'completed') AND o.rental_status IN ('RETURNED', 'COMPLETED') AND o.return_received_at IS NULL`,
    },
    {
      issueType: 'REFUNDED_ORDER_WITHOUT_REFUND_TXN',
      entityType: 'ORDER',
      sql: `SELECT o.id FROM orders o WHERE o.payment_status IN ('REFUNDED', 'PARTIALLY_REFUNDED') AND NOT EXISTS (SELECT 1 FROM payment_refunds r WHERE r.order_id = o.id AND r.status = 'succeeded')`,
    },
    {
      issueType: 'INVOICE_WITHOUT_PAYMENT',
      entityType: 'ORDER',
      sql: `SELECT i.order_id AS id FROM invoices i WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.rental_id = i.order_id AND p.status = 'paid')`,
    },
    {
      issueType: 'DEVICE_AVAILABLE_WITH_ACTIVE_ORDER',
      entityType: 'DEVICE',
      sql: `SELECT d.id FROM devices d WHERE COALESCE(d.lifecycle_status, d.status) IN ('AVAILABLE', 'available', 'READY') AND EXISTS (SELECT 1 FROM orders o WHERE o.deviceId = d.id AND o.status IN ('active', 'extended', 'overdue', 'pending_return'))`,
    },
  ]
  let found = 0
  for (const check of checks) {
    const rows = (await c.env.RENT.prepare(check.sql).all()).results || []
    for (const row of rows as any[]) {
      const result = await c.env.RENT.prepare('INSERT OR IGNORE INTO data_consistency_issues (id, issue_type, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?)')
        .bind(`dci-${nanoid(12)}`, check.issueType, check.entityType, row.id, JSON.stringify(row)).run() as any
      if (Number(result.meta?.changes ?? result.changes ?? 0) > 0) found++
      if (Number(result.meta?.changes ?? result.changes ?? 0) > 0 && check.autoSuspend) {
        const order = await c.env.RENT.prepare("SELECT id, status FROM orders WHERE id = ? AND status IN ('paid', 'active', 'extended', 'overdue')").bind(row.id).first() as any
        if (order) {
          const issue = await c.env.RENT.prepare('SELECT id FROM data_consistency_issues WHERE issue_type = ? AND entity_id = ? AND resolved_at IS NULL').bind(check.issueType, order.id).first() as any
          if (issue) {
            await c.env.RENT.prepare('INSERT OR IGNORE INTO anomalous_order_reviews (id, order_id, consistency_issue_id, anomaly_type, original_status) VALUES (?, ?, ?, ?, ?)').bind(`aor-${nanoid(12)}`, order.id, issue.id, check.issueType, order.status).run()
            await updateOrderStatus(c, order.id, 'suspended')
          }
        }
      }
    }
  }
  return found
}

// 系统健康监控（完善.md P8 #32）：所有健康检查（/admin/monitoring、/health、cron sweep）
// 共用这一份指标定义，避免同一段口径散落在多处后各自漂移。
//   kind='rate'  ：SQL 需 SELECT n（分子）与 d（分母），按 warn/crit 比率分级；d<=0 记 OK。
//   kind='count' ：SQL 只需 SELECT n，按 warn/crit 条数分级，不伪造分母。
export interface MonitorMetricDef {
  key: string
  label: string
  kind: MonitorMetricKind
  warn: number
  crit: number
  sql: string
  note?: string
}

const MONITOR_SNAPSHOT_RETENTION_DAYS = 30

export const MONITOR_METRIC_DEFS: MonitorMetricDef[] = [
  { key: 'api_error_rate', label: 'API 错误率（24h）', kind: 'rate', warn: 0.02, crit: 0.1,
    sql: `SELECT (SELECT COUNT(*) FROM error_logs WHERE error_level IN ('ERROR','FATAL') AND created_at > datetime('now','-1 day')) AS n, (SELECT COUNT(*) FROM error_logs WHERE created_at > datetime('now','-1 day')) AS d` },
  { key: 'payment_failure_rate', label: '付款失败率（24h）', kind: 'rate', warn: 0.1, crit: 0.3,
    sql: `SELECT SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS n, COUNT(*) AS d FROM payments WHERE created_at > datetime('now','-1 day')` },
  { key: 'webhook_failure_rate', label: 'Webhook 失败率（24h）', kind: 'rate', warn: 0.1, crit: 0.3,
    sql: `SELECT SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS n, COUNT(*) AS d FROM webhook_events WHERE received_at > datetime('now','-1 day')` },
  { key: 'email_failure_rate', label: '邮件失败率（24h）', kind: 'rate', warn: 0.1, crit: 0.3,
    sql: `SELECT SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS n, COUNT(*) AS d FROM email_events WHERE created_at > datetime('now','-1 day')` },
  { key: 'device_offline_rate', label: '设备离线率', kind: 'rate', warn: 0.2, crit: 0.5,
    sql: `SELECT SUM(CASE WHEN agent_status = 'offline' THEN 1 ELSE 0 END) AS n, COUNT(*) AS d FROM devices WHERE agent_token_hash IS NOT NULL` },
  { key: 'remote_command_failure_rate', label: '远程命令失败率（24h）', kind: 'rate', warn: 0.15, crit: 0.4,
    sql: `SELECT SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS n, SUM(CASE WHEN status IN ('SUCCESS','FAILED','EXPIRED') THEN 1 ELSE 0 END) AS d FROM device_commands WHERE created_at > datetime('now','-1 day')` },
  { key: 'scheduled_job_failure_rate', label: '定时任务失败率（24h）', kind: 'rate', warn: 0.1, crit: 0.25,
    sql: `SELECT SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS n, COUNT(*) AS d FROM scheduled_job_runs WHERE started_at > datetime('now','-1 day')` },
  // 计数型：积压排除 MONITORING_ALERT 自身，否则「告警写回 data_consistency_issues → 抬高积压 → 再告警」自循环。
  { key: 'open_exception_backlog', label: '异常任务积压', kind: 'count', warn: 3, crit: 10,
    sql: `SELECT (SELECT COUNT(*) FROM data_consistency_issues WHERE resolved_at IS NULL AND issue_type <> 'MONITORING_ALERT') + (SELECT COUNT(*) FROM anomalous_order_reviews WHERE status = 'PENDING') AS n`,
    note: '未处理异常条数（WARN ≥3 / CRITICAL ≥10）' },
]

// 近 minutes 分钟内 ERROR/CRITICAL 日志计数。/api/system-status 与 /api/monitor 的实时错误探针共用，
// 用比 collectMonitoringMetrics（24h 口径）更短的窗口做即时告警。
export async function recentErrorLogCount(c: Context, minutes: number): Promise<{ total: number; critical: number }> {
  const row = await c.env.RENT.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN error_level = 'CRITICAL' THEN 1 ELSE 0 END) AS critical
     FROM error_logs WHERE error_level IN ('ERROR', 'CRITICAL') AND datetime(created_at) >= datetime('now', ?)`,
  ).bind(`-${Math.max(1, Math.floor(minutes))} minutes`).first() as any
  return { total: Number(row?.total || 0), critical: Number(row?.critical || 0) }
}

// 每个指标独立 try/catch，缺表不影响其它指标。
export async function collectMonitoringMetrics(c: Context): Promise<MonitorMetric[]> {
  const metrics: MonitorMetric[] = []
  for (const def of MONITOR_METRIC_DEFS) {
    try {
      const row = await c.env.RENT.prepare(def.sql).first() as { n?: number; d?: number } | null
      const numerator = Number(row?.n || 0)
      if (def.kind === 'count') {
        const { level } = countHealth(numerator, def.warn, def.crit)
        metrics.push({ key: def.key, label: def.label, kind: 'count', numerator, denominator: 0, rate: 0, level, note: def.note })
      } else {
        const denominator = Number(row?.d || 0)
        const { rate, level } = rateHealth(numerator, denominator, def.warn, def.crit)
        metrics.push({ key: def.key, label: def.label, kind: 'rate', numerator, denominator, rate, level, note: def.note })
      }
    } catch {
      metrics.push({ key: def.key, label: def.label, kind: def.kind, numerator: 0, denominator: 0, rate: 0, level: 'OK', note: '无数据源' })
    }
  }
  return metrics
}

// 近 windowHours 内的指标快照，按 metric_key 分组、时间升序，供 /admin/monitoring 画趋势。
export async function getMonitoringHistory(c: Context, windowHours = 168): Promise<Record<string, MetricHistoryPoint[]>> {
  const out: Record<string, MetricHistoryPoint[]> = {}
  try {
    const rows = (await c.env.RENT.prepare(
      `SELECT metric_key, captured_at, rate, level FROM monitoring_metric_snapshots
       WHERE captured_at > datetime('now', ?) ORDER BY captured_at ASC`,
    ).bind(`-${Math.max(1, Math.floor(windowHours))} hours`).all()).results as any[]
    for (const r of rows || []) {
      const key = String(r.metric_key)
      ;(out[key] ||= []).push({ capturedAt: String(r.captured_at), rate: Number(r.rate) || 0, level: r.level as HealthLevel })
    }
  } catch { /* 快照表尚未迁移时静默降级为空趋势 */ }
  return out
}

// 调度步骤：跑一遍监控，落盘快照（并清理过期），若有 CRITICAL 指标则写入异常任务中心（去重按当天）。
export async function runMonitoringSweep(c: Context): Promise<{ metrics: number; alerts: number }> {
  const metrics = await collectMonitoringMetrics(c)

  try {
    for (const m of metrics) {
      // count 型没有比率，用条数作为可绘制的量级存进 rate 列（level 列仍是权威分级）。
      const graphable = m.kind === 'count' ? m.numerator : m.rate
      await c.env.RENT.prepare(
        `INSERT INTO monitoring_metric_snapshots (id, metric_key, numerator, denominator, rate, level) VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(`mms-${nanoid(14)}`, m.key, m.numerator, m.denominator, graphable, m.level).run()
    }
    await c.env.RENT.prepare(
      `DELETE FROM monitoring_metric_snapshots WHERE captured_at < datetime('now', ?)`,
    ).bind(`-${MONITOR_SNAPSHOT_RETENTION_DAYS} days`).run()
  } catch { /* 快照表尚未迁移时不影响告警逻辑 */ }

  let alerts = 0
  for (const m of metrics.filter(x => x.level === 'CRITICAL')) {
    const res = await c.env.RENT.prepare('INSERT OR IGNORE INTO data_consistency_issues (id, issue_type, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?)')
      .bind(`dci-${nanoid(12)}`, 'MONITORING_ALERT', 'METRIC', `${m.key}:${new Date().toISOString().slice(0, 10)}`, JSON.stringify(m)).run() as any
    if (Number(res.meta?.changes ?? res.changes ?? 0) > 0) {
      alerts++
      // 当天首次出现的 CRITICAL 指标推送到已启用的通知渠道；尽力而为。
      try {
        await dispatchChannelAlert(c, {
          title: `监控告警：${(m as any).label || m.key}`,
          message: `指标 ${m.key} 触发 CRITICAL${(m as any).detail ? `：${(m as any).detail}` : ''}。请打开 /admin/monitoring 查看。`,
          url: new URL('/admin/monitoring', c.req.url).toString(),
        })
      } catch (error: any) {
        console.error('monitoring alert dispatch failed:', error?.message || error)
      }
    }
  }
  return { metrics: metrics.length, alerts }
}

export async function updateOrderStatus(c: Context, orderId: string, status: string): Promise<void> {
  const db = getDB(c);
  const mapping: Record<string, { order: string, payment: string, rental: string }> = {
    pending_approval: { order: 'PENDING', payment: 'UNPAID', rental: 'PENDING' },
    approved: { order: 'AWAITING_PAYMENT', payment: 'UNPAID', rental: 'AWAITING_PAYMENT' },
    pending_payment: { order: 'AWAITING_PAYMENT', payment: 'UNPAID', rental: 'PENDING' },
    awaiting_signature: { order: 'AWAITING_SIGNATURE', payment: 'UNPAID', rental: 'AWAITING_SIGNATURE' },
    paid: { order: 'CONFIRMED', payment: 'PAID', rental: 'READY_FOR_PICKUP' },
    pending_pickup: { order: 'READY_FOR_PICKUP', payment: 'PAID', rental: 'READY_FOR_PICKUP' },
    active: { order: 'ACTIVE', payment: 'PAID', rental: 'ACTIVE' },
    extended: { order: 'EXTENDED', payment: 'PAID', rental: 'EXTENDED' },
    overdue: { order: 'OVERDUE', payment: 'PAID', rental: 'OVERDUE' },
    suspended: { order: 'SUSPENDED', payment: 'PAID', rental: 'SUSPENDED' },
    pending_return: { order: 'RETURN_PENDING', payment: 'PAID', rental: 'RETURN_PENDING' },
    returned: { order: 'RETURNED', payment: 'PAID', rental: 'RETURNED' },
    completed: { order: 'COMPLETED', payment: 'PAID', rental: 'COMPLETED' },
    cancelled: { order: 'CANCELLED', payment: 'PAYMENT_FAILED', rental: 'CANCELLED' },
  }
  const next = mapping[status] || { order: status.toUpperCase(), payment: 'UNPAID', rental: status.toUpperCase() }
  const previous = await db.prepare('SELECT deviceId, rental_status, deposit_status, depositAmount FROM orders WHERE id = ?').bind(orderId).first() as any
  await db.prepare('UPDATE orders SET status = ?, order_status = ?, payment_status = ?, rental_status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(status, next.order, next.payment, next.rental, orderId).run();
  if (next.payment === 'PAID' && Number(previous?.depositAmount || 0) > 0 && ['PENDING', 'PAID'].includes(String(previous?.deposit_status || 'PENDING'))) {
    await db.prepare("UPDATE orders SET deposit_status = 'HELD', deposit_paid_at = COALESCE(deposit_paid_at, CURRENT_TIMESTAMP), deposit_held_amount = depositAmount WHERE id = ?").bind(orderId).run()
  }
  if (previous && previous.rental_status !== next.rental) {
    await db.prepare('INSERT INTO rental_status_history (id, rental_id, old_status, new_status, trigger_type, reason) VALUES (?, ?, ?, ?, ?, ?)').bind(`rsh-${nanoid(16)}`, orderId, previous.rental_status || null, next.rental, 'SYSTEM', '订单状态同步').run()
  }
  const lifecycleByOrderStatus: Partial<Record<string, DeviceLifecycleStatus>> = { paid: 'RESERVED', pending_pickup: 'RESERVED', active: 'RENTED', extended: 'RENTED', overdue: 'RENTED', suspended: 'RENTED', pending_return: 'INSPECTION' }
  const lifecycleStatus = lifecycleByOrderStatus[status]
  if (previous?.deviceId && lifecycleStatus) await recordDeviceLifecycle(c, previous.deviceId, lifecycleStatus, { orderId, reason: `订单状态：${status}` })
  await syncReferralOrderState(c, orderId, next.rental)
  if (status === 'cancelled') {
    // Dynamic import avoids a static circular dependency (actions/coupons.ts imports
    // recordFinancialLedgerEntry from this file).
    const { releaseCouponForOrder } = await import('./actions/coupons')
    await releaseCouponForOrder(c, orderId)
  }
}

// ---------------------------------------------------------------------------
// 通用 Webhook 幂等 (TODO.md P7 / 完善.md)
//
// Stripe、设备回调、未来第三方服务共用一张 webhook_events：provider + event_id
// 唯一，保证同一事件只产生一次业务副作用，并可安全重试。
// ---------------------------------------------------------------------------

export type WebhookClaim =
  | { firstDelivery: true; recordId: string }
  | { firstDelivery: false; status: 'RECEIVED' | 'PROCESSED' | 'FAILED'; recordId: string }

// 记录一次 webhook 投递。首次投递写入 RECEIVED 并返回 firstDelivery=true；
// 重复投递返回既有记录的状态（并累加 attempts），调用方据此决定跳过或重跑。
export async function claimWebhookEvent(
  c: Context,
  input: { provider: string; eventId: string; eventType?: string; payloadHash?: string },
): Promise<WebhookClaim> {
  const db = getDB(c)
  const id = `wh-${nanoid(16)}`
  const inserted = await db.prepare(
    `INSERT INTO webhook_events (id, provider, event_id, event_type, payload_hash, status)
     VALUES (?, ?, ?, ?, ?, 'RECEIVED')
     ON CONFLICT(provider, event_id) DO NOTHING`,
  ).bind(id, input.provider, input.eventId, input.eventType ?? null, input.payloadHash ?? null).run() as any
  if (Number(inserted.meta?.changes ?? inserted.changes ?? 0) > 0) {
    return { firstDelivery: true, recordId: id }
  }
  const existing = await db.prepare(
    'SELECT id, status FROM webhook_events WHERE provider = ? AND event_id = ?',
  ).bind(input.provider, input.eventId).first() as any
  await db.prepare(
    'UPDATE webhook_events SET attempts = attempts + 1 WHERE provider = ? AND event_id = ?',
  ).bind(input.provider, input.eventId).run()
  return { firstDelivery: false, status: String(existing?.status || 'RECEIVED') as any, recordId: String(existing?.id || '') }
}

export async function markWebhookProcessed(c: Context, recordId: string): Promise<void> {
  await getDB(c).prepare(
    "UPDATE webhook_events SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP, failure_reason = NULL WHERE id = ?",
  ).bind(recordId).run()
}

export async function markWebhookFailed(c: Context, recordId: string, reason: string): Promise<void> {
  await getDB(c).prepare(
    "UPDATE webhook_events SET status = 'FAILED', failure_reason = ? WHERE id = ?",
  ).bind(String(reason || '').slice(0, 500), recordId).run()
}


// D1 包装：读取订单相关行并跑纯对账。
export async function reconcileOrderPayments(c: Context, orderId: string): Promise<ReconResult> {
  const db = getDB(c)
  const [payments, refunds] = await Promise.all([
    db.prepare('SELECT id, amount, status FROM payments WHERE rental_id = ?').bind(orderId).all().then((r: any) => (r.results || []) as any[]),
    db.prepare('SELECT id, payment_id, refund_amount, status FROM payment_refunds WHERE order_id = ?').bind(orderId).all().then((r: any) => (r.results || []) as any[]),
  ])
  const paymentRows = payments as any[]
  const refundRows = refunds as any[]
  const paymentIds = paymentRows.map((p: any) => p.id)
  const inClause = paymentIds.map(() => '?').join(',') || "''"
  const [paymentAllocations, refundAllocations] = await Promise.all([
    paymentIds.length ? db.prepare(`SELECT payment_id, amount FROM payment_allocations WHERE payment_id IN (${inClause})`).bind(...paymentIds).all().then((r: any) => (r.results || []) as any[]) : Promise.resolve([] as any[]),
    refundRows.length ? db.prepare(`SELECT refund_id, payment_id, amount FROM refund_allocations WHERE refund_id IN (${refundRows.map(() => '?').join(',')})`).bind(...refundRows.map((r: any) => r.id)).all().then((r: any) => (r.results || []) as any[]) : Promise.resolve([] as any[]),
  ])
  return evaluatePaymentReconciliation({ payments: paymentRows, paymentAllocations, refunds: refundRows, refundAllocations })
}

// Compatibility aliases expected by legacy code
// 定期清理过期和已取消的合同
export async function cleanupExpiredAndCancelledContracts(c: Context): Promise<number> {
  const db = getDB(c)
  const now = new Date().toISOString()

  // 删除条件：
  // 1. 已过期且未签署的合同 (status = 'pending_sign' 且 signExpiresAt < 当前时间)
  // 2. 已被取消的合同，且取消时间超过7天 (status = 'cancelled' 且 updatedAt < 7天前)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  try {
    const expiredResult = await db.prepare(`
      UPDATE contracts SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE status = 'pending_sign' AND (signExpiresAt < ? OR sign_expires_at < ?)
    `).bind(now, now).run()
    const deletedResult = await db.prepare(`
      DELETE FROM contracts WHERE status = 'cancelled' AND updatedAt < ?
    `).bind(sevenDaysAgoISO).run()

    const changedCount = Number(expiredResult.meta?.changes || 0) + Number(deletedResult.meta?.changes || 0)
    if (changedCount > 0) {
      await logError(c, 'INFO', `Updated or cleaned up ${changedCount} expired/cancelled contracts`)
    }
    return changedCount
  } catch (error) {
    await logError(c, 'ERROR', 'Failed to cleanup expired/cancelled contracts', error as Error)
    return 0
  }
}

export async function cleanupExpiredGuestAccounts(c: Context): Promise<number> {
  // 访客租期结束后先立即撤销登录权限并清除凭据；保留匿名业务记录，避免破坏合同/订单/付款外键。
  const expired = await c.env.RENT.prepare(`
    SELECT id FROM users
    WHERE account_type = 'guest' AND guest_expires_at IS NOT NULL
      AND date(guest_expires_at) < date('now')
  `).all() as any
  const ids = (expired.results || []).map((row: any) => String(row.id))
  if (!ids.length) return 0
  const placeholders = ids.map(() => '?').join(', ')
  await c.env.RENT.batch([
    c.env.RENT.prepare(`DELETE FROM auth_sessions WHERE user_id IN (${placeholders})`).bind(...ids),
    c.env.RENT.prepare(`UPDATE users SET account_type = 'deleted_guest', status = 'inactive', email = 'deleted-guest-' || id || '@invalid.local', phone = NULL, bsb = NULL, account_number = NULL, password_hash = 'disabled', password_salt = 'disabled', guest_order_id = NULL, guest_expires_at = NULL, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).bind(...ids),
  ])

  // 再保留 30 天后删除没有业务外键引用的访客用户行。
  // 仍被历史订单/付款引用的行保留为匿名墓碑，确保业务记录和外键完整。
  const purgeResult = await c.env.RENT.prepare(`
    DELETE FROM users
    WHERE account_type = 'deleted_guest'
      AND deleted_at IS NOT NULL
      AND datetime(deleted_at) < datetime('now', '-30 days')
      AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.userId = users.id)
      AND NOT EXISTS (SELECT 1 FROM payments WHERE payments.customer_id = users.id)
      AND NOT EXISTS (SELECT 1 FROM referral_rewards WHERE referral_rewards.customer_id = users.id)
      AND NOT EXISTS (SELECT 1 FROM referrals WHERE referrals.referrer_customer_id = users.id OR referrals.referee_customer_id = users.id)
      AND NOT EXISTS (SELECT 1 FROM addresses WHERE addresses.user_id = users.id)
  `).run() as any
  return ids.length + Number(purgeResult.meta?.changes ?? purgeResult.changes ?? 0)
}

// 每次 loadSystemSettingsFromDB 都要跑一次 D1 查询 + 对约 10 个富文本字段做
// sanitize-html（CPU 密集，整体 ~500ms）。设置极少变化，用 isolate 级短 TTL 缓存把
// 连续调用（设备端轮询、各页面渲染）挡在重复计算之前。updateSystemSettings 会失效它。
const SYSTEM_SETTINGS_CACHE_TTL_MS = 30_000
let systemSettingsLoadedAt = 0

export function invalidateSystemSettingsCache(): void {
  systemSettingsLoadedAt = 0
}

export async function loadSystemSettingsFromDB(c: Context): Promise<typeof systemSettings> {
  if (systemSettingsLoadedAt && Date.now() - systemSettingsLoadedAt < SYSTEM_SETTINGS_CACHE_TTL_MS) {
    return systemSettings
  }
  const db = getDB(c)
  const rows = await db.prepare('SELECT key, value FROM systemSettings').all() as any
  systemSettingsLoadedAt = Date.now()
  const values = new Map<SystemSettingsKey, string>((rows.results || []).map((row: any) => [row.key, row.value]))
  const userTermsValue = values.get('userTerms')
  const rentalTermsValue = values.get('rentalTerms')
  const serviceTermsValue = values.get('serviceTerms')
  const privacyPolicyValue = values.get('privacyPolicy')
  const softwareTermsValue = values.get('softwareTerms')
  const copyrightNoticeValue = values.get('copyrightNotice')
  const cookiePolicyValue = values.get('cookiePolicy')
  const complaintsPolicyValue = values.get('complaintsPolicy')
  const acceptableUsePolicyValue = values.get('acceptableUsePolicy')
  const consumerRightsValue = values.get('consumerRights')
  const priceStrategyValue = values.get('priceStrategy')
  const paymentMethodsValue = values.get('paymentMethods')
  const bankDetailsValue = values.get('bankDetails')
  const rmbPaymentValue = values.get('rmbPayment')
  const referralSettingsValue = values.get('referralSettings')
  const companyDetailsValue = values.get('companyDetails')
  const rentalRulesValue = values.get('rentalRules')
  const registrationSettingsValue = values.get('registrationSettings')
  const legalMetadataValue = values.get('legalMetadata')

  // Only update values that actually exist in the database AND are non-empty
  // to prevent overwriting database-backed content with empty defaults or null values
  if (String(userTermsValue || '').trim()) systemSettings.userTerms = sanitizeRichHtml(userTermsValue)
  if (String(rentalTermsValue || '').trim()) systemSettings.rentalTerms = sanitizeRichHtml(rentalTermsValue)
  if (String(serviceTermsValue || '').trim()) systemSettings.serviceTerms = sanitizeRichHtml(serviceTermsValue)
  if (String(privacyPolicyValue || '').trim()) systemSettings.privacyPolicy = sanitizeRichHtml(privacyPolicyValue)
  if (String(softwareTermsValue || '').trim()) systemSettings.softwareTerms = sanitizeRichHtml(softwareTermsValue)
  if (String(copyrightNoticeValue || '').trim()) systemSettings.copyrightNotice = sanitizeRichHtml(copyrightNoticeValue)
  if (String(cookiePolicyValue || '').trim()) systemSettings.cookiePolicy = sanitizeRichHtml(cookiePolicyValue)
  if (String(complaintsPolicyValue || '').trim()) systemSettings.complaintsPolicy = sanitizeRichHtml(complaintsPolicyValue)
  if (String(acceptableUsePolicyValue || '').trim()) systemSettings.acceptableUsePolicy = sanitizeRichHtml(acceptableUsePolicyValue)
  if (String(consumerRightsValue || '').trim()) systemSettings.consumerRights = sanitizeRichHtml(consumerRightsValue)
  const parsedLegalMetadata = safeJsonParse<any>(legalMetadataValue)
  if (parsedLegalMetadata) systemSettings.legalMetadata = { ...systemSettings.legalMetadata, ...parsedLegalMetadata }
  if (String(priceStrategyValue || '').trim()) systemSettings.priceStrategy = String(priceStrategyValue)

  const parsedPaymentMethods = safeJsonParse<typeof systemSettings.paymentMethods>(paymentMethodsValue)
  const parsedBankDetails = safeJsonParse<typeof systemSettings.bankDetails>(bankDetailsValue)
  const parsedRmbPayment = safeJsonParse<typeof systemSettings.rmbPayment>(rmbPaymentValue)
  const parsedReferralSettings = safeJsonParse<typeof systemSettings.referralSettings>(referralSettingsValue)
  const parsedCompanyDetails = safeJsonParse<typeof systemSettings.companyDetails>(companyDetailsValue)
  const parsedRentalRules = safeJsonParse<typeof systemSettings.rentalRules>(rentalRulesValue)
  const parsedRegistrationSettings = safeJsonParse<typeof systemSettings.registrationSettings>(registrationSettingsValue)

  if (parsedPaymentMethods) {
    systemSettings.paymentMethods = {
      stripe: Boolean((parsedPaymentMethods as any).stripe ?? (parsedPaymentMethods as any).square),
      bankTransfer: Boolean((parsedPaymentMethods as any).bankTransfer),
      balancePayment: (parsedPaymentMethods as any).balancePayment === undefined
        ? systemSettings.paymentMethods.balancePayment
        : Boolean((parsedPaymentMethods as any).balancePayment),
      processingFeeRate: Math.min(1, Math.max(0, Number((parsedPaymentMethods as any).processingFeeRate ?? systemSettings.paymentMethods.processingFeeRate ?? 0.025))),
      alipay: Boolean((parsedPaymentMethods as any).alipay),
      wechat: Boolean((parsedPaymentMethods as any).wechat),
    }
  }
  // Older deployments stored bank details without bankName. Keep the current
  // shape when loading those rows so all bank fields remain available to the UI.
  if (parsedBankDetails) systemSettings.bankDetails = { ...systemSettings.bankDetails, ...parsedBankDetails }
  if (parsedRmbPayment) systemSettings.rmbPayment = { ...systemSettings.rmbPayment, ...parsedRmbPayment }
  if (parsedReferralSettings) systemSettings.referralSettings = parsedReferralSettings
  if (parsedCompanyDetails) systemSettings.companyDetails = { ...systemSettings.companyDetails, ...parsedCompanyDetails }
  if (parsedRentalRules) systemSettings.rentalRules = { ...systemSettings.rentalRules, ...parsedRentalRules }
  if (parsedRegistrationSettings) systemSettings.registrationSettings = { ...systemSettings.registrationSettings, ...parsedRegistrationSettings }

  systemSettingsLoadedAt = Date.now()
  return systemSettings
}

export async function updateSystemSettings(c: Context, updates: Partial<typeof systemSettings>): Promise<typeof systemSettings> {
  Object.assign(systemSettings, updates)
  invalidateSystemSettingsCache()

  const db = getDB(c)

  const write = async (key: SystemSettingsKey, value: any) => {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await db.prepare(`
      INSERT INTO systemSettings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
    `).bind(key, serialized).run()
    const saved = await db.prepare('SELECT value FROM systemSettings WHERE key = ?').bind(key).first() as any
    if (String(saved?.value ?? '') !== serialized) throw new Error(`系统设置保存校验失败：${key}`)
  }

  // Only write fields that were explicitly provided in the updates object
  // to prevent accidentally overwriting other fields with stale or default values
  const fieldsToWrite: Array<[SystemSettingsKey, any]> = [
    ['userTerms', systemSettings.userTerms],
    ['rentalTerms', systemSettings.rentalTerms],
    ['serviceTerms', systemSettings.serviceTerms],
    ['privacyPolicy', systemSettings.privacyPolicy],
    ['softwareTerms', systemSettings.softwareTerms],
    ['copyrightNotice', systemSettings.copyrightNotice],
    ['cookiePolicy', systemSettings.cookiePolicy],
    ['complaintsPolicy', systemSettings.complaintsPolicy],
    ['acceptableUsePolicy', systemSettings.acceptableUsePolicy],
    ['consumerRights', systemSettings.consumerRights],
    ['priceStrategy', systemSettings.priceStrategy],
    ['paymentMethods', systemSettings.paymentMethods],
    ['bankDetails', systemSettings.bankDetails],
    ['rmbPayment', systemSettings.rmbPayment],
    ['referralSettings', systemSettings.referralSettings],
    ['companyDetails', systemSettings.companyDetails],
    ['rentalRules', systemSettings.rentalRules],
    ['legalMetadata', systemSettings.legalMetadata],
    ['registrationSettings', systemSettings.registrationSettings],
  ]

  for (const [key, value] of fieldsToWrite) {
    if (key in updates) {
      // Prevent writing empty content for text fields that must have content
      const textContentFields = new Set(['userTerms', 'rentalTerms', 'serviceTerms', 'privacyPolicy', 'softwareTerms', 'copyrightNotice', 'cookiePolicy', 'complaintsPolicy', 'acceptableUsePolicy', 'consumerRights', 'priceStrategy'])
      if (textContentFields.has(key) && typeof value === 'string' && !String(value).trim()) {
        console.warn(`Skipping empty content for field: ${key}`)
        continue
      }
      await write(key, value)
    }
  }

  return systemSettings
}

export async function updateContractTemplateInDB(c: Context, newTemplate: { id: string; name: string; content: string }) {
  return updateContractTemplate(c, newTemplate)
}



function escapeContractValue(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

function maskContractValue(name: string, value: unknown): string {
  const text = String(value ?? '')
  if (!text) return ''
  if (name === 'customer_id_number') return text.length <= 4 ? '****' : `${text.slice(0, 2)}${'*'.repeat(Math.max(2, text.length - 4))}${text.slice(-2)}`
  if (name === 'customer_dob') return '****-**-**'
  if (name === 'customer_address') return text.length > 8 ? `${text.slice(0, 8)}****` : '****'
  if (name === 'esign_ip') return text.includes(':') ? `${text.split(':').slice(0, 2).join(':')}:****` : `${text.split('.').slice(0, 2).join('.')}.*.*`
  return text
}

export const CONTRACT_VARIABLE_NAMES = [
  'contract_number', 'agreement_version', 'contract_status', 'created_time', 'updated_time', 'jurisdiction',
  'company_name', 'company_abn', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_logo',
  'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_dob', 'customer_country', 'customer_id_type', 'customer_id_number', 'customer_driver_expiry', 'emergency_contact', 'emergency_phone',
  'device_id', 'asset_tag', 'device_name', 'device_brand', 'device_model', 'device_cpu', 'device_ram', 'device_storage', 'device_gpu', 'device_os', 'device_sn', 'charger_sn', 'battery_health', 'battery_cycles', 'device_condition', 'device_accessories',
  'start_date', 'end_date', 'rental_days', 'pickup_location', 'return_location', 'delivery_method', 'delivery_fee', 'return_method', 'return_date', 'return_status',
  'currency', 'daily_rate', 'subtotal', 'gst_included', 'gst_amount', 'discount', 'coupon_code', 'total_rent', 'deposit_amount', 'deposit_paid', 'rent_paid', 'amount_due', 'payment_method', 'payment_date', 'payment_reference',
  'bank_name', 'account_name', 'bank_bsb', 'bank_account',
  'late_days', 'late_fee_per_day', 'late_fee',
  'inspection_date', 'inspection_by', 'screen_condition', 'keyboard_condition', 'trackpad_condition', 'body_condition', 'camera_condition', 'wifi_condition', 'power_test', 'inspection_notes',
  'damage_description', 'damage_photos', 'repair_cost', 'replacement_cost', 'deduction_amount', 'repair_invoice',
  'deposit_refund', 'refund_amount', 'refund_date',
  'signer_name', 'sign_time', 'esign_signature', 'company_signature', 'esign_ip', 'esign_device', 'esign_browser', 'esign_os',
  'company_representative', 'customer_initials', 'insurance_selected', 'insurance_fee',
  'pickup_time', 'return_time', 'accessories_returned', 'customer_acknowledgement',
  'created_by', 'approved_by', 'notes', 'qr_code', 'contract_url', 'invoice_number', 'invoice_url',
] as const

export const CONTRACT_VARIABLE_GROUPS = [
  ['合同', ['contract_number', 'agreement_version', 'contract_status', 'created_time', 'updated_time', 'jurisdiction']],
  ['公司', ['company_name', 'company_abn', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_logo']],
  ['客户', ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_dob', 'customer_country', 'customer_id_type', 'customer_id_number', 'customer_driver_expiry', 'emergency_contact', 'emergency_phone']],
  ['设备', ['device_id', 'asset_tag', 'device_name', 'device_brand', 'device_model', 'device_cpu', 'device_ram', 'device_storage', 'device_gpu', 'device_os', 'device_sn', 'charger_sn', 'battery_health', 'battery_cycles', 'device_condition', 'device_accessories']],
  ['租赁', ['start_date', 'end_date', 'rental_days', 'pickup_location', 'return_location', 'delivery_method', 'delivery_fee', 'return_method', 'return_date', 'return_status']],
  ['付款', ['currency', 'daily_rate', 'subtotal', 'gst_included', 'gst_amount', 'discount', 'coupon_code', 'total_rent', 'deposit_amount', 'deposit_paid', 'rent_paid', 'amount_due', 'payment_method', 'payment_date', 'payment_reference']],
  ['银行', ['bank_name', 'account_name', 'bank_bsb', 'bank_account']],
  ['逾期归还', ['late_days', 'late_fee_per_day', 'late_fee']],
  ['验机', ['inspection_date', 'inspection_by', 'screen_condition', 'keyboard_condition', 'trackpad_condition', 'body_condition', 'camera_condition', 'wifi_condition', 'power_test', 'inspection_notes']],
  ['损坏', ['damage_description', 'damage_photos', 'repair_cost', 'replacement_cost', 'deduction_amount', 'repair_invoice']],
  ['退款', ['deposit_refund', 'refund_amount', 'refund_date']],
  ['电子签名', ['signer_name', 'sign_time', 'esign_signature', 'company_signature', 'esign_ip', 'esign_device', 'esign_browser', 'esign_os']],
  ['代表与确认', ['company_representative', 'customer_initials']],
  ['保险', ['insurance_selected', 'insurance_fee']],
  ['取还时间', ['pickup_time', 'return_time', 'accessories_returned', 'customer_acknowledgement']],
  ['系统', ['created_by', 'approved_by', 'notes', 'qr_code', 'contract_url', 'invoice_number', 'invoice_url']],
] as const

// 证件号码在任何非本人视图里默认脱敏；只有 MANAGER/ADMIN 主动“显示完整证件”
// （经 sensitive_data_access_logs + 审计）或客户查看本人合同时才展示完整值。
// 完善.md — 普通 STAFF 不得查看完整证件号码。
export const SENSITIVE_CONTRACT_FIELDS = new Set(['customer_id_number'])

export async function logSensitiveDataAccess(
  c: Context,
  input: { actorId: string; targetUserId: string; field: string; purpose: string },
): Promise<void> {
  await getDB(c).prepare(
    'INSERT INTO sensitive_data_access_logs (id, actor_id, target_user_id, field_name, purpose) VALUES (?, ?, ?, ?, ?)',
  ).bind(`sda-${nanoid(14)}`, input.actorId, input.targetUserId, input.field, String(input.purpose || '').slice(0, 200)).run()
}

export function renderContractVariables(content: string, contract: Contract, order?: any, device?: any, customer?: any, extra: Record<string, unknown> = {}, includeInternal = false, revealSensitive = false): string {
  const rentOnly = Math.max(0, Number(order?.totalAmount ?? order?.total_amount ?? 0) - Number(order?.depositAmount ?? order?.deposit_amount ?? 0))
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const creatorName = String(extra.created_by || stored.created_by || '').trim()
  const emptyVariables = Object.fromEntries(CONTRACT_VARIABLE_NAMES.map(name => [name, '']))
  const values: Record<string, unknown> = {
    ...emptyVariables,
    ...stored,
    ...extra,
    contract_number: contract.contractNumber,
    order_no: order?.orderNo ?? order?.order_no,
    agreement_version: stored.agreement_version || '1.0',
    jurisdiction: stored.jurisdiction || 'VIC',
    company_name: systemSettings.companyDetails.name,
    company_address: systemSettings.companyDetails.address,
    company_phone: systemSettings.companyDetails.phone,
    company_email: systemSettings.companyDetails.email,
    company_contact: systemSettings.companyDetails.contact,
    company_website: systemSettings.companyDetails.website,
    company_logo: systemSettings.companyDetails.logo,
    customer_name: customer?.name,
    customer_phone: customer?.phone,
    customer_email: customer?.email,
    customer_address: stored.customer_address || customer?.address,
    customer_dob: stored.customer_dob || customer?.dob,
    customer_country: stored.customer_country || customer?.country,
    customer_id_type: stored.customer_id_type || contract.customer_id_type,
    customer_id_number: stored.customer_id_number || contract.customer_id_number,
    device_name: device?.name ?? order?.deviceName,
    device_brand: device?.brand,
    device_model: device?.model,
    device_cpu: device?.cpu,
    device_ram: device?.ram,
    device_storage: device?.storage,
    device_gpu: device?.gpu,
    device_os: device?.os,
    device_sn: device?.serialNumber ?? device?.serial_number,
    asset_tag: device?.assetTag ?? device?.asset_tag,
    charger_sn: stored.charger_sn || device?.chargerSn || device?.charger_sn,
    battery_health: stored.battery_health || device?.batteryHealth || device?.battery_health,
    battery_cycles: stored.battery_cycles || device?.batteryCycles || device?.battery_cycles,
    device_condition: stored.device_condition || contract.device_condition,
    device_accessories: stored.device_accessories || contract.device_accessories,
    start_date: order?.startDate ?? order?.start_date,
    end_date: order?.endDate ?? order?.end_date,
    rental_days: order?.rentalPeriod ?? order?.rental_period,
    daily_rate: Number(order?.dailyRate ?? order?.daily_rate ?? device?.pricePerDay ?? 0).toFixed(2),
    total_rent: rentOnly.toFixed(2),
    deposit_amount: Number(order?.depositAmount ?? order?.deposit_amount ?? 0).toFixed(2),
    late_fee_per_day: Number(stored.late_fee_per_day ?? contract.late_fee_per_day ?? 0).toFixed(2),
    repair_cost: stored.repair_cost ?? (contract.repair_cost == null ? '' : Number(contract.repair_cost).toFixed(2)),
    pickup_location: stored.pickup_location || contract.pickup_location,
    return_location: stored.return_location || contract.return_location,
    payment_method: order?.paymentMethod ?? order?.payment_method,
    bank_name: systemSettings.bankDetails.bankName,
    bank_bsb: systemSettings.bankDetails.bsb,
    bank_account: systemSettings.bankDetails.account,
    account_name: systemSettings.bankDetails.accountName,
    company_abn: systemSettings.companyDetails.abn,
    gst_included: systemSettings.companyDetails.gstIncluded ? '是' : '否',
    company_signature: creatorName,
    signer_name: stored.signer_name || customer?.name,
    sign_time: formatMelbourneDateTime(contract.signedAt),
    esign_ip: contract.esign_ip,
    esign_device: contract.esign_device,
    device_id: device?.id ?? order?.deviceId ?? order?.device_id,
    currency: 'AUD',
    created_time: contract.createdAt ?? (contract as any).created_at,
    updated_time: (contract as any).updatedAt ?? (contract as any).updated_at,
    contract_status: contract.status,
    refund_policy_version: stored.refund_policy_version || systemSettings.legalMetadata.copyright.version,
    last_updated_date: stored.last_updated_date || systemSettings.legalMetadata.copyright.lastUpdatedDate,
    rental_agreement_version: stored.rental_agreement_version || systemSettings.legalMetadata.rental.version,
    rental_agreement_last_updated_date: stored.rental_agreement_last_updated_date || systemSettings.legalMetadata.rental.lastUpdatedDate,
    contract_version: systemSettings.legalMetadata.contract.version,
    contract_last_updated_date: systemSettings.legalMetadata.contract.lastUpdatedDate,
    company_representative: creatorName,
    contract_url: stored.contract_url || `/contract/view/${contract.id}`,
    invoice_url: stored.invoice_url || (order?.id ? `/orders/${order.id}/invoice` : ''),
    deleted: contract.deleted_at ? '是' : '否',
  }
  if (!includeInternal) values.deleted = ''
  const filled = Object.entries(values).reduce((result, [name, value]) => {
    const signature = name === 'esign_signature' || name === 'company_signature'
    const raw = String(value ?? '')
    const forceMaskSensitive = SENSITIVE_CONTRACT_FIELDS.has(name) && !revealSensitive
    const safe = signature && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raw)
      ? `<img src="${raw}" alt="电子签名" style="max-width:280px;max-height:100px;object-fit:contain">`
      : escapeContractValue(forceMaskSensitive || !includeInternal ? maskContractValue(name, value) : value)
    return result.replace(new RegExp(`\\$\\{${name}\\}|\\{${name}\\}`, 'g'), safe)
  }, String(content || ''))
  return renderFlexibleContent(filled)
}

export const CONTRACT_OPERATIONAL_FIELDS = [
  ['refund_policy_version', '退款政策版本'], ['last_updated_date', '协议最后更新日期'],
  ['rental_agreement_version', '租赁协议版本'], ['rental_agreement_last_updated_date', '租赁协议最后更新日期'],
  ['contract_version', '正式合同版本'], ['contract_last_updated_date', '正式合同最后更新日期'],
  ['agreement_version', '合同版本'], ['jurisdiction', '司法管辖区'],
  ['customer_address', '客户地址'], ['customer_dob', '客户出生日期'], ['customer_country', '客户国家'], ['customer_id_type', '证件类型'], ['customer_id_number', '证件号码'], ['customer_driver_expiry', '驾照到期日'], ['emergency_contact', '紧急联系人'], ['emergency_phone', '紧急联系电话'],
  ['invoice_number', '发票编号'], ['delivery_method', '配送方式（Pickup / Delivery）'], ['delivery_fee', '配送费'], ['return_method', '归还方式（CourierPickup / StoreReturn）'], ['pickup_location', '取货地点'], ['return_location', '归还地点'], ['pickup_time', '取货时间'], ['return_time', '归还时间'],
  ['return_status', '归还状态'], ['return_date', '实际归还日期'], ['inspection_date', '检查日期'], ['inspection_by', '检查员工'],
  ['device_brand', '设备品牌'], ['device_cpu', 'CPU'], ['device_ram', '内存'], ['device_storage', '存储'], ['device_gpu', '显卡'], ['device_os', '设备操作系统'],
  ['battery_health', '电池健康'], ['charger_sn', '充电器 SN'], ['asset_tag', '公司资产编号'], ['device_condition', '设备状况'], ['device_accessories', '交付配件'],
  ['esign_signature', '客户电子签名'], ['company_signature', '公司电子签名'], ['esign_location', '签约 GPS 位置'], ['esign_browser', '签约浏览器'], ['esign_os', '签约操作系统'], ['company_representative', '公司代表'], ['customer_initials', '客户姓名首字母'],
  ['discount', '优惠金额'], ['coupon_code', '优惠码'],
  ['damage_description', '损坏说明'], ['damage_photos', '损坏照片 URL'], ['repair_invoice', '维修发票'], ['replacement_cost', '更换费用'], ['repair_cost', '维修费用'],
  ['collection_required', '是否需要追回'], ['collection_date', '回收日期'],
  ['screen_condition', '屏幕状况'], ['keyboard_condition', '键盘状况'], ['trackpad_condition', '触控板状况'], ['body_condition', '外壳状况'], ['camera_condition', '摄像头状况'], ['wifi_condition', 'WiFi 状况'], ['battery_cycles', '电池循环次数'], ['power_test', '开机测试'], ['inspection_notes', '验机备注'], ['accessories_returned', '已归还配件'], ['customer_acknowledgement', '客户确认'],
  ['approved_by', '审批员工'], ['notes', '内部备注'], ['qr_code', '合同二维码图片 URL'],
  ['insurance_selected', '是否选择保险'], ['insurance_fee', '保险费用'], ['insurance_provider', '保险公司'], ['waiver_signed', '是否签署免责'], ['privacy_version', '隐私政策版本'],
] as const

export const CONTRACT_COMPUTED_FIELDS = [
  ['device_id', '系统内部设备 ID'], ['currency', '币种'], ['deposit_paid', '已支付押金'], ['rent_paid', '已支付租金'], ['amount_due', '剩余应付款'], ['payment_date', '付款日期'], ['payment_reference', '银行 Reference'],
  ['subtotal', '小计'], ['gst_amount', 'GST 金额'], ['refund_amount', '退款金额'], ['deposit_refund', '押金退款'], ['refund_date', '退款日期'], ['deduction_amount', '押金扣除金额'],
  ['late_days', '逾期天数'], ['late_fee', '逾期费用'], ['created_by', '创建员工'], ['created_time', '创建时间'], ['updated_time', '更新时间'], ['contract_status', '合同状态'], ['deleted', '是否删除'],
] as const

export const CONTRACT_SIGNED_FIELDS = new Set([
  'signer_name', 'customer_initials', 'esign_signature', 'company_signature', 'esign_location', 'esign_browser', 'esign_os', 'agreement_version',
])

export async function getContractVariableData(c: Context, contract: Contract, order: any): Promise<Record<string, unknown>> {
  const stored = typeof contract.contract_data === 'string' ? (safeJsonParse<Record<string, unknown>>(contract.contract_data) || {}) : (contract.contract_data || {})
  const [payments, reference, refund, creator] = await Promise.all([
    c.env.RENT.prepare("SELECT COALESCE(SUM(amount),0) paid, COALESCE(SUM(deposit_amount),0) deposit_paid, COALESCE(SUM(rental_amount),0) rent_paid, MAX(paid_at) payment_date, MAX(currency) currency FROM payments WHERE rental_id = ? AND status = 'paid'").bind(order.id).first(),
    c.env.RENT.prepare("SELECT pp.reference_number FROM payment_proofs pp JOIN payments p ON p.id = pp.payment_id WHERE p.rental_id = ? ORDER BY pp.created_at DESC LIMIT 1").bind(order.id).first(),
    c.env.RENT.prepare("SELECT type, refund_amount, deduction_amount, created_at FROM payment_refunds WHERE order_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1").bind(order.id).first(),
    (contract.createdBy || contract.created_by) ? getUserById(c, contract.createdBy || contract.created_by || '') : Promise.resolve(null),
  ]) as any[]
  const invoice = await c.env.RENT.prepare("SELECT invoice_number FROM invoices WHERE order_id = ? AND type = 'invoice' ORDER BY issued_at DESC LIMIT 1").bind(order.id).first() as any
  const publicOrigin = new URL(c.req.url).origin
  const paid = Number(payments?.paid || 0)
  const deposit = Number(order.depositAmount ?? order.deposit_amount ?? 0)
  const total = Number(order.totalAmount ?? order.total_amount ?? 0)
  const discount = Number(stored.discount || 0)
  const deliveryFee = Number(stored.delivery_fee || 0)
  const rentSubtotal = Math.max(0, total - deposit - deliveryFee + discount)
  const returnDate = stored.return_date ? new Date(String(stored.return_date)) : null
  const dueDate = new Date(order.endDate ?? order.end_date)
  const lateDays = returnDate && returnDate > dueDate ? Math.ceil((returnDate.getTime() - dueDate.getTime()) / 86400000) : 0
  const returnStatus = stored.damage_description ? 'Damaged' : stored.return_date ? (lateDays > 0 ? 'Overdue' : 'Returned') : (order.status === 'completed' ? 'Returned' : '')
  return {
    ...stored,
    invoice_number: invoice?.invoice_number || stored.invoice_number || generateReferenceNumber('INV'),
    currency: payments?.currency || 'AUD',
    deposit_paid: Number(payments?.deposit_paid || 0).toFixed(2),
    rent_paid: Number(payments?.rent_paid || 0).toFixed(2),
    amount_due: Math.max(0, total - paid).toFixed(2),
    payment_date: payments?.payment_date || '',
    payment_reference: reference?.reference_number || '',
    subtotal: rentSubtotal.toFixed(2),
    gst_amount: systemSettings.companyDetails.gstIncluded ? (rentSubtotal / 11).toFixed(2) : '0.00',
    refund_amount: Number(refund?.refund_amount || 0).toFixed(2),
    deposit_refund: Number(refund?.type === 'deposit' ? refund.refund_amount : 0).toFixed(2),
    refund_date: refund?.created_at || '',
    deduction_amount: Number(refund?.deduction_amount || 0).toFixed(2),
    late_days: lateDays,
    late_fee: (lateDays * Number(contract.late_fee_per_day || 0)).toFixed(2),
    return_status: returnStatus,
    created_by: creator?.name || contract.createdBy || '',
    contract_url: `/contract/view/${contract.id}`,
    invoice_url: new URL(`/orders/${order.id}/invoice`, publicOrigin).toString(),
  }
}

export const DEFAULT_CONTRACT_TEMPLATE_HTML = `<h1>设备租赁合同</h1>
<p>合同编号：<strong>{contract_number}</strong>　合同版本：{contract_version}　最后更新：{contract_last_updated_date}</p>
<p>生成时间：{created_time}　签署时间：<strong>{sign_time}</strong>　管辖地：{jurisdiction}</p>
<p>本设备租赁合同（下称「本合同」）由下列双方签署，构成具有法律约束力的租赁（bailment）合同。承租方以电子方式签署，即表示已阅读、理解并接受本合同全部条款。</p>

<h2>一、双方当事人</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0;">
  <tr style="background:#f3f4f6;"><th style="border:1px solid #e5e7eb;padding:8px;text-align:left;width:22%;">出租方（甲方）</th><td style="border:1px solid #e5e7eb;padding:8px;">{company_name}（ABN {company_abn}）</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">地址</td><td style="border:1px solid #e5e7eb;padding:8px;">{company_address}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">联系方式</td><td style="border:1px solid #e5e7eb;padding:8px;">电话 {company_phone}　邮箱 {company_email}</td></tr>
  <tr style="background:#f3f4f6;"><th style="border:1px solid #e5e7eb;padding:8px;text-align:left;">承租方（乙方）</th><td style="border:1px solid #e5e7eb;padding:8px;">{customer_name}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">证件</td><td style="border:1px solid #e5e7eb;padding:8px;">{customer_id_type} {customer_id_number}　出生日期 {customer_dob}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">联系方式</td><td style="border:1px solid #e5e7eb;padding:8px;">电话 {customer_phone}　邮箱 {customer_email}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">联系地址</td><td style="border:1px solid #e5e7eb;padding:8px;">{customer_address}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">紧急联系人</td><td style="border:1px solid #e5e7eb;padding:8px;">{emergency_contact}　{emergency_phone}</td></tr>
</table>

<h2>二、租赁设备</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0;">
  <tr style="background:#f3f4f6;"><th style="border:1px solid #e5e7eb;padding:8px;text-align:left;width:22%;">设备名称</th><td style="border:1px solid #e5e7eb;padding:8px;">{device_name}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">品牌 / 型号</td><td style="border:1px solid #e5e7eb;padding:8px;">{device_brand} / {device_model}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">序列号 / 资产编号</td><td style="border:1px solid #e5e7eb;padding:8px;">{device_sn} / {asset_tag}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">配置</td><td style="border:1px solid #e5e7eb;padding:8px;">{device_cpu}　{device_ram}　{device_storage}　{device_gpu}　{device_os}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">电池健康</td><td style="border:1px solid #e5e7eb;padding:8px;">{battery_health}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">交付状况</td><td style="border:1px solid #e5e7eb;padding:8px;">{device_condition}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">随附配件</td><td style="border:1px solid #e5e7eb;padding:8px;">{device_accessories}</td></tr>
</table>
<p>设备在交付时处于可正常使用的状况。承租方应在取件时当场检查并确认上述信息；签署本合同即视为确认设备与描述相符。</p>

<h2>三、租期、交付与归还</h2>
<ul>
<li>租期：<strong>{start_date}</strong> 至 <strong>{end_date}</strong>，共 {rental_days} 天。</li>
<li>交付方式：{delivery_method}（配送费 {currency} {delivery_fee}）　取件地点：{pickup_location}</li>
<li>归还方式：{return_method}　归还地点：{return_location}　约定归还日：{return_date}</li>
<li>承租方应在租期届满时，以交付时的状况（正常损耗除外）连同全部配件归还设备。</li>
</ul>

<h2>四、费用与付款</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0;">
  <tr style="background:#f3f4f6;"><th style="border:1px solid #e5e7eb;padding:8px;text-align:left;width:40%;">项目</th><th style="border:1px solid #e5e7eb;padding:8px;text-align:left;">金额（{currency}）</th></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">日租金</td><td style="border:1px solid #e5e7eb;padding:8px;">{daily_rate}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">租金小计</td><td style="border:1px solid #e5e7eb;padding:8px;">{subtotal}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">优惠（{coupon_code}）</td><td style="border:1px solid #e5e7eb;padding:8px;">-{discount}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">保险（{insurance_selected}）</td><td style="border:1px solid #e5e7eb;padding:8px;">{insurance_fee}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">租金总额（含 GST：{gst_included}，其中 GST {gst_amount}）</td><td style="border:1px solid #e5e7eb;padding:8px;"><strong>{total_rent}</strong></td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">押金（security bond）</td><td style="border:1px solid #e5e7eb;padding:8px;"><strong>{deposit_amount}</strong></td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">已付租金 / 已付押金</td><td style="border:1px solid #e5e7eb;padding:8px;">{rent_paid} / {deposit_paid}</td></tr>
  <tr><td style="border:1px solid #e5e7eb;padding:8px;">应付余额</td><td style="border:1px solid #e5e7eb;padding:8px;"><strong>{amount_due}</strong></td></tr>
</table>
<p>付款方式：{payment_method}　付款日期：{payment_date}　付款参考号：{payment_reference}　税务发票编号：{invoice_number}</p>
<p>所有价格均以澳元（AUD）标示，并依据《澳大利亚消费者法》（Australian Consumer Law）第 48 条以含商品及服务税（GST）的单一价格显示。甲方依 1999 年《商品及服务税法》开具税务发票。</p>

<h2>五、押金</h2>
<p>押金用于担保承租方履行本合同，<strong>不是</strong>预付租金，也不作为惩罚性款项。设备归还并完成验机后，甲方将在 <strong>10 个营业日</strong>内退还可退部分。如需从押金中扣款，甲方将提供逐项说明及相应凭证（维修报价、照片或发票），扣款金额以实际、合理的费用为限，例如超出正常损耗的维修或更换费用、缺件、必要清洁费、逾期费。扣款受《澳大利亚消费者法》不公平合同条款制度约束。对扣款有异议的，按第十四条处理。</p>

<h2>六、所有权与使用限制</h2>
<ul>
<li>设备所有权始终归甲方所有。本合同为短期租赁，租期不超过 4 个月且承租方不享有购买设备的权利或义务，<strong>不构成</strong>《国家信贷法》（National Credit Code）下的「消费者租赁」或信贷合同。</li>
<li>承租方不得转租、转借、出售、质押设备，或将设备移出澳大利亚境外。</li>
<li>设备仅限合法用途；不得拆解、改装，不得移除资产标签或管理软件，不得越权刷写系统。</li>
<li>承租方应保持操作系统与安全更新为最新，妥善保管登录凭据。</li>
</ul>

<h2>七、风险、损坏与赔偿</h2>
<p>自交付时起至设备退还并经甲方确认接收时止，设备的丢失或损坏风险由承租方承担，<strong>正常损耗（fair wear and tear）除外</strong>。因承租方或其允许使用人造成的丢失或超出正常损耗的损坏，承租方应按实际维修费用赔偿；若无法修复，则按扣除折旧后的市场重置价值赔偿，二者取较低者。甲方将提供维修报价或重置价值的证明。承租方可自行投保以覆盖上述风险。</p>

<h2>八、逾期归还</h2>
<p>未按时归还的，按每日逾期费 {currency} {late_fee_per_day} 计收（作为对逾期占用造成损失的合理预估，而非罚金）。截至目前逾期 {late_days} 天，逾期费合计 {currency} {late_fee}。逾期费不影响甲方依法追偿其他损失或依第十二条取回设备。</p>

<h2>九、设备管理软件</h2>
<p>设备可能预装甲方的管理软件，用于上报设备状态、硬件信息与租期信息，并在符合<a href="/software-terms">《软件使用协议》</a>所列情形时执行锁定、重启或数据清除等远程操作。相关个人信息处理见<a href="/privacy">《隐私政策》</a>。数据清除将删除设备上的用户数据，承租方应自行提前备份。</p>

<h2>十、消费者保障</h2>
<p>本合同项下提供的商品与服务附带《澳大利亚消费者法》规定的消费者保障，包括设备须具有<strong>可接受的质量</strong>、与描述相符、适合告知的特定用途，服务须以合理的谨慎与技能提供。这些保障<strong>不能被排除、限制或修改</strong>。就重大失败，承租方有权解除本合同并要求退还相应款项，或就价值减损获得赔偿；就非重大失败，甲方将在合理时间内修理或更换。</p>

<h2>十一、责任限制</h2>
<p>在法律允许且不影响上述不可排除的消费者保障的前提下，甲方不对承租方的数据丢失、业务中断或其他间接或后果性损失负责；甲方可依法限制的责任，以重新提供服务或支付其合理费用为限，或以本合同项下已付租金总额为限。本合同中的任何内容均不排除或限制依法不能排除的责任。</p>

<h2>十二、违约与取回</h2>
<p>如承租方未支付到期款项、违反使用限制或存在欺诈，甲方可在发出合理书面通知并给予补救期后终止本合同。甲方仅可通过合法方式取回设备，不得进入住宅或采用胁迫手段。终止不影响已产生的付款义务。</p>

<h2>十三、不可抗力</h2>
<p>因超出一方合理控制的事件（如自然灾害、战争、罢工、电信或电力中断、政府行为）导致的履约迟延或不能，该方在受影响范围内不承担违约责任，但应尽快通知对方并努力减轻影响。</p>

<h2>十四、适用法律与争议解决</h2>
<p>本合同受澳大利亚 {jurisdiction} 州法律管辖，双方服从该州法院的非专属管辖。如发生争议，请先通过第一条所列方式联系甲方协商解决；承租方亦可向维多利亚州消费者事务局（Consumer Affairs Victoria）或澳大利亚竞争与消费者委员会（ACCC）寻求协助。</p>

<h2>十五、电子签名</h2>
<p>双方同意以电子方式订立与签署本合同。依据 1999 年《电子交易法》（Electronic Transactions Act 1999 (Cth)）及《2000 年电子交易（维多利亚）法》，电子签名与手写签名具有同等法律效力。系统记录的签署证据如下：</p>
<ul>
<li>签署时间：{sign_time}</li>
<li>签署 IP：{esign_ip}</li>
<li>签署设备：{esign_device}</li>
<li>浏览器 / 系统：{esign_browser} / {esign_os}</li>
</ul>

<h2>十六、其他条款</h2>
<p>本合同连同其引用的政策构成双方就本次设备租赁的完整约定，取代此前一切口头或书面沟通。对本合同的任何修改须经双方书面确认。若任何条款被认定无效或不可执行，不影响其余条款的效力。</p>

<h2>十七、银行账户</h2>
<p>开户行：{bank_name}　账户名：{account_name}　BSB：{bank_bsb}　账号：{bank_account}</p>

<h2>十八、双方签署</h2>
<table style="width:100%;border-collapse:collapse;margin:12px 0;">
  <tr style="background:#f3f4f6;"><th style="border:1px solid #e5e7eb;padding:8px;text-align:left;width:50%;">出租方（甲方）</th><th style="border:1px solid #e5e7eb;padding:8px;text-align:left;">承租方（乙方）</th></tr>
  <tr>
    <td style="border:1px solid #e5e7eb;padding:8px;">{company_name}<br>授权代表：{company_representative}<br>签章：{company_signature}<br>日期：{sign_time}</td>
    <td style="border:1px solid #e5e7eb;padding:8px;">{signer_name}<br>姓名首字母确认：{customer_initials}<br>签名：{esign_signature}<br>日期：{sign_time}</td>
  </tr>
</table>
<p>承租方确认：本人已阅读并理解本合同全部条款，确认所填资料真实准确，并同意受本合同约束。</p>`

export const contractTemplate = {
  id: 'tmpl-1',
  name: '标准租赁合同模板',
  content: DEFAULT_CONTRACT_TEMPLATE_HTML,
}

export async function getContractTemplate(c: Context): Promise<ContractTemplate> {
  const db = getDB(c);
  const template = await db.prepare('SELECT * FROM contract_templates WHERE id = ?').bind('default').first() as ContractTemplate | null
  if (template) {
    return { ...template, content: sanitizeRichHtml(template.content) };
  }
  // Fallback to a default in-memory template if not found in DB
  return {
    id: 'default',
    name: '标准租赁合同模板',
    content: DEFAULT_CONTRACT_TEMPLATE_HTML,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updateContractTemplate(c: Context, newTemplate: { id: string; name: string; content: string }): Promise<ContractTemplate> {
  const db = getDB(c);
  await db.prepare('INSERT INTO contract_templates (id, name, content, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name, content = EXCLUDED.content, updatedAt = EXCLUDED.updatedAt')
    .bind(newTemplate.id, String(newTemplate.name || '').slice(0, 100), sanitizeRichHtml(newTemplate.content))
    .run();
  return getContractTemplate(c);
}

function toNumber(value: any): number {
  if (value === undefined || value === null || value === '') return 0
  return Number(value)
}

export async function seedDatabaseIfEmpty(c: Context): Promise<void> {
  const db = getDB(c)

  const host = String(c.req.header('Host') || '').split(':')[0].toLowerCase()
  const demoEnvironment = String((c.env as any).SHOW_TEST_ACCOUNTS || '').toLowerCase() === 'true' && host === 'test-rent.ydnw6zt6vj.workers.dev'
  if (!demoEnvironment) return

  const countResult = await db.prepare('SELECT COUNT(*) AS count FROM users').all()
  const count = Number(countResult.results?.[0]?.count ?? 0)

  const usersToSeed = [
    { id: 'u-admin', name: 'Admin User', email: 'admin@example.com', password: 'Admin123', role: 'ADMIN', accountNumber: '00000000' },
    { id: 'u-staff', name: 'Staff User', email: 'staff@example.com', password: 'Staff123', role: 'STAFF', accountNumber: '00000001' },
    { id: 'u-customer', name: 'Customer User', email: 'customer@example.com', password: 'Customer123', role: 'CUSTOMER', accountNumber: '00000002' },
  ]

  // users 表字段：兼容 snake_case / camelCase（同时避免插入时引用不存在的列）
  const hasReferralCodeSnake = await userHasColumn(c, 'referral_code')
  const hasReferralCodeCamel = await userHasColumn(c, 'referralCode')
  const hasAccountNumberSnake = await userHasColumn(c, 'account_number')
  const hasAccountNumberCamel = await userHasColumn(c, 'accountNumber')
  const hasCommissionBalanceSnake = await userHasColumn(c, 'commission_balance')
  const hasCommissionBalanceCamel = await userHasColumn(c, 'commissionBalance')

  const hasPasswordHashSnake = await userHasColumn(c, 'password_hash')
  const hasPasswordHashCamel = await userHasColumn(c, 'passwordHash')

  const passwordHashCol = hasPasswordHashSnake ? 'password_hash' : 'passwordHash'
  const accountNumberCol = hasAccountNumberSnake ? 'account_number' : 'accountNumber'
  const commissionBalanceCol = hasCommissionBalanceSnake ? 'commission_balance' : 'commissionBalance'
  const referralCodeCol = hasReferralCodeSnake ? 'referral_code' : 'referralCode'

  const hasUsersTableCols = (arr: string[]) => arr.every((col) => {
    // 只在已确认列存在时才写入（避免不同库状态混乱）
    return true
  })

  // 仅在 users 已存在时也要“修正默认用户密码/字段”，否则会出现你现在看到的“账号或密码错误”
  const userUpserts: any[] = []
  for (const user of usersToSeed) {
    const hash = await hashPassword(user.password)

    const cols: string[] = ['id', 'name', 'email', 'role', 'status', 'balance', passwordHashCol]
    const vals: any[] = [user.id, user.name, user.email, user.role, 'active', 0, hash]

    if (hasAccountNumberSnake || hasAccountNumberCamel) {
      cols.push(accountNumberCol)
      vals.push(user.accountNumber)
    }
    if (hasCommissionBalanceSnake || hasCommissionBalanceCamel) {
      cols.push(commissionBalanceCol)
      vals.push(0)
    }
    if (hasReferralCodeSnake || hasReferralCodeCamel) {
      cols.push(referralCodeCol)
      vals.push(null)
    }

    const setParts: string[] = cols
      .filter((col) => col !== 'id')
      .map((col) => `${col} = EXCLUDED.${col}`)

    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${setParts.join(', ')}`
    userUpserts.push(db.prepare(sql).bind(...vals))
  }
  await db.batch(userUpserts)

  if (count > 0) return

  // Seed示例设备
  const devicesToSeed = [
    { id: 'd-mbp14', name: 'MacBook Pro 14寸', model: 'M4 Pro 18GB 512GB', serial_number: 'SN-MBP14-001', pricePerDay: 40.0, depositAmount: 2000.0, status: 'available', description: 'Apple M4 Pro芯片，18GB内存，512GB固态硬盘，14英寸Liquid Retina XDR显示屏' },
    { id: 'd-xps13', name: 'Dell XPS 13', model: 'Intel i7-1360P 16GB', serial_number: 'SN-XPS13-001', pricePerDay: 35.0, depositAmount: 1500.0, status: 'available', description: '第13代Intel酷睿i7处理器，16GB LPDDR5内存，512GB NVMe SSD' },
    { id: 'd-thinkpad', name: 'Lenovo ThinkPad X1 Carbon', model: 'i7-1365U 16GB', serial_number: 'SN-TPX1-001', pricePerDay: 38.0, depositAmount: 1800.0, status: 'rented', description: '13代Intel vPro i7，16GB内存，1TB SSD，14英寸2.8K OLED屏' },
    { id: 'd-imac', name: 'iMac 24寸', model: 'M3 8GB 256GB', serial_number: 'SN-IMAC24-001', pricePerDay: 45.0, depositAmount: 2200.0, status: 'maintenance', description: 'Apple M3芯片，8GB统一内存，256GB SSD，24英寸4.5K Retina显示屏' },
  ]

  const deviceInsert = db.prepare('INSERT INTO devices (id, name, model, serial_number, price_per_day, deposit_amount, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const deviceInserts = devicesToSeed.map(d =>
    deviceInsert.bind(
      d.id,
      d.name,
      d.model,
      d.serial_number,
      d.pricePerDay ?? 0,
      d.depositAmount ?? 0,
      d.status,
      d.description
    )
  )
  await db.batch(deviceInserts)

  // Seed示例订单
  const now = new Date().toISOString()
  const ordersToSeed = [
    {
      id: 'o-1', userId: 'u-customer', deviceId: 'd-thinkpad',
      startDate: '2026-07-10', endDate: '2026-08-10', rentalPeriod: 31,
      totalAmount: 1178.0, depositAmount: 1800.0, status: 'active', paymentMethod: 'bank_transfer'
    },
    {
      id: 'o-2', userId: 'u-customer', deviceId: 'd-mbp14',
      startDate: '2026-07-01', endDate: '2026-07-07', rentalPeriod: 7,
      totalAmount: 280.0, depositAmount: 2000.0, status: 'completed', paymentMethod: 'card'
    },
    {
      id: 'o-3', userId: 'u-customer', deviceId: 'd-xps13',
      startDate: '2026-07-20', endDate: '2026-07-27', rentalPeriod: 7,
      totalAmount: 245.0, depositAmount: 1500.0, status: 'pending_payment', paymentMethod: null
    },
  ]

  const orderInsert = db.prepare('INSERT INTO orders (id, userId, deviceId, startDate, endDate, rentalPeriod, totalAmount, depositAmount, status, paymentMethod, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const orderInserts = ordersToSeed.map(o =>
    orderInsert.bind(o.id, o.userId, o.deviceId, o.startDate, o.endDate, o.rentalPeriod, o.totalAmount, o.depositAmount, o.status, o.paymentMethod, now, now)
  )
  await db.batch(orderInserts)
}

export async function loadDatabaseData(c: Context): Promise<void> {
  const db = getDB(c)
  await seedDatabaseIfEmpty(c)
}


export function buildLayout(title: string, body: string, currentUser?: User | null): string {
  const normalizedTitle = title.includes('电脑租赁管理系统') ? title : `${title} - 电脑租赁管理系统`
  const isAuthPage = title.includes('登录') || title.includes('注册') || title.includes('找回密码')
  const topNav =
    currentUser || isAuthPage
      ? ``
      : `
      <a href="/login">登录</a>
      <a href="/register">注册</a>
    `

  const userBlockHtml = currentUser
    ? `
        <button class="notification-bell" type="button" aria-label="打开通知中心" aria-expanded="false"><svg class="notification-bell__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><b class="notification-bell__count" hidden>0</b></button>
        <a class="user-profile-link" href="${currentUser.role === 'ADMIN' ? `/admin/users/${encodeURIComponent(currentUser.id)}/edit` : currentUser.role === 'STAFF' ? '/staff/profile' : '/customer/profile'}" aria-label="编辑个人信息"><span class="user-label">${currentUser.name}${currentUser.accountType === 'guest' ? ` · 访客（${currentUser.guestExpiresAt || '租期结束'}删除）` : ''}</span><div class="user-avatar">${getAvatarInitials(currentUser.name)}</div></a>
        <form method="post" action="/logout" style="display:inline"><button type="submit" class="logout-button">登出</button></form>
      `
    : ''

  const navIcons: Record<string, string> = {
    '/customer/dashboard': '⌂', '/customer/rentals': '▤', '/customer/orders': '▦',
    '/customer/profile': '◎', '/customer/security': '⚿', '/customer/referral': '✦', '/customer/devices': '▣', '/customer/balance': '◌', '/customer/guest': '▰', '/customer/guest/upgrade': '↥',
    '/staff/dashboard': '◍', '/staff/orders': '◓', '/staff/orders/ongoing': '◷', '/staff/customers': '♧', '/staff/contracts': '▱',
    '/staff/contracts/new': '+', '/staff/contracts?status=pending_sign': '✍', '/staff/inspections': '◈', '/staff/rentals/tracking': '⌖', '/staff/devices': '▭', '/manager/staff': '♙',
    '/notifications': 'N', '/admin/notifications': 'inbox', '/admin/dashboard': 'grid', '/admin/users': '♙', '/admin/orders': '▥',
    '/admin/refunds': '↺', '/admin/contracts': '⌑', '/admin/templates/contract': '▧', '/admin/finance': '$',
    '/admin/withdrawals': '↗', '/admin/exceptions': 'alert', '/admin/devices': 'laptop', '/admin/device-agent-bindings': '⌁', '/admin/inspections': '◈', '/admin/calendar': '◫', '/admin/coupons': '%', '/admin/templates': '◇', '/admin/email-templates': '✉', '/admin/settings': '⚙',
    '/admin/devices/reports': 'chart', '/admin/reports': 'trend', '/admin/data-retention': '⧗', '/admin/monitoring': 'activity', '/admin/connectivity': '⌘', '/admin/agents': '⚑', '/admin/referrals': 'gift'
  }

  const navIconSvg = (kind: string) => {
    const paths: Record<string, string> = {
      '◉': '<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2"></circle>',
      '▤': '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path>',
      '▦': '<rect x="5" y="5" width="14" height="14" rx="2"></rect><path d="M9 5v14M15 5v14M5 9h14M5 15h14"></path>',
      '◎': '<circle cx="12" cy="8" r="3"></circle><path d="M6 20c.7-3.3 2.7-5 6-5s5.3 1.7 6 5"></path>',
      '▣': '<rect x="5" y="5" width="14" height="14" rx="2"></rect><path d="M8 8h8v8H8z"></path>',
      '⚙': '<circle cx="12" cy="12" r="3"></circle><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"></path>',
      'N': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
      '◷': '<circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path>',
      '↺': '<path d="M5 9a8 8 0 1 1 1 8"></path><path d="M5 5v4h4"></path>',
      '↗': '<path d="M7 17 17 7M9 7h8v8"></path>',
      '$': '<path d="M12 3v18M16 7.5c-.8-1-2-1.5-4-1.5-2.4 0-4 1.2-4 3s1.6 3 4 3 4 1.2 4 3-1.6 3-4 3c-2 0-3.2-.5-4-1.5"></path>',
      '⚿': '<rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>',
      '✦': '<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z"></path>',
      '◈': '<rect x="6" y="4" width="12" height="17" rx="2"></rect><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"></path><path d="m9 13 2 2 4-4"></path>',
      'grid': '<rect x="4" y="4" width="7" height="7" rx="1.5"></rect><rect x="13" y="4" width="7" height="7" rx="1.5"></rect><rect x="4" y="13" width="7" height="7" rx="1.5"></rect><rect x="13" y="13" width="7" height="7" rx="1.5"></rect>',
      'alert': '<path d="M12 3 2 20h20L12 3Z"></path><path d="M12 9.5v4.5"></path><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"></circle>',
      'inbox': '<path d="M4 12h4l2 3h4l2-3h4"></path><path d="M5.5 5h13L21 12v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6L5.5 5Z"></path>',
      'chart': '<path d="M4 20V10M10 20V4M16 20v-6"></path><path d="M3 20h18"></path>',
      'gift': '<rect x="3" y="8" width="18" height="13" rx="1"></rect><path d="M3 8h18M12 8v13"></path><path d="M12 8c-2-3-6-3-6 0M12 8c2-3 6-3 6 0"></path>',
      'laptop': '<rect x="3" y="4" width="18" height="12" rx="1.5"></rect><path d="M2 20h20"></path>',
      '+': '<path d="M12 5v14M5 12h14"></path>',
      '♙': '<circle cx="12" cy="8" r="3"></circle><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5"></path><path d="M8 4h8"></path>',
      '▥': '<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 10h16M9 10v9M15 10v9"></path>',
      '⌑': '<path d="m12 3 8 5-8 5-8-5 8-5Z"></path><path d="m6 12 6 4 6-4M6 16l6 4 6-4"></path>',
      '⌁': '<rect x="5" y="6" width="14" height="12" rx="2"></rect><path d="M8 9h8M8 13h5"></path><circle cx="17" cy="16" r="2"></circle>',
      '◫': '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M8 8h8M8 12h3M13 12h3M8 16h8"></path>',
      '%': '<circle cx="8" cy="8" r="2"></circle><circle cx="16" cy="16" r="2"></circle><path d="m17 7-10 10"></path>',
      '◇': '<path d="m12 3 8 9-8 9-8-9 8-9Z"></path><path d="M9 12h6"></path>',
      '✉': '<rect x="4" y="6" width="16" height="12" rx="2"></rect><path d="m5 8 7 5 7-5"></path>'
      , '◌': '<circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path><path d="M7 5 5 3M17 5l2-2"></path>'
      , '↥': '<path d="M12 19V5"></path><path d="m7 10 5-5 5 5"></path><path d="M5 19h14"></path>'
      , '⌂': '<path d="m4 11 8-7 8 7"></path><path d="M6 10v10h12V10M10 20v-6h4v6"></path>'
      , '◍': '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 4v5M20 12h-5"></path>'
      , '▰': '<rect x="4" y="6" width="16" height="12" rx="2"></rect><path d="M4 10h16M8 14h3M8 16h6"></path>'
      , '♧': '<path d="M8 10a3 3 0 1 1 4-3 3 3 0 1 1 4 3 3 3 0 1 1-4 3 3 3 0 1 1-4-3Z"></path><path d="M12 13v7"></path>'
      , '▱': '<path d="M6 4h9l3 3v13H6z"></path><path d="M15 4v4h4M9 12h6M9 16h4"></path>'
      , '⌖': '<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2"></path>'
      , '▭': '<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M8 9h8M8 13h8M8 16h4"></path>'
      , '☷': '<path d="M5 6h14M5 12h14M5 18h14"></path><circle cx="8" cy="6" r="1"></circle><circle cx="16" cy="12" r="1"></circle><circle cx="10" cy="18" r="1"></circle>'
      , '◓': '<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"></path><path d="M12 4v16a8 8 0 0 0 0-16Z"></path>'
      , '◒': '<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"></path><path d="M12 4a8 8 0 0 0 0 16Z"></path>'
      , '⌘': '<path d="M7 5a3 3 0 1 0 0 6h10a3 3 0 1 0 0-6 3 3 0 1 0-5 2 3 3 0 1 0-5-2Z"></path><path d="M7 13a3 3 0 1 0 0 6 3 3 0 1 0 5-2 3 3 0 1 0 5 2 3 3 0 1 0 0-6Z"></path>'
      , '✍': '<path d="M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17Z"></path><path d="M13.5 6.5l3 3"></path><path d="M4 20l1-3"></path>'
      , '▧': '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 9h16"></path><path d="M10 9v11"></path>'
      , 'trend': '<path d="M4 18l6-6 4 4 6-7"></path><path d="M15 9h5v5"></path><path d="M3 21h18"></path>'
      , '⧗': '<path d="M6 4h12M6 20h12"></path><path d="M7 4c0 4 10 5 10 8s-10 4-10 8"></path><path d="M17 4c0 4-10 5-10 8"></path>'
      , 'activity': '<path d="M3 12h4l3 8 4-16 3 8h4"></path>'
      , '⚑': '<path d="M6 3v18"></path><path d="M6 4h11l-2.5 4L17 12H6"></path>'
    }
    return `<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] || paths['▣']}</svg>`
  }
  const renderNavLink = (href: string, text: string) => {
    const icon = navIcons[href] || navIcons[href.split('?')[0]] || '▣'
    return `<a href="${href}"><span class="nav-icon">${navIconSvg(icon)}</span>${text}</a>`
  }
  const chevronSvg = '<span class="nav-group-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg></span>'
  const renderNavGroup = (label: string, links: Array<[string, string]>) => `<details class="sidebar-nav-group" open><summary>${label}${chevronSvg}</summary>${links.map(([href, text]) => renderNavLink(href, text)).join('')}</details>`

  const mobileLinks = currentUser?.role === 'ADMIN'
    ? [['/admin/dashboard', '控制台', '◉'], ['/notifications', '通知', 'N'], ['/admin/orders', '订单', '▦'], ['/admin/users', '用户', '◎'], ['/admin/settings', '设置', '⚙']]
    : currentUser?.role === 'STAFF'
      ? [['/staff/dashboard', '工作台', '◉'], ['/notifications', '通知', 'N'], ['/staff/orders', '订单', '▦'], ['/staff/contracts', '合同', '▤'], ['/staff/customers', '客户', '◎']]
      : currentUser?.accountType === 'guest'
        ? [['/customer/guest', '合同中心', '▤'], ['/customer/guest/upgrade', '升级账户', '✦']]
        : [['/customer/dashboard', '首页', '◉'], ['/notifications', '通知', 'N'], ['/customer/devices', '可租设备', '▣'], ['/customer/rentals', '租赁', '▤'], ['/customer/orders', '订单', '▦'], ['/customer/balance', '钱包', '$'], ['/customer/profile', '我的', '◎']]
  const mobileNav = currentUser ? mobileLinks.map(([href, text, icon]) => `<a href="${href}"><span class="nav-icon">${navIconSvg(navIcons[href] || icon)}</span><small>${text}</small></a>`).join('') : `<a href="/login"><span class="nav-icon">${navIconSvg('↗')}</span><small>登录</small></a><a href="/register"><span class="nav-icon">${navIconSvg('+')}</span><small>注册</small></a>`
  const mobileLabel = currentUser?.role === 'ADMIN' ? '管理端' : currentUser?.role === 'STAFF' ? '员工端' : currentUser?.accountType === 'guest' ? '访客合同' : '客户端'
  const mobileUserBlock = currentUser ? `<span class="mobile-user-avatar">${getAvatarInitials(currentUser.name)}</span>` : ''

  const mobileNavToggle = currentUser
    ? `<button class="mobile-nav-toggle" type="button" aria-label="打开导航菜单" aria-expanded="false" aria-controls="app-sidebar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>`
    : ''

  const sidebar = currentUser
    ? `<aside class="sidebar" id="app-sidebar">
        <div class="sidebar-section">
          <h3>导航</h3>
          ${currentUser.role === 'CUSTOMER' ? `
            ${currentUser.accountType === 'guest' ? renderNavGroup('合同中心', [['/customer/guest', '访客合同中心'], ['/customer/guest/upgrade', '升级账户']]) : `
              ${renderNavLink('/customer/dashboard', '控制台')}
              ${renderNavGroup('租赁工作区', [['/customer/rentals', '我的租赁'], ['/customer/orders', '订单管理']])}
              ${renderNavGroup('账户与钱包', [['/customer/balance', '我的钱包'], ['/customer/profile', '个人资料'], ['/customer/security', '安全设置'], ['/customer/referral', '推荐计划']])}
            `}
          ` : ''}
          ${currentUser.role === 'STAFF' ? `
            ${renderNavLink('/staff/dashboard', '工作台')}
            ${renderNavLink('/notifications', '通知中心')}
            ${renderNavGroup('租赁管理', [['/staff/orders', '租赁订单'], ['/staff/orders/ongoing', '进行中的租赁'], ['/staff/inspections', '验机记录']])}
            ${renderNavGroup('合同管理', [['/staff/contracts', '合同列表'], ['/staff/contracts/new', '新建合同'], ['/staff/contracts?status=pending_sign', '待签署合同']])}
            ${renderNavGroup('设备运营', [['/staff/devices', '设备管理'], ['/staff/rentals/tracking', '租赁追踪']])}
            ${getAccessLevel(currentUser) === 'MANAGER' ? renderNavGroup('人员管理', [['/manager/staff', 'Staff 员工']]) : ''}
          ` : ''}
          ${currentUser.role === 'ADMIN' ? `
            ${renderNavLink('/admin/dashboard', '控制台')}
            ${renderNavGroup('通知管理', [['/admin/notifications', '通知中心'], ['/notifications', '发布通知']])}
            ${renderNavGroup('用户管理', [['/admin/users', '用户管理']])}
            ${renderNavGroup('租赁管理', [['/admin/orders', '租赁订单'], ['/admin/calendar', '租赁日历']])}
            ${renderNavGroup('合同管理', [['/admin/contracts', '合同列表'], ['/admin/templates/contract', '合同模板']])}
            ${renderNavGroup('设备管理', [['/admin/devices', '设备管理'], ['/admin/device-agent-bindings', '绑定设备'], ['/admin/inspections', '验机记录'], ['/admin/devices/reports', '设备运营报表']])}
            ${renderNavGroup('财务管理', [['/admin/finance', '财务总览'], ['/admin/reports', '运营分析报表'], ['/admin/exceptions', '异常任务中心'], ['/admin/coupons', '优惠码管理'], ['/admin/referrals', '推荐奖励管理'], ['/admin/agents', '代理计划'], ['/admin/refunds', '退款管理'], ['/admin/withdrawals', '佣金提现']])}
            ${renderNavGroup('系统设置', [['/admin/templates', '协议模板'], ['/admin/email-templates', '邮件通知模板'], ['/admin/settings', '系统设置'], ['/admin/connectivity', '通讯检测'], ['/admin/monitoring', '系统健康监控'], ['/admin/data-retention', '数据保留策略']])}
          ` : ''}
        </div>
        <div class="sidebar-footer">
          <div class="status-indicator online" id="system-status-indicator" title="正在检查系统状态">
            <span class="led"></span>
            <span id="system-status-label">正常</span>
          </div>
        </div>
      </aside>`
    : ''

  const footerCompany = sanitizePlainText(systemSettings.companyDetails.name || 'PC Rental', 80)
  // 这是内部运营后台，页脚保持低调的一行：版权 + 少量核心法律链接。
  // 对外的公开页 / 登录页仍展示完整的合规链接清单。
  const footerLinks: Array<[string, string]> = currentUser
    ? [['/service-terms', '服务条款'], ['/privacy', '隐私政策'], ['/cookies', 'Cookie 政策']]
    : [['/user-terms', '用户协议'], ['/service-terms', '服务条款'], ['/privacy', '隐私政策'], ['/cookies', 'Cookie 政策'], ['/refund-policy', '退款政策'], ['/consumer-rights', '消费者权利'], ['/complaints', '投诉与争议'], ['/acceptable-use', '可接受使用'], ['/software-terms', '软件协议']]
  const footerNav = footerLinks.map(([href, text]) => `<a href="${href}">${text}</a>`).join('')
  const footerHtml = `<footer class="legal-footer"><span class="legal-footer__copyright">© ${new Date().getFullYear()} ${footerCompany}</span><nav aria-label="网站法律信息">${footerNav}</nav></footer>`

  return renderLayoutTemplate({
    TITLE: normalizedTitle,
    BODY_CLASS: isAuthPage ? 'auth-page' : currentUser ? 'app-page' : 'public-page',
    TOP_NAV: topNav,
    USER_BLOCK: userBlockHtml,
    MOBILE_NAV: mobileNav,
    MOBILE_NAV_TOGGLE: mobileNavToggle,
    MOBILE_LABEL: mobileLabel,
    MOBILE_USER_BLOCK: mobileUserBlock,
    SIDEBAR: sidebar,
    CONTENT: body,
    FOOTER: footerHtml
  })
}

// ==================== 签约会话持久化管理 ====================
const SESSION_EXPIRY_HOURS = 24 // 会话24小时过期

/**
 * 获取或创建签约会话
 * @param c Hono上下文对象
 * @param token 会话token
 * @param contractToken 关联的合同token
 */
export async function getOrCreateSignSession(c: Context, token: string, contractToken: string): Promise<Record<string, any>> {
  const db = getDB(c)

  try {
    // 先尝试获取现有会话 - 使用正确的snake_case列名匹配数据库schema
    const existingSession = await db.prepare(`
      SELECT session_data, expires_at FROM sign_sessions WHERE token = ?
    `).bind(token).first()

    if (existingSession) {
      const sessionData = JSON.parse((existingSession as any).session_data)
      const expiresAt = new Date((existingSession as any).expires_at)

      // 检查会话是否过期
      if (expiresAt > new Date()) {
        await logError(c, 'DEBUG', `Retrieved existing sign session`, undefined, { token, contractToken })
        return sessionData
      } else {
        // 会话已过期，删除并创建新的
        await db.prepare('DELETE FROM sign_sessions WHERE token = ?').bind(token).run()
        await logError(c, 'INFO', `Removed expired sign session`, undefined, { token, contractToken })
      }
    }

    // 创建新会话 - 使用正确的snake_case列名匹配数据库schema
    const newSession: Record<string, any> = {}
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS)

    await db.prepare(`
      INSERT INTO sign_sessions (token, contract_token, session_data, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(token, contractToken, JSON.stringify(newSession), expiresAt.toISOString()).run()

    await logError(c, 'INFO', `Created new sign session`, undefined, { token, contractToken })
    return newSession
  } catch (error) {
    await logError(c, 'ERROR', `Failed to get or create sign session`, error as Error, { token, contractToken })
    throw error
  }
}

/**
 * 更新签约会话数据
 * @param c Hono上下文对象
 * @param token 会话token
 * @param data 要更新的会话数据
 */
export async function updateSignSession(c: Context, token: string, data: Record<string, any>): Promise<void> {
  const db = getDB(c)

  try {
    // 先获取当前会话
    const currentSession = await db.prepare(`
      SELECT session_data FROM sign_sessions WHERE token = ?
    `).bind(token).first()

    if (!currentSession) {
      throw new Error(`Sign session not found: ${token}`)
    }

    const sessionData = JSON.parse((currentSession as any).session_data)
    const updatedSession = { ...sessionData, ...data }

    // 更新数据库中的会话 - 使用正确的snake_case列名匹配数据库schema
    await db.prepare(`
      UPDATE sign_sessions 
      SET session_data = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE token = ?
    `).bind(JSON.stringify(updatedSession), token).run()

    await logError(c, 'DEBUG', `Updated sign session`, undefined, { token, updates: Object.keys(data) })
  } catch (error) {
    await logError(c, 'ERROR', `Failed to update sign session`, error as Error, { token, updates: Object.keys(data) })
    throw error
  }
}

/**
 * 删除签约会话（签约完成后清理）
 * @param c Hono上下文对象
 * @param token 会话token
 */
export async function deleteSignSession(c: Context, token: string): Promise<void> {
  const db = getDB(c)

  try {
    await db.prepare('DELETE FROM sign_sessions WHERE token = ?').bind(token).run()
    await logError(c, 'INFO', `Deleted sign session successfully`, undefined, { token })
  } catch (error) {
    await logError(c, 'WARNING', `Failed to delete sign session`, error as Error, { token })
  }
}

/**
 * 清理所有过期的签约会话
 * @param c Hono上下文对象
 */
export async function cleanupExpiredSignSessions(c: Context): Promise<void> {
  const db = getDB(c)
  const now = new Date().toISOString()

  try {
    const result = await db.prepare(`
      DELETE FROM sign_sessions WHERE expiresAt < ?
    `).bind(now).run()

    const deletedCount = (result as any).changes || 0
    if (deletedCount > 0) {
      await logError(c, 'INFO', `Cleaned up ${deletedCount} expired sign sessions`)
    }
  } catch (error) {
    await logError(c, 'WARNING', 'Failed to cleanup expired sign sessions', error as Error)
  }
}


// Legacy/local in-memory helpers have been removed to avoid shadowing DB-backed exports.
