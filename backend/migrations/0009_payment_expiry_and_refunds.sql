ALTER TABLE orders ADD COLUMN payment_expires_at TEXT;
UPDATE orders
SET payment_expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+24 hours')
WHERE payment_expires_at IS NULL;

CREATE INDEX idx_orders_payment_expires_at ON orders(payment_expires_at);

CREATE TABLE refund_requests (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'processed')),
  customer_note TEXT,
  admin_note TEXT,
  requested_at TEXT NOT NULL,
  approved_at TEXT,
  refund_due_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_refund_requests_status_created ON refund_requests(status, requested_at DESC);
