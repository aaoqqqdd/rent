/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 字典结构测试：无重复 key、英文值不含中日韩字符、按域分组、序列化格式可解析。
import test from 'node:test'
import assert from 'node:assert/strict'
import { i18nDomainGroups, i18nMessages } from '../src/lib/i18nData'
import { dictionaryText, serializeDictionary, languageScript, languageBootScript } from '../src/lib/i18n'

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/

test('i18n dictionary: 分组结构完整且每组的 domain 唯一', () => {
  const domains = i18nDomainGroups.map((group) => group.domain)
  assert.deepEqual([...new Set(domains)], domains, 'domain 不能重复')
  for (const expected of ['common', 'nav', 'table', 'forms', 'status', 'admin', 'staff', 'customer', 'public', 'legal', 'errors']) {
    assert.ok(domains.includes(expected as never), `缺少域 ${expected}`)
  }
})

test('i18n dictionary: 全量字典没有重复 key', () => {
  const seen = new Map<string, string>()
  const duplicates: string[] = []
  for (const group of i18nDomainGroups) {
    for (const key of Object.keys(group.messages)) {
      if (seen.has(key)) duplicates.push(`${key}（${seen.get(key)} / ${group.domain}）`)
      seen.set(key, group.domain)
    }
  }
  assert.deepEqual(duplicates, [], `重复 key：${duplicates.join(', ')}`)
  assert.equal(Object.keys(i18nMessages).length, seen.size)
})

test('i18n dictionary: 英文值不含中日韩字符', () => {
  const offenders: string[] = []
  for (const [key, value] of Object.entries(i18nMessages)) {
    if (CJK.test(value)) offenders.push(`${key} → ${value}`)
  }
  assert.deepEqual(offenders, [], `英文值里混入汉字：${offenders.slice(0, 10).join(' | ')}`)
})

test('i18n dictionary: key 非空，条目数量在合理区间；只有白名单短语可译成空串', () => {
  const total = Object.keys(i18nMessages).length
  assert.ok(total > 3000, `字典只有 ${total} 条，疑似被截断`)
  // 「第 X 页」「共 N 条」这类分页前后缀需要整段删除，英文才自然，因此允许 value 为空。
  const emptyByDesign = new Set([' 页', '第 ', '条', '人'])
  for (const [key, value] of Object.entries(i18nMessages)) {
    assert.ok(key.trim().length > 0, '存在空 key')
    if (!value.trim()) assert.ok(emptyByDesign.has(key), `key ${key} 的英文为空`)
  }
})

test('i18n dictionary: 序列化格式为 key<TAB>value，可被运行时解析', () => {
  assert.ok(dictionaryText.length > 0)
  const lines = dictionaryText.split('\n')
  // 序列化会跳过空 value（交给运行时按「原文保留」处理），所以行数 ≤ 条目数
  assert.ok(lines.length > 0)
  assert.ok(lines.length <= Object.keys(i18nMessages).length)
  for (const line of lines.slice(0, 200)) {
    assert.equal(line.split('\t').length, 2, `行格式错误：${JSON.stringify(line)}`)
  }
  // 按角色注入只带部分域时，条目数应当变少
  const subset = serializeDictionary(['common'])
  assert.ok(subset.length > 0)
  assert.ok(subset.split('\n').length < lines.length)
})

test('i18n dictionary: 语言脚本把字典内联，且不出现会破坏模板的 ${ 序列', () => {
  assert.ok(languageScript.includes('var rawDictionary'))
  // `${` 会被当成模板插值，导致整个 i18n.js 语法错误
  const dictionarySection = languageScript.slice(languageScript.indexOf('var rawDictionary'), languageScript.indexOf('var translations'))
  assert.ok(!dictionarySection.includes('${'), '字典片段里出现未转义的 ${')
})

test('i18n dictionary: 首屏脚本足够小（内联进 head，越大越慢）', () => {
  assert.ok(languageBootScript.length < 600, `首屏脚本 ${languageBootScript.length} 字节，过长`)
  assert.ok(languageBootScript.includes('data-language'), '首屏脚本必须尽早写入 data-language')
})
