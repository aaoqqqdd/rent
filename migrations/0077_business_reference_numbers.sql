-- Business-facing numbers are separate from internal IDs and Stripe references.
ALTER TABLE invoices ADD COLUMN receipt_number TEXT;
ALTER TABLE payment_refunds ADD COLUMN refund_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_receipt_number ON invoices(receipt_number) WHERE receipt_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_refund_number ON payment_refunds(refund_number) WHERE refund_number IS NOT NULL;
