-- Bank-transfer refunds are inserted as 'pending' and later flipped to
-- 'succeeded' via UPDATE once an admin confirms the transfer. The existing
-- payment_refunds_to_allocations trigger only fires on INSERT, so those
-- refunds were never accounted into refund_allocations and the
-- refund_allocations_cannot_exceed_payment guardrail never ran for them.
-- Mirror the INSERT trigger for the pending -> succeeded UPDATE transition.
CREATE TRIGGER IF NOT EXISTS payment_refund_completion_to_allocations
AFTER UPDATE ON payment_refunds
WHEN NEW.status = 'succeeded' AND OLD.status = 'pending'
BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;
