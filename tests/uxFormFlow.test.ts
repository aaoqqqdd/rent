/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

// 操作逻辑：表单失败回填、防重复提交标记、返回链接保留筛选条件（back 参数）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'

const clientScript = readFileSync(new URL('../src/appClient.js.txt', import.meta.url), 'utf8')
const newContractSource = readFileSync(new URL('../src/pages/staff/newContract.ts', import.meta.url), 'utf8')
const createContractSource = readFileSync(new URL('../src/actions/staff/createContract.ts', import.meta.url), 'utf8')

test('提交后按钮被禁用且文案变为「处理中…」，防止重复提交', () => {
  // 全局 submit 拦截：一旦提交就把提交按钮 disabled 并改写文案。
  assert.match(clientScript, /button\.disabled = true/)
  assert.match(clientScript, /button\.textContent = '处理中…'/)
  // 同一表单只处理一次，避免多次绑定导致状态来回切换。
  assert.match(clientScript, /form\.dataset\.loadingHandled = 'true'/)
})

test('新建合同表单在校验失败后回填用户已选内容', () => {
  // 页面接受 prefill 入参，并把日期/设备/地址等字段渲染回表单。
  assert.match(newContractSource, /renderNewContractPage\(c: Context, user: any, prefill: NewContractPrefill = \{\}\)/)
  for (const key of ['deviceId', 'startDate', 'endDate', 'deliveryStreet', 'deliveryPostcode', 'deviceCondition']) {
    assert.ok(newContractSource.includes(key), `回填字段缺少 ${key}`)
  }
  // 日期只回填合法的 YYYY-MM-DD，避免把任意字符串塞进 value。
  assert.match(newContractSource, /preDate = \(key: string\) => \/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test/)
})

test('合同创建失败的跳转携带错误信息与可回填字段，且经过 URL 编码', () => {
  assert.match(createContractSource, /const failRedirect = \(message: string\) => \{/)
  assert.match(createContractSource, /new URLSearchParams\(\{ error: message \}\)/)
  assert.match(createContractSource, /query\.set\(key, value\.slice\(0, 500\)\)/)
  // 失败跳转不应把错误信息裸拼进 URL（会出现空格/中文未编码）。
  assert.ok(!/errorPath\}\?error=\$\{/.test(createContractSource), '错误信息必须编码后再拼 URL')
})

test('返回列表链接保留搜索与页码（back 参数），并做白名单校验', () => {
  for (const source of [newContractSource, createContractSource]) {
    assert.ok(typeof source === 'string' && source.length > 0)
  }
  // 列表用 back= 携带来源查询串，详情页只接受 searchTerm/page/perPage 且页码必须是纯数字。
  const files = ['src/pages/staff/orders.ts', 'src/pages/staff/customers.ts', 'src/pages/staff/orderDetail.ts', 'src/pages/staff/customerDetail.ts', 'src/pages/staff/customerEdit.ts']
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.ok(/back/.test(source), `${file} 应支持 back 参数透传`)
  }
  const orderDetail = readFileSync(new URL('../src/pages/staff/orderDetail.ts', import.meta.url), 'utf8')
  assert.match(orderDetail, /\^\\d\{1,6\}\$/, 'back 里的页码必须是纯数字，避免任意值注入链接')
  assert.match(orderDetail, /slice\(0, 120\)/, 'back 里的搜索词要截断')
})

test('已作废合同的提示为简体中文且已编码', () => {
  const cancelSource = readFileSync(new URL('../src/actions/staff/cancelContract.ts', import.meta.url), 'utf8')
  assert.match(cancelSource, /合同已作废/)
  assert.ok(!/\?error=[A-Za-z]/.test(cancelSource), '不应再出现英文裸提示')
  assert.match(cancelSource, /encodeURIComponent/)
})

test('back 参数不能构成开放重定向（纵深防御）', () => {
  // 复刻页面里的 back 解析 + 二次断言逻辑，确保 href 只会是本站 query。
  const makeSuffix = (rawBack: string) => {
    const backParams = new URLSearchParams(rawBack)
    const safeBack = new URLSearchParams()
    if (backParams.get('searchTerm')) safeBack.set('searchTerm', String(backParams.get('searchTerm')).slice(0, 120))
    for (const key of ['page', 'perPage']) { const v = backParams.get(key); if (v && /^\d{1,6}$/.test(v)) safeBack.set(key, v) }
    const backQueryText = safeBack.toString()
    return backQueryText && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)|[\u0000-\u001f\u007f]/i.test(backQueryText) ? `?${backQueryText}` : ''
  }
  // 外部地址 / 协议相对地址一律不产生后缀。
  assert.equal(makeSuffix('https://evil.com'), '')
  assert.equal(makeSuffix('//evil.com'), '')
  assert.equal(makeSuffix('javascript:alert(1)'), '')
  // 塞进 searchTerm 的外部地址会被编码，仍是本站 query 里的一个值。
  assert.equal(makeSuffix('searchTerm=//evil.com'), '?searchTerm=%2F%2Fevil.com')
  // CRLF 不能逸出成响应头。
  assert.ok(!/[\r\n]/.test(makeSuffix('searchTerm=%0d%0aX:%20y')))
  // 正常筛选条件完整保留。
  assert.equal(makeSuffix('searchTerm=abc&page=2'), '?searchTerm=abc&page=2')
})

test('三个页面都带 back 后缀的白名单校验（不含裸拼）', () => {
  for (const file of ['src/pages/staff/orderDetail.ts', 'src/pages/staff/customerDetail.ts', 'src/pages/staff/customerEdit.ts']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.match(source, /backQueryText/, `${file} 应对序列化后的 back 做二次校验`)
    assert.match(source, /\(\?:\[a-z\]\[a-z0-9\+\.-\]\*:|\\\/\\\/\)/, `${file} 应拒绝 scheme 与协议相对地址`)
  }
})
