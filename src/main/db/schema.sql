CREATE TABLE IF NOT EXISTS holders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_payload TEXT NOT NULL,
  status TEXT NOT NULL,
  last_holder_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (last_holder_id) REFERENCES holders(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  holder_id TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (key_id) REFERENCES keys(id),
  FOREIGN KEY (holder_id) REFERENCES holders(id)
);
