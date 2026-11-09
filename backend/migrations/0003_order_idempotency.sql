ALTER TABLE orders ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_orders_idempotency_key
  ON orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX idx_product_templates_one_active
  ON product_templates(product_id)
  WHERE is_active = 1;
