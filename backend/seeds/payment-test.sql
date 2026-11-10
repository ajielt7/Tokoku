-- Fixture lokal untuk simulasi order/pembayaran/refund. Jangan jalankan pada database remote.
INSERT OR REPLACE INTO product_categories (id, slug, name, description, sort_order, is_active)
VALUES ('test-category-home', 'produk-uji', 'Produk Uji Lokal', 'Data fixture simulasi; bukan katalog rilis.', 1, 1);

INSERT OR REPLACE INTO products (
  id, category_id, slug, name, description, price_amount, currency,
  fixed_size, image_url, image_alt, shipping_weight_grams, is_active
) VALUES (
  'test-product-house-number', 'test-category-home', 'nomor-rumah-uji',
  'Nomor Rumah Akrilik (Uji Lokal)',
  'Fixture lokal: akrilik hitam 3 mm, 20 × 12 cm, custom nomor dan area.',
  50000, 'IDR', '20 × 12 cm', NULL, NULL, 650, 1
);

INSERT OR REPLACE INTO product_templates (id, product_id, version, is_active)
VALUES ('test-template-house-number-v1', 'test-product-house-number', 1, 1);

INSERT OR REPLACE INTO customization_fields (
  id, template_id, field_key, label, input_type, is_required,
  max_length, validation_rules_json, sort_order
) VALUES
  ('test-field-house-number', 'test-template-house-number-v1', 'house_number', 'Nomor rumah', 'text', 1, 3,
   '{"pattern":"^[A-Za-z0-9]{1,3}$","uppercase":true}', 1),
  ('test-field-area-name', 'test-template-house-number-v1', 'area_name', 'Nama area (opsional)', 'text', 0, 14,
   '{"pattern":"^[\\p{L}\\p{N} ./-]{1,14}$","unicode":true}', 2);
