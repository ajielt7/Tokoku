ALTER TABLE orders
  ADD COLUMN shipping_latitude REAL
    CHECK (shipping_latitude IS NULL OR (shipping_latitude >= -90 AND shipping_latitude <= 90));

ALTER TABLE orders
  ADD COLUMN shipping_longitude REAL
    CHECK (shipping_longitude IS NULL OR (shipping_longitude >= -180 AND shipping_longitude <= 180));