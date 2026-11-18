-- Bukti transfer refund disimpan privat di ImageKit; D1 hanya menyimpan metadata.
ALTER TABLE refund_requests ADD COLUMN proof_file_id TEXT;
ALTER TABLE refund_requests ADD COLUMN proof_file_path TEXT;
ALTER TABLE refund_requests ADD COLUMN proof_uploaded_at TEXT;