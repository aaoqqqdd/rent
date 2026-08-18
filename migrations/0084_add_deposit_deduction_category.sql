ALTER TABLE payment_refunds ADD COLUMN deduction_category TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_refunds_deduction_category
  ON payment_refunds(deduction_category)
  WHERE deduction_category IS NOT NULL;
