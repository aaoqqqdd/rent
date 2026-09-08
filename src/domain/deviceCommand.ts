/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 远程设备命令状态机 (TODO.md P1 #3 / 完善.md §23)
//
//   QUEUED → SENT → ACKNOWLEDGED → RUNNING → SUCCESS
//   QUEUED/SENT/ACKNOWLEDGED/RUNNING → FAILED
//   QUEUED → EXPIRED | CANCELLED
// 终态命令不可再流转；客户端重复上报同一终态视为幂等成功。

export const DEVICE_COMMAND_STATES = ['QUEUED', 'SENT', 'ACKNOWLEDGED', 'RUNNING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'] as const
export type DeviceCommandState = typeof DEVICE_COMMAND_STATES[number]

export const DEVICE_COMMAND_TERMINAL_STATES = new Set<DeviceCommandState>(['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'])

const DEVICE_COMMAND_TRANSITIONS: Record<DeviceCommandState, DeviceCommandState[]> = {
  QUEUED: ['SENT', 'EXPIRED', 'CANCELLED', 'FAILED'],
  SENT: ['ACKNOWLEDGED', 'RUNNING', 'SUCCESS', 'FAILED', 'EXPIRED'],
  ACKNOWLEDGED: ['RUNNING', 'SUCCESS', 'FAILED', 'EXPIRED'],
  RUNNING: ['SUCCESS', 'FAILED', 'EXPIRED'],
  SUCCESS: [], FAILED: [], EXPIRED: [], CANCELLED: [],
}

export function canTransitionDeviceCommand(from: string, to: string): boolean {
  return Boolean(DEVICE_COMMAND_TRANSITIONS[from as DeviceCommandState]?.includes(to as DeviceCommandState))
}

// 高风险远程命令：需要 MANAGER 及以上、二次确认并写审计日志。
export const HIGH_RISK_DEVICE_COMMANDS = new Set(['LOCK_DEVICE', 'REBOOT', 'DATA_WIPE', 'SYSTEM_RESET', 'REREGISTER_AGENT', 'DELETE_RENTAL_USER'])

export function isHighRiskDeviceCommand(type: string): boolean {
  return HIGH_RISK_DEVICE_COMMANDS.has(String(type || '').trim().toUpperCase())
}
