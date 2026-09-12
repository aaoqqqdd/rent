-- Website orders are paid through Stripe after contract signing. Repair legacy
-- website orders that inherited the old bank-transfer default, but preserve
-- any order that already has a bank-transfer payment or proof.
UPDATE orders
SET paymentMethod = 'card', updatedAt = CURRENT_TIMESTAMP
WHERE paymentMethod = 'bank_transfer'
  AND status IN ('approved', 'pending_payment')
  AND EXISTS (
    SELECT 1
    FROM contracts c
    WHERE c.orderId = orders.id
      AND c.deleted_at IS NULL
      AND (
        json_extract(c.contract_data, '$.website_order') = 1
        OR orders.status = 'approved'
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.rental_id = orders.id
      AND p.payment_method = 'bank_transfer'
      AND p.status IN ('pending', 'paid')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM payment_proofs pp
    JOIN payments p ON p.id = pp.payment_id
    WHERE p.rental_id = orders.id
      AND p.payment_method = 'bank_transfer'
      AND pp.status IN ('submitted', 'approved')
  );
