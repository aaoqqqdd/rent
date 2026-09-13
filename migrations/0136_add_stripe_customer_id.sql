-- Saved cards (via SetupIntent) must be attached to a Stripe Customer to be reused
-- for later off-session charges (rent payment, deposit authorization, deposit
-- settlement). Without a Customer, Stripe rejects the second reuse with:
-- "The provided PaymentMethod cannot be attached. To reuse a PaymentMethod,
-- you must attach it to a Customer first."
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
