-- Split every payment into its business components. The source payment stays
-- immutable; allocation rows are append-only accounting facts.
CREATE TRIGGER IF NOT EXISTS payments_to_allocations
AFTER INSERT ON payments BEGIN
  INSERT INTO payment_allocations (id, payment_id, order_id, allocation_type, amount)
  SELECT 'pa-' || lower(hex(randomblob(16))), NEW.id, NEW.rental_id, 'RENTAL', NEW.rental_amount
  WHERE NEW.rental_amount <> 0;
  INSERT INTO payment_allocations (id, payment_id, order_id, allocation_type, amount)
  SELECT 'pa-' || lower(hex(randomblob(16))), NEW.id, NEW.rental_id, 'DEPOSIT', NEW.deposit_amount
  WHERE NEW.deposit_amount <> 0;
END;

-- A refund is allocated to its originating payment. For mixed payments the
-- service selects/creates one refund per source payment, so the total can
-- never exceed the sum of settled payment sources.
CREATE TRIGGER IF NOT EXISTS payment_refunds_to_allocations
AFTER INSERT ON payment_refunds WHEN NEW.status = 'succeeded' BEGIN
  INSERT OR IGNORE INTO refund_allocations (id, refund_id, payment_id, amount)
  VALUES ('ra-' || lower(hex(randomblob(16))), NEW.id, NEW.payment_id, NEW.refund_amount);
END;

CREATE TRIGGER IF NOT EXISTS refund_allocations_cannot_exceed_payment
BEFORE INSERT ON refund_allocations BEGIN
  SELECT CASE WHEN NEW.amount > (
    COALESCE((SELECT amount FROM payments WHERE id = NEW.payment_id), 0) -
    COALESCE((SELECT SUM(amount) FROM refund_allocations WHERE payment_id = NEW.payment_id), 0)
  ) THEN RAISE(ABORT, 'refund allocation exceeds paid amount') END;
END;
