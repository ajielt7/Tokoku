-- Simpan jarak hitung untuk ongkir kurir lokal tanpa menyimpan koordinat rumah pelanggan.
ALTER TABLE orders ADD COLUMN shipping_distance_km REAL
  CHECK (shipping_distance_km IS NULL OR shipping_distance_km >= 0);
