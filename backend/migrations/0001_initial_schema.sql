-- Skema awal toko. Jangan simpan rahasia pembayaran atau file biner di D1.

CREATE TABLE product_categories (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_amount INTEGER NOT NULL CHECK (price_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  fixed_size TEXT,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE product_templates (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  source_asset_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (product_id, version)
);

CREATE TABLE customization_fields (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES product_templates(id) ON DELETE RESTRICT,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'number')),
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  max_length INTEGER CHECK (max_length IS NULL OR max_length > 0),
  validation_rules_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(validation_rules_json)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (template_id, field_key)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  public_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  shipping_address TEXT NOT NULL,
  subtotal_amount INTEGER NOT NULL CHECK (subtotal_amount >= 0),
  shipping_amount INTEGER NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  order_status TEXT NOT NULL DEFAULT 'new'
    CHECK (order_status IN ('new', 'accepted', 'completed', 'cancelled')),
  production_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (production_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  customer_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  product_slug_snapshot TEXT NOT NULL,
  unit_price_amount INTEGER NOT NULL CHECK (unit_price_amount >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_amount INTEGER NOT NULL CHECK (line_total_amount >= 0),
  fixed_size_snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE order_customizations (
  order_item_id TEXT PRIMARY KEY NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  template_id TEXT REFERENCES product_templates(id) ON DELETE SET NULL,
  template_version_snapshot INTEGER,
  values_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(values_json)),
  preview_asset_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  shipment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (shipment_status IN ('pending', 'shipped', 'delivered', 'failed', 'returned')),
  shipped_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE order_files (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE RESTRICT,
  file_kind TEXT NOT NULL CHECK (file_kind IN ('preview', 'production', 'other')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  asset_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (order_id, order_item_id, file_kind, version)
);

CREATE TABLE order_status_history (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status_type TEXT NOT NULL CHECK (status_type IN ('order', 'production', 'payment', 'shipment')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'admin', 'customer', 'provider')),
  actor_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_products_category_active ON products(category_id, is_active);
CREATE INDEX idx_product_templates_product_active ON product_templates(product_id, is_active);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_status_created_at ON orders(order_status, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_order_created_at ON payments(order_id, created_at DESC);
CREATE INDEX idx_shipments_order_created_at ON shipments(order_id, created_at DESC);
CREATE INDEX idx_order_files_order ON order_files(order_id);
CREATE INDEX idx_order_status_history_order_created_at ON order_status_history(order_id, created_at DESC);
