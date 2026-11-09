CREATE TABLE admin_devices (
  id TEXT PRIMARY KEY NOT NULL,
  registration_token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Ruma Admin',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_admin_devices_last_seen ON admin_devices(last_seen_at DESC);
CREATE UNIQUE INDEX idx_shipments_one_per_order ON shipments(order_id);
