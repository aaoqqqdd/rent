ALTER TABLE orders ADD COLUMN startPeriod TEXT NOT NULL DEFAULT 'AM' CHECK(startPeriod IN ('AM', 'PM'));
ALTER TABLE orders ADD COLUMN endPeriod TEXT NOT NULL DEFAULT 'AM' CHECK(endPeriod IN ('AM', 'PM'));
ALTER TABLE orders ADD COLUMN pickupTimeSlot TEXT;
ALTER TABLE orders ADD COLUMN returnTimeSlot TEXT;
ALTER TABLE orders ADD COLUMN pickupLocation TEXT;
ALTER TABLE orders ADD COLUMN returnLocation TEXT;
