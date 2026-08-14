-- Clear test/business data while preserving the requested admin and device.
-- Preserved user: AD-00000001
-- Preserved device: RT-HP-000001

PRAGMA foreign_keys = OFF;

DELETE FROM payment_proofs;
DELETE FROM payment_refunds;
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM balance_transactions;
DELETE FROM balance_topups;
DELETE FROM commission_withdrawals;
DELETE FROM commission_records;
DELETE FROM contracts;
DELETE FROM rentals;
DELETE FROM orders;
DELETE FROM addresses;
DELETE FROM device_maintenance;
DELETE FROM device_entries;
DELETE FROM sign_sessions;
DELETE FROM email_verifications;
DELETE FROM notifications;
DELETE FROM login_history;
DELETE FROM login_attempts;
DELETE FROM auth_sessions;
DELETE FROM security_rate_limits;
DELETE FROM error_logs;
DELETE FROM stripe_webhook_events;

DELETE FROM users WHERE id <> 'AD-00000001';
DELETE FROM devices WHERE id <> 'RT-HP-000001';

PRAGMA foreign_keys = ON;
