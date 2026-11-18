CREATE TABLE visitor_analytics_queue (
  event_id TEXT PRIMARY KEY NOT NULL,
  visitor_id TEXT NOT NULL,
  visited_at TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX'
);

CREATE INDEX idx_visitor_analytics_queue_visited_at
  ON visitor_analytics_queue(visited_at, event_id);

CREATE TABLE visitor_analytics_push_state (
  id TEXT PRIMARY KEY NOT NULL,
  last_sent_at TEXT NOT NULL
);