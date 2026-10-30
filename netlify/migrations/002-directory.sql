CREATE TABLE IF NOT EXISTS directory_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  floor SMALLINT NOT NULL CHECK (floor BETWEEN 1 AND 6),
  phone TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS directory_contacts_floor_name_idx
  ON directory_contacts (floor, name);
