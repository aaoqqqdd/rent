/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReceiptPdf, bytesToBase64 } from '../src/services/receiptPdf'

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
