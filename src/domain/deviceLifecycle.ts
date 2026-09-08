/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 设备生命周期状态机 (TODO.md P1 #4 / 完善.md §13, §16)
//
//   RESERVED → RENTED
//   RENTED → RETURNED → INSPECTION → MAINTENANCE → READY
//   INSPECTION → DAMAGED → MAINTENANCE → READY
//   MAINTENANCE / DAMAGED → RETIRED
// 这是推荐流转；管理员在设备编辑页仍可手动纠正，但“存在未完成维护时不得置为
// READY / 可用”是硬性规则，由路由单独强制。

export const DEVICE_LIFECYCLE_FLOW: Record<string, string[]> = {
  RESERVED: ['READY', 'RENTED'],
  READY: ['RESERVED', 'RENTED', 'MAINTENANCE', 'RETIRED'],
  RENTED: ['RETURNED', 'INSPECTION', 'READY'],
  RETURNED: ['INSPECTION', 'MAINTENANCE', 'READY'],
  INSPECTION: ['MAINTENANCE', 'DAMAGED', 'RETURNED', 'READY'],
  DAMAGED: ['MAINTENANCE', 'RETIRED'],
  MAINTENANCE: ['READY', 'DAMAGED', 'RETIRED'],
  RETIRED: [],
}

export function canTransitionDeviceLifecycle(from: string, to: string): boolean {
  return from === to || Boolean(DEVICE_LIFECYCLE_FLOW[from]?.includes(to))
}

export const MAINTENANCE_OPEN_STATES = new Set(['OPEN', 'IN_PROGRESS', 'DATA_CLEAN', 'SYSTEM_RESET', 'CLIENT_CHECK'])
export const MAINTENANCE_ADVANCE_NEXT: Record<string, string> = {
  OPEN: 'IN_PROGRESS', IN_PROGRESS: 'DATA_CLEAN', DATA_CLEAN: 'SYSTEM_RESET', SYSTEM_RESET: 'CLIENT_CHECK',
}
// 归还后设备准备的十项验证（完善.md §16）——全部通过才允许维护记录 COMPLETED、设备回到 READY。
export const MAINTENANCE_CHECK_TYPES = ['DATA_WIPE', 'SYSTEM_RESET', 'WINDOWS_BOOT', 'AGENT_INSTALLED', 'AGENT_VERSION', 'DEVICE_SERIAL', 'DISK_HEALTH', 'NETWORK', 'HARDWARE', 'ACCESSORIES'] as const
