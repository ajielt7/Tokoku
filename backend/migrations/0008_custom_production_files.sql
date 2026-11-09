ALTER TABLE order_customizations ADD COLUMN field_snapshot_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(field_snapshot_json));

CREATE TABLE order_production_files (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  format TEXT NOT NULL CHECK (format IN ('dxf')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/dxf',
  content_text TEXT NOT NULL CHECK (length(content_text) <= 262144),
  template_version_snapshot INTEGER,
  customization_snapshot_json TEXT NOT NULL CHECK (json_valid(customization_snapshot_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (order_item_id, version)
);

CREATE INDEX idx_order_production_files_item ON order_production_files(order_item_id, version DESC);
