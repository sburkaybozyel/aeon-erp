CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  target_type TEXT NOT NULL DEFAULT 'table',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, created_at DESC);

INSERT OR IGNORE INTO menu_items (id, name, description, category, price) VALUES
  ('rk-breakfast', 'Serpme Kahvaltı', 'Yerel ürünlerle butik kahvaltı', 'Kahvaltı', 650),
  ('rk-burger', 'Ege Burger', 'Ev yapımı ekmek, ada köftesi, patates', 'Ana Yemek', 520),
  ('rk-seabass', 'Izgara Levrek', 'Günün balığı, mevsim salatası', 'Ana Yemek', 890),
  ('rk-salad', 'Datça Salatası', 'Yeşillik, narenciye ve keçi peyniri', 'Başlangıç', 360),
  ('rk-lemonade', 'Ev Yapımı Limonata', 'Taze nane ve limon', 'İçecek', 180),
  ('rk-coffee', 'Türk Kahvesi', 'Lokum ile servis edilir', 'İçecek', 140);

INSERT OR IGNORE INTO tables (id, label, target_type) VALUES
  ('rk-table-01', 'Masa 1', 'table'),
  ('rk-table-02', 'Masa 2', 'table'),
  ('rk-table-03', 'Masa 3', 'table'),
  ('rk-room-101', 'Oda 101', 'room');
