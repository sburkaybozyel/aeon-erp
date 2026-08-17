CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'clean_vacant',
  guest_name TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  room_id TEXT REFERENCES rooms(id),
  arrival_date TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS precheckins (
  id TEXT PRIMARY KEY,
  reservation_id TEXT,
  guest_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reception_tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  room_id TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO rooms (id, room_number, room_type) VALUES
  ('rcp-room-101', '101', 'Deluxe'),
  ('rcp-room-102', '102', 'Deluxe'),
  ('rcp-room-103', '103', 'Standard'),
  ('rcp-room-104', '104', 'Standard'),
  ('rcp-room-201', '201', 'Suite'),
  ('rcp-room-202', '202', 'Suite'),
  ('rcp-room-203', '203', 'Standard'),
  ('rcp-room-204', '204', 'Standard');
