import assert from "node:assert/strict";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import test from "node:test";
import { createHandler } from "../netlify/functions/api.mjs";

process.env.DATABASE_URL = "postgresql://test:test@localhost/test";

function mockSql(respond) {
  const calls = [];
  function sql(strings, ...values) {
    const query = strings.reduce((result, part, index) => result + part + (index < values.length ? `?${index}` : ""), "");
    calls.push({ query, values });
    return Promise.resolve(respond(query, values, calls));
  }
  sql.calls = calls;
  return sql;
}

function event(path, { method = "GET", body, cookie, origin = "https://visitas.example", rawUrl } = {}) {
  return {
    httpMethod: method,
    queryStringParameters: { path },
    rawUrl: rawUrl || `https://visitas.example/api/${path}`,
    headers: {
      ...(cookie ? { cookie: `sr_session=${encodeURIComponent(cookie)}` } : {}),
      ...(origin ? { origin } : {})
    },
    body: body === undefined ? null : JSON.stringify(body)
  };
}

function userRow(role, overrides = {}) {
  return {
    id: `${role.toLowerCase()}-1`,
    username: role.toLowerCase(),
    name: `${role} user`,
    role,
    company_id: role === "EMPRESA" ? "emp-001" : null,
    company_name: role === "EMPRESA" ? "Consultores Alfa" : null,
    company_floor: role === "EMPRESA" ? 3 : null,
    floor: role === "PISO" ? 3 : null,
    ...overrides
  };
}

function sessionSql(role, otherQueries = () => []) {
  return mockSql((query) => query.includes("FROM sessions s")
    ? [userRow(role)]
    : otherQueries(query));
}

function result(response) {
  return { status: response.statusCode, ...JSON.parse(response.body), headers: response.headers };
}

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const cookie = `sr_session=${token}`;

test("login checks the derived password and issues a protected session cookie", async () => {
  const salt = randomBytes(16).toString("hex");
  const password = "a-private-test-password";
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  const sql = mockSql((query) => {
    if (query.includes("WHERE u.username")) return [{
      ...userRow("RECEPCION"),
      password_hash: passwordHash
    }];
    return [];
  });

  const response = result(await createHandler(() => sql)(event("auth/login", {
    method: "POST",
    body: { usuario: "RECEPCION", contrasena: password }
  }), sql));
  assert.equal(response.status, 200);
  assert.equal(response.sesion.rol, "RECEPCION");
  assert.match(response.headers["Set-Cookie"], /HttpOnly/);
  assert.match(response.headers["Set-Cookie"], /SameSite=Lax/);
  assert.match(response.headers["Set-Cookie"], /Secure/);
  assert.equal(sql.calls.at(-1).values[0].length, 64);
});

test("login rejects wrong passwords with the generic message", async () => {
  const sql = mockSql((query) => query.includes("WHERE u.username")
    ? [{ ...userRow("RECEPCION"), password_hash: "invalid" }]
    : []);
  const response = result(await createHandler(() => sql)(event("auth/login", {
    method: "POST",
    body: { usuario: "recepcion", contrasena: "wrong-password" }
  }), sql));
  assert.equal(response.status, 401);
  assert.equal(response.error, "Usuario o contraseña incorrectos.");
});

test("company visit queries are scoped on the server", async () => {
  const sql = sessionSql("EMPRESA", (query) => query.includes("FROM visits WHERE company_id") ? [] : []);
  const response = result(await createHandler(() => sql)(event("visits", { cookie })));
  assert.equal(response.status, 200);
  const visitsQuery = sql.calls.find((call) => call.query.includes("FROM visits WHERE company_id"));
  assert.ok(visitsQuery);
  assert.ok(visitsQuery.values.includes("emp-001"));
});

test("reception can create a visit and the company is derived from the database", async () => {
  const sql = sessionSql("RECEPCION", (query) => {
    if (query.includes("FROM companies")) return [{ id: "emp-001", name: "Consultores Alfa", floor: 3 }];
    if (query.includes("INSERT INTO visits")) return [{ id: "visit-created" }];
    return [];
  });
  const response = result(await createHandler(() => sql)(event("visits", {
    method: "POST",
    cookie,
    body: {
      visitante: "Visitante QA",
      identificacionPresentada: "SI",
      identificacionTipo: "INE",
      piso: 3,
      empresaId: "emp-001",
      empresaNombre: "Nombre manipulado",
      anfitrion: "Anfitrión QA",
      motivo: "Reunión",
      fecha: "2099-01-02",
      hora: "10:30"
    }
  })));
  assert.equal(response.status, 201);
  assert.equal(response.visita.empresaNombre, "Consultores Alfa");
  assert.ok(sql.calls.some((call) => call.query.includes("INSERT INTO visits")));
});

test("company roles cannot operate reception transitions", async () => {
  const visit = {
    id: "vis-1",
    empresaId: "emp-001",
    piso: 3,
    estado: "PROGRAMADA"
  };
  const sql = sessionSql("EMPRESA", (query) => query.includes("SELECT state, payload")
    ? [{ state: "PROGRAMADA", payload: visit }]
    : []);
  const response = result(await createHandler(() => sql)(event("visits/vis-1/arrival", {
    method: "POST",
    cookie,
    body: {}
  })));
  assert.equal(response.status, 403);
  assert.equal(response.error, "Solo recepción puede procesar la llegada y el acceso.");
  assert.ok(!sql.calls.some((call) => call.query.includes("UPDATE visits")));
});

test("stale visit transitions cannot overwrite a concurrent change", async () => {
  const visit = {
    id: "vis-1",
    empresaId: "emp-001",
    piso: 3,
    folio: "VIS-TEST",
    estado: "PROGRAMADA"
  };
  const sql = sessionSql("RECEPCION", (query) => query.includes("SELECT state, payload")
    ? [{ state: "PROGRAMADA", payload: visit }]
    : query.includes("UPDATE visits")
      ? []
      : []);
  const response = result(await createHandler(() => sql)(event("visits/vis-1/arrival", {
    method: "POST",
    cookie,
    body: {}
  })));
  assert.equal(response.status, 409);
  assert.equal(response.error, "La visita cambió mientras se procesaba. Actualiza la pantalla.");
});

test("writes from an untrusted origin are rejected", async () => {
  const sql = mockSql(() => []);
  const response = result(await createHandler(() => sql)(event("auth/logout", {
    method: "POST",
    cookie,
    origin: "https://attacker.example",
    rawUrl: "https://visitas.example/api/auth/logout",
    body: {}
  })));
  assert.equal(response.status, 403);
  assert.equal(response.error, "Origen de solicitud no permitido.");
  assert.equal(sql.calls.length, 0);
});
