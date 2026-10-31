/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import type { SmtpConfig } from '../emailConfig'
import type { OutgoingEmail } from '../notifyChannels'

const encoder = new TextEncoder()
const base64 = (value: string) => {
  let binary = ''
  for (const byte of encoder.encode(value)) binary += String.fromCharCode(byte)
  return btoa(binary)
}
const wrapBase64 = (value: string) => value.match(/.{1,76}/g)?.join('\r\n') || ''

function header(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error('邮件头包含无效字符')
  return value
}

// RFC 2047 encoded-word，按 UTF-8 字节分组，避免中文被截断或邮件头超长。
function encodedHeader(value: string): string {
  header(value)
  const parts: string[] = []
  let part = ''
  for (const char of value) {
    if (encoder.encode(part + char).length > 42) { parts.push(part); part = '' }
    part += char
  }
  if (part) parts.push(part)
  return parts.map(text => `=?UTF-8?B?${base64(text)}?=`).join('\r\n ')
}

function mailbox(value: string): { address: string; formatted: string } {
  const input = header(value).trim()
  const match = input.match(/^(.*?)<([^<>]+)>$/)
  const address = (match ? match[2] : input).trim()
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(address)) throw new Error('邮件地址格式不正确')
  const name = match?.[1].trim().replace(/^"|"$/g, '')
  return { address, formatted: name ? `${encodedHeader(name)} <${address}>` : address }
}

function buildMessage(from: string, email: OutgoingEmail) {
  const sender = mailbox(from)
  const recipients = (Array.isArray(email.to) ? email.to : [email.to]).map(mailbox)
  if (!recipients.length) throw new Error('请填写收件邮箱')
  const domain = sender.address.split('@')[1]
  const id = `${crypto.randomUUID()}@${domain}`
  const boundary = `rent-${crypto.randomUUID()}`
  const alternative = `${boundary}-alternative`
  const attachments = email.attachments?.filter(item => item.filename && item.content) || []
  const headers = [
    `From: ${sender.formatted}`, `To: ${recipients.map(item => item.formatted).join(',\r\n ')}`,
    `Subject: ${encodedHeader(email.subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${id}>`, 'MIME-Version: 1.0',
    `Content-Type: multipart/${attachments.length ? 'mixed' : 'alternative'}; boundary="${boundary}"`, '',
  ]
  const textPart = (type: string, content: string) => [`Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', wrapBase64(base64(content))].join('\r\n')
  const parts = [textPart('text/plain', email.text), ...(email.html ? [textPart('text/html', email.html)] : [])]
  const renderParts = (delimiter: string) => parts.map(part => `--${delimiter}\r\n${part}\r\n`).join('') + `--${delimiter}--\r\n`
  let body = renderParts(boundary)
  if (attachments.length) {
    body = `--${boundary}\r\nContent-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n${renderParts(alternative)}`
    for (const attachment of attachments) {
      const type = header(attachment.contentType || 'application/octet-stream')
      if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(type)) throw new Error('附件类型无效')
      const filename = encodeURIComponent(header(attachment.filename)).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
      const content = attachment.content.replace(/\s/g, '')
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content)) throw new Error('附件内容无效')
      body += `--${boundary}\r\nContent-Type: ${type}\r\nContent-Disposition: attachment;\r\n filename*=UTF-8''${filename}\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapBase64(content)}\r\n`
    }
    body += `--${boundary}--\r\n`
  }
  return { id, sender: sender.address, recipients: recipients.map(item => item.address), domain, data: headers.join('\r\n') + '\r\n' + body }
}

export function validateSmtpConfig(config: SmtpConfig): void {
  if (!config.host || !/^[A-Za-z0-9.-]+$/.test(config.host) || config.host.length > 253) throw new Error('SMTP 主机格式不正确')
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('SMTP 端口无效')
  if (config.port === 25) throw new Error('Cloudflare Workers 不支持 SMTP 端口 25，请使用 465 或 587')
  if (!['ssl', 'starttls', 'none'].includes(config.encryption)) throw new Error('SMTP 加密方式无效')
  if (!config.user || !config.password || /[\r\n\0]/.test(config.user + config.password)) throw new Error('SMTP 用户名或密码无效')
  mailbox(config.from)
}

type Reply = { code: number; lines: string[] }

class SmtpSession {
  socket?: Socket
  reader?: ReadableStreamDefaultReader<Uint8Array>
  writer?: WritableStreamDefaultWriter<Uint8Array>
  buffer = ''
  decoder = new TextDecoder()

  async attach(socket: Socket) {
    this.socket = socket
    void socket.closed.catch(() => {})
    await socket.opened
    this.reader = socket.readable.getReader()
    this.writer = socket.writable.getWriter()
  }

  async reply(): Promise<Reply> {
    const lines: string[] = []
    let code = 0
    let size = 0
    while (true) {
      let end = this.buffer.indexOf('\r\n')
      while (end < 0) {
        const chunk = await this.reader!.read()
        if (chunk.done) throw new Error('SMTP 连接已关闭')
        this.buffer += this.decoder.decode(chunk.value, { stream: true })
        if (this.buffer.length + size > 65536) throw new Error('SMTP 响应过长')
        end = this.buffer.indexOf('\r\n')
      }
      const line = this.buffer.slice(0, end)
      this.buffer = this.buffer.slice(end + 2)
      size += line.length + 2
      const match = line.match(/^(\d{3})(?:([ -])(.*))?$/)
      if (!match || (code && code !== Number(match[1])) || size > 65536) throw new Error('SMTP 响应无效')
      code = Number(match[1])
      lines.push(match[3] || '')
      if (match[2] !== '-') return { code, lines }
    }
  }

  async command(command: string): Promise<Reply> {
    await this.writer!.write(encoder.encode(command + '\r\n'))
    return this.reply()
  }

  expect(reply: Reply, codes: number[], stage: string): Reply {
    if (!codes.includes(reply.code)) throw new Error(`SMTP ${stage}失败（${reply.code}）`)
    return reply
  }

  release() {
    this.reader?.releaseLock()
    this.writer?.releaseLock()
    this.reader = undefined
    this.writer = undefined
  }

  close() {
    // 先关闭 socket，终止超时后的未完成读写；清理错误不能覆盖真实发送结果。
    if (this.socket) void this.socket.close().catch(() => {})
    this.release()
  }
}

async function runSmtp(config: SmtpConfig, email?: OutgoingEmail): Promise<string | null> {
  validateSmtpConfig(config)
  const message = email ? buildMessage(config.from, email) : null
  const domain = message?.domain || mailbox(config.from).address.split('@')[1]
  const session = new SmtpSession()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SMTP 连接或发送超时')), 20000) })
  try {
    return await Promise.race([timeout, (async () => {
      const { connect } = await import('cloudflare:sockets')
      await session.attach(connect({ hostname: config.host, port: config.port }, { secureTransport: config.encryption === 'ssl' ? 'on' : config.encryption === 'starttls' ? 'starttls' : 'off', allowHalfOpen: false }))
      session.expect(await session.reply(), [220], '连接')
      let hello = session.expect(await session.command(`EHLO ${domain}`), [250], '握手')
      if (config.encryption === 'starttls') {
        if (!hello.lines.some(line => /^STARTTLS(?:\s|$)/i.test(line))) throw new Error('SMTP 服务器不支持 STARTTLS')
        session.expect(await session.command('STARTTLS'), [220], 'TLS 升级')
        session.release()
        session.buffer = ''
        session.decoder = new TextDecoder()
        await session.attach(session.socket!.startTls())
        hello = session.expect(await session.command(`EHLO ${domain}`), [250], '握手')
      }
      const auth = hello.lines.find(line => /^AUTH[ =]/i.test(line))?.slice(5).toUpperCase().split(/\s+/) || []
      if (auth.includes('PLAIN')) {
        const credentials = base64(`\0${config.user}\0${config.password}`)
        let reply = await session.command(`AUTH PLAIN ${credentials}`)
        if (reply.code === 334) reply = await session.command(credentials)
        session.expect(reply, [235], '认证')
      } else if (auth.includes('LOGIN')) {
        session.expect(await session.command('AUTH LOGIN'), [334], '认证')
        session.expect(await session.command(base64(config.user)), [334], '认证')
        session.expect(await session.command(base64(config.password)), [235], '认证')
      } else throw new Error('SMTP 服务器不支持 PLAIN 或 LOGIN 认证')
      if (message) {
        session.expect(await session.command(`MAIL FROM:<${message.sender}>`), [250], '发件人校验')
        for (const recipient of message.recipients) session.expect(await session.command(`RCPT TO:<${recipient}>`), [250, 251], '收件人校验')
        session.expect(await session.command('DATA'), [354], '投递准备')
        await session.writer!.write(encoder.encode(message.data.replace(/^\./gm, '..') + '.\r\n'))
        session.expect(await session.reply(), [250], '投递')
      }
      // DATA 已获确认，关闭连接失败不能让调用方重发已接收的邮件。
      return message?.id || null
    })()])
  } finally {
    if (timer) clearTimeout(timer)
    session.close()
  }
}

export async function sendSmtpEmail(config: SmtpConfig, email: OutgoingEmail): Promise<string> {
  return (await runSmtp(config, email))!
}

export async function verifySmtpConnection(config: SmtpConfig): Promise<void> {
  await runSmtp(config)
}
