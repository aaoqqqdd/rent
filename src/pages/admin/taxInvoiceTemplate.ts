/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import { buildLayout, getSystemSettings } from '../../site'

export function renderAdminTaxInvoiceTemplate(user: any): string {
  const template = (getSystemSettings().taxInvoiceTemplate || {}) as Record<string, string>
  const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x] || x))
  const input = (id: string, label: string, key: string) => `<div class="form-group"><label class="form-label" for="${id}">${label}</label><input class="form-control" id="${id}" value="${esc(template[key])}"></div>`
  const fields = [
    ['taxInvoiceTitle', 'Document title', 'title'],
    ['taxInvoiceAbnLabel', 'ABN label', 'abnLabel'],
    ['taxInvoiceDocumentNumberLabel', 'Invoice number label', 'documentNumberLabel'],
    ['taxInvoiceIssuedLabel', 'Issued label', 'issuedLabel'],
    ['taxInvoiceBilledToLabel', 'Billed to label', 'billedToLabel'],
    ['taxInvoiceRentalOrderLabel', 'Rental order label', 'rentalOrderLabel'],
    ['taxInvoiceDescriptionLabel', 'Description label', 'descriptionLabel'],
    ['taxInvoiceItemLabel', 'Item column label', 'itemLabel'],
    ['taxInvoiceQuantityLabel', 'Quantity column label', 'quantityLabel'],
    ['taxInvoicePriceLabel', 'Price column label', 'priceLabel'],
    ['taxInvoiceAmountLabel', 'Amount label', 'amountLabel'],
    ['taxInvoiceSubtotalLabel', 'Subtotal label', 'subtotalLabel'],
    ['taxInvoiceTotalLabel', 'Total label', 'totalLabel'],
    ['taxInvoiceContractLabel', 'Contract label', 'contractLabel'],
    ['taxInvoicePaymentLabel', 'Payment label', 'paymentLabel'],
    ['taxInvoicePaidLabel', 'Paid label', 'paidLabel'],
    ['taxInvoiceGstLabel', 'GST label', 'gstLabel'],
    ['taxInvoiceDepositLabel', 'Deposit label', 'depositLabel'],
    ['taxInvoiceProcessingFeeLabel', 'Processing fee label', 'processingFeeLabel'],
    ['taxInvoiceDiscountLabel', 'Discount label', 'discountLabel'],
    ['taxInvoicePaymentReferenceLabel', 'Payment reference label', 'paymentReferenceLabel'],
    ['taxInvoiceQuestionsLabel', 'Questions label', 'questionsLabel'],
  ].map(([id, label, key]) => input(id, label, key)).join('')
  const textareas = [
    ['taxInvoiceInvoiceMessage', 'Invoice message', 'invoiceMessage'],
    ['taxInvoiceThankYouText', 'Thank-you text', 'thankYouText'],
    ['taxInvoiceRecordNote', 'Record note', 'recordNote'],
    ['taxInvoiceGeneratedByText', 'Generated-by text', 'generatedByText'],
  ].map(([id, label, key]) => `<div class="form-group"><label class="form-label" for="${id}">${label}</label><textarea class="form-control" id="${id}" rows="2">${esc(template[key])}</textarea></div>`).join('')
  const script = `<script>(()=>{const form=document.getElementById('taxInvoiceTemplateForm');if(!form)return;const input=id=>String(document.getElementById(id)?.value||'').trim();const save=async()=>{const taxInvoiceTemplate={title:input('taxInvoiceTitle'),abnLabel:input('taxInvoiceAbnLabel'),documentNumberLabel:input('taxInvoiceDocumentNumberLabel'),issuedLabel:input('taxInvoiceIssuedLabel'),billedToLabel:input('taxInvoiceBilledToLabel'),rentalOrderLabel:input('taxInvoiceRentalOrderLabel'),contractLabel:input('taxInvoiceContractLabel'),paymentLabel:input('taxInvoicePaymentLabel'),paidLabel:input('taxInvoicePaidLabel'),descriptionLabel:input('taxInvoiceDescriptionLabel'),itemLabel:input('taxInvoiceItemLabel'),quantityLabel:input('taxInvoiceQuantityLabel'),priceLabel:input('taxInvoicePriceLabel'),amountLabel:input('taxInvoiceAmountLabel'),subtotalLabel:input('taxInvoiceSubtotalLabel'),gstLabel:input('taxInvoiceGstLabel'),depositLabel:input('taxInvoiceDepositLabel'),processingFeeLabel:input('taxInvoiceProcessingFeeLabel'),discountLabel:input('taxInvoiceDiscountLabel'),totalLabel:input('taxInvoiceTotalLabel'),paymentReferenceLabel:input('taxInvoicePaymentReferenceLabel'),invoiceMessage:input('taxInvoiceInvoiceMessage'),questionsLabel:input('taxInvoiceQuestionsLabel'),thankYouText:input('taxInvoiceThankYouText'),recordNote:input('taxInvoiceRecordNote'),generatedByText:input('taxInvoiceGeneratedByText')};const response=await fetch('/admin/settings/save',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify({taxInvoiceTemplate})});const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{};}catch{data={error:raw||'保存失败'};}if(!response.ok||!data.success)throw new Error(data.error||'保存失败');alert('PDF 模板已保存');window.location.reload();};form.addEventListener('submit',event=>{event.preventDefault();save().catch(error=>alert(error instanceof Error?error.message:'保存失败'));});})();</script>`
  const body = `<div class="page-header"><div><p class="section-code">FINANCE / DOCUMENTS</p><h2>Tax Invoice PDF 模板</h2><p>专门编辑付款成功后发送给客户的 A4 英文 Tax Invoice。保存后，新生成的 PDF 会使用这些标题、字段名和页脚文案。</p></div><a class="button button-secondary" href="/admin/settings">返回系统设置</a></div><form id="taxInvoiceTemplateForm" class="panel" novalidate><div class="section-title"><h3>英文 PDF 内容</h3><span class="section-note">建议保留英文，以确保标准 PDF 字体兼容</span></div><div class="grid grid-2">${fields}</div><div class="grid grid-2">${textareas}</div><div class="record-archive__actions"><button class="button button-primary" type="submit">保存 PDF 模板</button></div></form>${script}`
  return buildLayout('Tax Invoice PDF 模板 - 电脑租赁管理系统', body, user)
}
