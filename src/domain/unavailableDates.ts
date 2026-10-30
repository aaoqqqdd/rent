/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

const dayMs = 86400000
const maxDates = 3660

/** 展开闭区间，沿用逐日存储，供所有租期校验使用。 */
export function parseUnavailableDates(value: string): string[] {
  const dates = new Set<string>()
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
  for (const item of value.trim().replace(/\s*[:：]\s*/g, ':').split(/[,，\s]+/).filter(Boolean)) {
    const parts = item.split(':')
    if (parts.length > 2 || !parts.every(valid)) throw new Error('不可用日期格式无效')
    const start = parts[0], end = parts[1] || start
    if (end < start) throw new Error('不可用日期的结束日期不能早于开始日期')
    const from = Date.parse(start), until = Date.parse(end)
    if ((until - from) / dayMs + 1 > maxDates) throw new Error('不可用日期最多 3660 天')
    for (let day = from; day <= until; day += dayMs) {
      dates.add(new Date(day).toISOString().slice(0, 10))
      if (dates.size > maxDates) throw new Error('不可用日期最多 3660 天')
    }
  }
  return [...dates].sort()
}

/** 编辑时合并连续日期，避免长期不可用日期被输入框显示长度截断。 */
export function formatUnavailableDates(dates: string[]): string {
  const sorted = [...new Set(dates)].sort(), ranges: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]
    while (i + 1 < sorted.length && Date.parse(sorted[i + 1]) - Date.parse(sorted[i]) === dayMs) i++
    ranges.push(start === sorted[i] ? start : `${start}:${sorted[i]}`)
  }
  return ranges.join(', ')
}
