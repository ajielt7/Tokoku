-- Ongkir RajaOngkir dan referensi transfer manual.
ALTER TABLE products
  ADD COLUMN shipping_weight_grams INTEGER NOT NULL DEFAULT 500 CHECK (shipping_weight_grams > 0);

ALTER TABLE orders ADD COLUMN shipping_destination_id TEXT;
ALTER TABLE orders ADD COLUMN shipping_destination_label TEXT;
ALTER TABLE orders ADD COLUMN shipping_courier_code TEXT;
ALTER TABLE orders ADD COLUMN shipping_courier_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_service TEXT;

ALTER TABLE payments ADD COLUMN payment_reference TEXT;
CREATE UNIQUE INDEX idx_payments_payment_reference ON payments(payment_reference)
  WHERE payment_reference IS NOT NULL;
