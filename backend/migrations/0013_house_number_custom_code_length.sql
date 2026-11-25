UPDATE customization_fields
SET max_length = 4,
    validation_rules_json = '{"pattern":"^[A-Za-z0-9]{1,4}$","uppercase":true}'
WHERE field_key = 'house_number'
  AND template_id IN (
    SELECT t.id
    FROM product_templates AS t
    JOIN products AS p ON p.id = t.product_id
    WHERE p.slug LIKE 'nomor-rumah-%'
  );
