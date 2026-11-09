-- Metadata bukti transfer disimpan di D1; berkas disimpan privat di ImageKit.
ALTER TABLE payments ADD COLUMN proof_file_id TEXT;
ALTER TABLE payments ADD COLUMN proof_file_path TEXT;
ALTER TABLE payments ADD COLUMN proof_uploaded_at TEXT;
