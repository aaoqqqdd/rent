-- Deposit refunds may be processed in several settlements. The original
-- one-refund-only index prevents legitimate partial refunds, so replace it
-- with a history index and enforce the cumulative ceiling in the database.
DROP INDEX IF EXISTS idx_payment_refunds_deposit_once;

CREATE INDEX IF NOT EXISTS idx_payment_refunds_deposit_history
ON payment_refunds(order_id, payment_id, status, created_at);

CREATE TRIGGER IF NOT EXISTS deposit_refunds_cannot_exceed_paid_deposit
BEFORE INSERT ON payment_refunds
WHEN NEW.type = 'deposit' AND NEW.status = 'succeeded'
BEGIN
  SELECT RAISE(ABORT, 'deposit refund exceeds remaining refundable amount')
  WHERE NEW.refund_amount > (
    COALESCE((SELECT deposit_amount FROM payments WHERE id = NEW.payment_id), 0) -
    COALESCE((SELECT SUM(refund_amount) FROM payment_refunds
      WHERE payment_id = NEW.payment_id AND type = 'deposit' AND status = 'succeeded'), 0)
  );
END;
