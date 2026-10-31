/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

type Connector = typeof import('cloudflare:sockets').connect
let connector: Connector = () => { throw new Error('Tests must provide a simulated SMTP socket') }

export const setSmtpConnector = (value: Connector) => { connector = value }
export const connect: Connector = (address, options) => connector(address, options)
