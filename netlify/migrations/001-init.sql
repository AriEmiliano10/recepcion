CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  floor SMALLINT NOT NULL CHECK (floor BETWEEN 1 AND 6)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('RECEPCION', 'EMPRESA', 'PISO')),
  company_id TEXT REFERENCES companies(id),
  floor SMALLINT CHECK (floor BETWEEN 1 AND 6),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK ((role = 'EMPRESA' AND company_id IS NOT NULL) OR (role <> 'EMPRESA' AND company_id IS NULL)),
  CHECK ((role = 'PISO' AND floor IS NOT NULL) OR (role <> 'PISO' AND floor IS NULL))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  origin TEXT NOT NULL,
  company_id TEXT REFERENCES companies(id),
  floor SMALLINT NOT NULL CHECK (floor BETWEEN 1 AND 6),
  visit_date DATE NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS visits_date_idx ON visits (visit_date DESC);
CREATE INDEX IF NOT EXISTS visits_company_idx ON visits (company_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS visits_floor_idx ON visits (floor, visit_date DESC);

INSERT INTO companies (id, name, floor) VALUES
  ('emp-001', 'Consultores Alfa', 3),
  ('emp-003', 'GRUPO INTEGRAL GLEOS, S.A. DE C.V.', 1),
  ('emp-004', 'CASA TAVINHO', 1),
  ('emp-005', 'STE', 2),
  ('emp-006', 'OFI STORE', 3),
  ('emp-007', 'RECURSOS HUMANOS', 3),
  ('emp-008', 'OFI STORE', 5),
  ('emp-009', 'MARABIAS', 5),
  ('emp-010', 'EVTEK S.A. DE C.V.', 5),
  ('emp-002', 'Tecnologías Beta', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, floor = EXCLUDED.floor;
