UPDATE contracts
SET contract_data = json_remove(
  contract_data,
  '$.customer_address',
  '$.customer_dob',
  '$.customer_driver_expiry',
  '$.customer_country',
  '$.emergency_contact',
  '$.emergency_phone'
);

ALTER TABLE contracts DROP COLUMN customer_id_type;
ALTER TABLE contracts DROP COLUMN customer_id_number;

