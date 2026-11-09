-- Hanya untuk database lokal: seluruh produk dan harga di sini bersifat contoh.
-- Jangan jalankan file ini terhadap database cloud/produksi.

INSERT OR IGNORE INTO product_categories (id, slug, name, description, sort_order, is_active)
VALUES
  ('demo-category-nomor-rumah', 'nomor-rumah', 'Nomor rumah', 'Contoh desain nomor rumah. Data dan ukuran belum final.', 1, 1),
  ('demo-category-plang-nama', 'plang-nama', 'Plang nama', 'Contoh desain plang nama rumah. Data dan ukuran belum final.', 2, 1);

INSERT OR IGNORE INTO products (id, category_id, slug, name, description, price_amount, currency, fixed_size, image_url, image_alt, is_active)
VALUES
  ('demo-product-nomor-minimal', 'demo-category-nomor-rumah', 'nomor-rumah-minimal', 'Nomor Rumah Minimal', 'Contoh desain nomor rumah dengan tampilan sederhana. Angka dapat diubah sesuai ketentuan desain.', 150000, 'IDR', '30 × 15 cm (contoh)', NULL, NULL, 1),
  ('demo-product-nomor-klasik', 'demo-category-nomor-rumah', 'nomor-rumah-klasik', 'Nomor Rumah Klasik', 'Contoh desain nomor rumah bergaya klasik. Angka dapat diubah sesuai ketentuan desain.', 210000, 'IDR', '25 × 12 cm (contoh)', NULL, NULL, 1),
  ('demo-product-plang-nama', 'demo-category-plang-nama', 'plang-nama-rumah', 'Plang Nama Rumah', 'Contoh desain plang nama rumah. Teks dapat diubah sesuai ketentuan desain.', 185000, 'IDR', '20 × 8 cm (contoh)', NULL, NULL, 1);

INSERT OR IGNORE INTO product_templates (id, product_id, version, is_active)
VALUES
  ('demo-template-nomor-minimal-v1', 'demo-product-nomor-minimal', 1, 1),
  ('demo-template-nomor-klasik-v1', 'demo-product-nomor-klasik', 1, 1),
  ('demo-template-plang-nama-v1', 'demo-product-plang-nama', 1, 1);

INSERT OR IGNORE INTO customization_fields (id, template_id, field_key, label, input_type, is_required, max_length, sort_order)
VALUES
  ('demo-field-nomor-minimal', 'demo-template-nomor-minimal-v1', 'house_number', 'Angka rumah', 'number', 1, 6, 1),
  ('demo-field-nomor-klasik', 'demo-template-nomor-klasik-v1', 'house_number', 'Angka rumah', 'number', 1, 6, 1),
  ('demo-field-plang-nama', 'demo-template-plang-nama-v1', 'house_name', 'Nama rumah', 'text', 1, 32, 1);
