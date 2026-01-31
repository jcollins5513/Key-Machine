CREATE TABLE IF NOT EXISTS holders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_initial TEXT NOT NULL,
  department TEXT,
  position TEXT,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  allowed_checkout INTEGER NOT NULL,
  is_admin INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag_payload TEXT,
  stock_number TEXT UNIQUE,
  vin_last8 TEXT,
  year TEXT,
  make TEXT,
  model TEXT,
  photo_path TEXT,
  tag_paired INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  last_holder_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (last_holder_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  holder_id TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (key_id) REFERENCES keys(id),
  FOREIGN KEY (holder_id) REFERENCES users(id)
);
