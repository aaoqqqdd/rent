/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReceiptPdf, bytesToBase64 } from '../src/services/receiptPdf'
import { buildTaxInvoiceDocument } from '../src/services/notifications'

test('receipt PDF is a valid single-page PDF with the important receipt fields', () => {
  const pdf = buildReceiptPdf({
    companyName: 'PC Rental',
    companyAbn: '12 345 678 901',
    companyEmail: 'support@example.com',
    customerName: 'Customer',
    customerEmail: 'customer@example.com',
    orderNumber: 'ORD-123',
    documentNumber: 'INV-123',
    issuedAt: '2026-09-29 12:00:00',
    paymentMethod: 'CARD',
    transactionId: 'TXN-123',
    deviceName: 'Gaming PC',
    startDate: '2026-10-01',
    endDate: '2026-10-08',
    rentalPeriod: 7,
    subtotal: 100,
    gstAmount: 10,
    depositAmount: 50,
    processingFee: 2.5,
    discountAmount: 5,
    totalAmount: 157.5,
    documentId: 'inv-123',
    template: { title: 'CUSTOM TAX INVOICE', totalLabel: 'AMOUNT DUE' },
  })
  const source = new TextDecoder().decode(pdf)
  assert.match(source, /^%PDF-1\.4\n/)
  assert.match(source, /CUSTOM TAX INVOICE/)
  assert.match(source, /AMOUNT DUE/)
  assert.match(source, /ITEM/)
  assert.match(source, /QTY/)
  assert.match(source, /PRICE/)
  assert.match(source, /ABN 12 345 678 901/)
  assert.match(source, /INV-123/)
  assert.match(source, /ORD-123/)
  assert.match(source, /\/Count 1/)
  assert.match(source, /startxref/)
  assert.match(bytesToBase64(pdf), /^JVBERi0xLjQK/)
})

test('payment receipt and tax invoice use distinct document titles and numbers', () => {
  const pdf = buildReceiptPdf({
    companyName: 'PC Rental',
    customerName: 'Customer',
    customerEmail: 'customer@example.com',
    orderNumber: 'ORD-123',
    documentNumber: 'RCP-123',
    issuedAt: '2026-09-29',
    paymentMethod: 'CARD',
    deviceName: 'Gaming PC',
    subtotal: 100,
    gstAmount: 10,
    depositAmount: 0,
    processingFee: 0,
    discountAmount: 0,
    totalAmount: 110,
    template: { title: 'PAYMENT RECEIPT', documentNumberLabel: 'RECEIPT NO.' },
  })
  const source = new TextDecoder().decode(pdf)
  assert.match(source, /PAYMENT RECEIPT/)
  assert.match(source, /RECEIPT NO\. RCP-123/)
  assert.doesNotMatch(source, /TAX INVOICE/)
})

test('tax invoice download only depends on stable payment fields', async () => {
  const queries: string[] = []
  const db = {
    prepare(sql: string) {
      queries.push(sql)
      return {
        bind() { return this },
        async first() {
          if (sql.includes('FROM users')) return { name: 'Customer', email: 'customer@example.com', phone: '' }
          if (sql.includes('FROM devices')) return { name: 'Gaming PC' }
          if (sql.includes('FROM invoices')) return { id: 'inv-1', invoice_number: 'INV-123', receipt_number: 'RCP-123', subtotal: 100, gst_amount: 10, deposit_amount: 50, processing_fee: 0, total_amount: 160, currency: 'AUD', issued_at: '2026-09-29 12:00:00' }
          if (sql.includes('FROM payments')) return { paid_at: '2026-09-29 12:00:00', payment_method: 'bank_transfer', payment_provider: 'internal', transaction_id: 'TXN-123', stripe_payment_intent_id: null }
          return null
        },
      }
    },
  }
  const document = await buildTaxInvoiceDocument(
      { env: { RENT: db }, req: { url: 'https://rent.example/' } } as any,
    { id: 'order-1', userId: 'customer-1', deviceId: 'device-1', orderNo: 'ORD-123', startDate: '2026-10-01', endDate: '2026-10-08', rentalPeriod: 7, totalAmount: 160, depositAmount: 50 },
    { contractNumber: 'CT-123' },
  )
  assert.ok(document)
  assert.equal(document.documentNumber, 'INV-123')
  assert.match(new TextDecoder().decode(document.pdf), /^%PDF-1\.4\n/)
  assert.equal(queries.some(sql => sql.includes('square_payment_id')), false)
})
