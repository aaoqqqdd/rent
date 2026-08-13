-- Remove the built-in demo fixtures from deployments that already ran the old seed.
DELETE FROM payment_proofs WHERE payment_id IN (SELECT id FROM payments WHERE rental_id IN ('o-1', 'o-2', 'o-3'));
DELETE FROM payment_refunds WHERE order_id IN ('o-1', 'o-2', 'o-3');
DELETE FROM payments WHERE rental_id IN ('o-1', 'o-2', 'o-3');
DELETE FROM contracts WHERE orderId IN ('o-1', 'o-2', 'o-3');
DELETE FROM notifications WHERE order_id IN ('o-1', 'o-2', 'o-3') OR recipient_id IN ('u-admin', 'u-staff', 'u-customer') OR sender_id IN ('u-admin', 'u-staff', 'u-customer');
DELETE FROM auth_sessions WHERE user_id IN ('u-admin', 'u-staff', 'u-customer');
DELETE FROM balance_transactions WHERE user_id IN ('u-admin', 'u-staff', 'u-customer');
DELETE FROM orders WHERE id IN ('o-1', 'o-2', 'o-3');
DELETE FROM devices WHERE id IN ('d-mbp14', 'd-xps13', 'd-thinkpad', 'd-imac');
DELETE FROM users WHERE id IN ('u-admin', 'u-staff', 'u-customer');
