import { neon } from "@neondatabase/serverless";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";

const SESSION_COOKIE = "sr_session";
const SESSION_HOURS = 8;
const STATES = Object.freeze({
  PROGRAMADA: "PROGRAMADA",
  EN_ESPERA: "EN_ESPERA",
  AUTORIZADA: "AUTORIZADA",
  RECHAZADA: "RECHAZADA",
  DENTRO: "DENTRO",
  FINALIZADA: "FINALIZADA",
  CANCELADA: "CANCELADA"
});
const TRANSITIONS = Object.freeze({
  PROGRAMADA: ["EN_ESPERA", "CANCELADA"],
  EN_ESPERA: ["AUTORIZADA", "RECHAZADA", "CANCELADA"],
  AUTORIZADA: ["DENTRO", "CANCELADA"],
  DENTRO: ["FINALIZADA"]
});

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function cookieValue(headers, name) {
  const cookie = headers.cookie || headers.Cookie || "";
  const pair = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
}

function cookieHeader(value, maxAge) {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function checkPassword(password, encodedHash) {
  const [salt, expectedHex] = String(encodedHash || "").split(":");
  if (!salt || !/^[a-f0-9]{128}$/i.test(expectedHex || "")) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

function publicUser(row) {
  const roleLabels = { RECEPCION: "Recepción", EMPRESA: "Empresa", PISO: "Perfil de piso" };
  const panels = { RECEPCION: "recepcion.html", EMPRESA: "empresa.html", PISO: "piso.html" };
  return {
    usuarioId: row.id,
    usuario: row.username,
    nombre: row.name,
    rol: row.role,
    rolEtiqueta: roleLabels[row.role],
    panel: panels[row.role],
    empresa: row.company_id ? { id: row.company_id, nombre: row.company_name, piso: Number(row.company_floor) } : null,
    piso: row.floor == null ? null : Number(row.floor)
  };
}

function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    throw new ApiError(400, "El cuerpo de la solicitud no es JSON válido.");
  }
}

function hoyLocal() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function currentUser(sql, event) {
  const token = cookieValue(event.headers || {}, SESSION_COOKIE);
  if (!token) throw new ApiError(401, "Inicia sesión para continuar.");
  const tokenHash = hashToken(token);
  const rows = await sql`
    SELECT u.id, u.username, u.name, u.role, u.company_id, u.floor,
           c.name AS company_name, c.floor AS company_floor
    FROM sessions s
    JOIN users u ON u.id = s.user_id AND u.active = TRUE
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > NOW()
  `;
  if (!rows.length) throw new ApiError(401, "La sesión expiró. Inicia sesión de nuevo.");
  return publicUser(rows[0]);
}

function checkWriteOrigin(event) {
  const origin = event.headers && (event.headers.origin || event.headers.Origin);
  if (!origin) return;
  let requestOrigin;
  try {
    requestOrigin = new URL(event.rawUrl).origin;
  } catch {
    throw new ApiError(403, "Origen de solicitud no válido.");
  }
  if (origin !== requestOrigin) throw new ApiError(403, "Origen de solicitud no permitido.");
}

function visitFromRow(row) {
  return row.payload;
}

function visitScope(user) {
  if (user.rol === "RECEPCION") return null;
  if (user.rol === "PISO") return { floor: user.piso };
  return { companyId: user.empresa.id };
}

function canAccessVisit(user, visit) {
  if (user.rol === "RECEPCION") return true;
  if (user.rol === "PISO") return Number(visit.piso) === Number(user.piso);
  return Boolean(user.empresa && visit.empresaId === user.empresa.id);
}

function buildVisit(data, user, company) {
  const visitor = String(data.visitante || "").trim();
  const host = String(data.anfitrion || "").trim();
  const reason = String(data.motivo || "").trim();
  const date = String(data.fecha || "");
  const time = String(data.hora || "");
  const floor = Number(data.piso);
  const identificationPresented = data.identificacionPresentada !== "NO" && data.identificacionPresentada !== false;
  const identificationType = identificationPresented && ["INE", "PASAPORTE"].includes(data.identificacionTipo)
    ? data.identificacionTipo
    : null;

  if (!visitor || !host || !reason || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) ||
      !Number.isInteger(floor) || floor < 1 || floor > 6) {
    throw new ApiError(400, "Completa visitante, anfitrión, motivo, piso, fecha y horario válidos.");
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || hours > 23 || minutes > 59) {
    throw new ApiError(400, "La fecha o el horario no son válidos.");
  }
  if (date < hoyLocal()) throw new ApiError(400, "La fecha de visita no puede estar en el pasado.");
  if (identificationPresented && !identificationType) {
    throw new ApiError(400, "Selecciona si entregó INE/IFE o pasaporte.");
  }

  let companyId = null;
  let companyName = String(data.empresaNombre || "").trim();
  if (user.rol === "EMPRESA") {
    companyId = user.empresa.id;
    companyName = user.empresa.nombre;
    if (floor !== user.empresa.piso) throw new ApiError(403, "La visita debe dirigirse al piso de tu empresa.");
  } else if (user.rol === "RECEPCION") {
    companyId = String(data.empresaId || "");
    if (!company) throw new ApiError(400, "Selecciona una empresa válida.");
    companyName = company.name;
    if (floor !== Number(company.floor)) throw new ApiError(400, "El piso seleccionado no corresponde a la empresa.");
  } else {
    companyId = data.empresaId ? String(data.empresaId) : null;
    if (companyId && !company) throw new ApiError(400, "La empresa seleccionada no es válida.");
    if (company && Number(company.floor) !== floor) throw new ApiError(400, "La empresa seleccionada no pertenece a ese piso.");
    if (company) companyName = company.name;
    if (floor !== user.piso) throw new ApiError(403, "El perfil solo puede registrar visitas para su piso.");
  }
  if (!companyName) throw new ApiError(400, "Indica la empresa destino.");

  const id = `vis-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const folio = `VIS-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  return {
    id,
    folio,
    visitante: visitor,
    identificacionPresentada: identificationPresented,
    identificacionTipo: identificationType,
    piso: floor,
    motivo: reason,
    fecha: date,
    hora: time,
    empresaId: companyId,
    empresaNombre: companyName,
    anfitrion: host,
    anfitrionPuesto: String(data.anfitrionPuesto || "").trim(),
    anfitrionOrigen: data.anfitrionOrigen === "DIRECTORIO" ? "DIRECTORIO" : "MANUAL",
    anfitrionContactoId: data.anfitrionContactoId || null,
    estado: STATES.PROGRAMADA,
    origen: user.rol === "RECEPCION" ? "RECEPCION" : "PISO",
    creadaPor: user.usuarioId,
    creadaPorNombre: user.nombre,
    creadaEn: new Date().toISOString(),
    llegada: null,
    autorizadaPor: null,
    autorizadaEn: null,
    rechazoMotivo: null,
    entrada: null,
    salida: null,
    gafete: null
  };
}

async function handleLogin(sql, event) {
  checkWriteOrigin(event);
  const body = parseBody(event);
  const username = String(body.usuario || "").trim().toLowerCase();
  const password = String(body.contrasena || "");
  if (!username || !password) throw new ApiError(400, "Ingresa usuario y contraseña.");
  const rows = await sql`
    SELECT u.id, u.username, u.password_hash, u.name, u.role, u.company_id, u.floor,
           c.name AS company_name, c.floor AS company_floor
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.username = ${username} AND u.active = TRUE
  `;
  if (!rows.length || !checkPassword(password, rows[0].password_hash)) {
    throw new ApiError(401, "Usuario o contraseña incorrectos.");
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${rows[0].id}, ${expiresAt})
  `;
  return json(200, { ok: true, sesion: publicUser(rows[0]) }, {
    "Set-Cookie": cookieHeader(token, SESSION_HOURS * 60 * 60)
  });
}

async function listVisits(sql, user) {
  const scope = visitScope(user);
  const rows = scope && scope.floor != null
    ? await sql`SELECT payload FROM visits WHERE floor = ${scope.floor} ORDER BY visit_date DESC, payload->>'hora' DESC`
    : scope
      ? await sql`SELECT payload FROM visits WHERE company_id = ${scope.companyId} ORDER BY visit_date DESC, payload->>'hora' DESC`
      : await sql`SELECT payload FROM visits ORDER BY visit_date DESC, payload->>'hora' DESC`;
  return json(200, { ok: true, visitas: rows.map(visitFromRow) });
}

async function listDirectory(sql, user) {
  const floor = user.empresa ? user.empresa.piso : user.piso;
  const rows = user.rol === "RECEPCION"
    ? await sql`SELECT id, name, company, floor, phone FROM directory_contacts ORDER BY floor, name`
    : await sql`SELECT id, name, company, floor, phone FROM directory_contacts WHERE floor = ${floor} ORDER BY name`;
  return json(200, {
    ok: true,
    directorio: rows.map((row) => ({
      id: row.id,
      nombre: row.name,
      empresa: row.company,
      piso: Number(row.floor),
      celular: row.phone
    }))
  });
}

async function createVisit(sql, event, user) {
  checkWriteOrigin(event);
  const data = parseBody(event);
  let company = null;
  const companyId = user.rol === "EMPRESA" ? user.empresa.id : String(data.empresaId || "");
  if (companyId) {
    const companies = await sql`SELECT id, name, floor FROM companies WHERE id = ${companyId}`;
    company = companies[0] || null;
  }
  const visit = buildVisit(data, user, company);
  await sql`
    INSERT INTO visits (id, folio, state, origin, company_id, floor, visit_date, payload)
    VALUES (${visit.id}, ${visit.folio}, ${visit.estado}, ${visit.origen}, ${visit.empresaId},
            ${visit.piso}, ${visit.fecha}, ${JSON.stringify(visit)}::jsonb)
  `;
  return json(201, { ok: true, visita: visit });
}

async function transitionVisit(sql, event, user, id, action) {
  checkWriteOrigin(event);
  const rows = await sql`SELECT state, payload FROM visits WHERE id = ${id}`;
  if (!rows.length) throw new ApiError(404, "La visita no existe.");
  const visit = visitFromRow(rows[0]);
  if (!canAccessVisit(user, visit)) throw new ApiError(403, "No tienes permiso para operar esta visita.");
  if (action !== "cancel" && user.rol !== "RECEPCION") {
    throw new ApiError(403, "Solo recepción puede procesar la llegada y el acceso.");
  }

  const targetByAction = {
    arrival: STATES.EN_ESPERA,
    authorize: STATES.AUTORIZADA,
    reject: STATES.RECHAZADA,
    entry: STATES.DENTRO,
    exit: STATES.FINALIZADA,
    cancel: STATES.CANCELADA
  };
  const nextState = targetByAction[action];
  if (!nextState) throw new ApiError(404, "La operación solicitada no existe.");
  if (!(TRANSITIONS[visit.estado] || []).includes(nextState)) {
    throw new ApiError(409, "La visita no puede cambiar a ese estado.");
  }

  const now = new Date().toISOString();
  const changes = {
    arrival: { llegada: now },
    authorize: { autorizadaPor: user.usuarioId, autorizadaEn: now },
    reject: {
      autorizadaPor: user.usuarioId,
      autorizadaEn: now,
      rechazoMotivo: String(parseBody(event).motivo || "Sin motivo especificado").trim()
    },
    entry: { entrada: now, gafete: `G-${visit.folio.slice(-6)}` },
    exit: { salida: now },
    cancel: {}
  }[action];
  const updated = { ...visit, ...changes, estado: nextState };
  const result = await sql`
    UPDATE visits
    SET state = ${nextState}, payload = ${JSON.stringify(updated)}::jsonb
    WHERE id = ${id} AND state = ${visit.estado}
    RETURNING id
  `;
  if (!result.length) throw new ApiError(409, "La visita cambió mientras se procesaba. Actualiza la pantalla.");
  return json(200, { ok: true, visita: updated });
}

export function createHandler(createSql = (connectionString) => neon(connectionString)) {
  return async function handler(event) {
    try {
      if (!process.env.DATABASE_URL) throw new Error("Falta configurar DATABASE_URL en el entorno de Netlify.");
      const sql = createSql(process.env.DATABASE_URL);
      const method = event.httpMethod || "GET";
      const path = String((event.queryStringParameters || {}).path || "")
        .split("/")
        .filter(Boolean)
        .map(decodeURIComponent);

      if (method === "POST" && path.join("/") === "auth/login") return await handleLogin(sql, event);
      if (method === "GET" && path.join("/") === "auth/session") {
        const user = await currentUser(sql, event);
        return json(200, { ok: true, sesion: user });
      }
      if (method === "POST" && path.join("/") === "auth/logout") {
        checkWriteOrigin(event);
        const token = cookieValue(event.headers || {}, SESSION_COOKIE);
        if (token) await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
        return json(200, { ok: true }, { "Set-Cookie": cookieHeader("", 0) });
      }

      const user = await currentUser(sql, event);
      if (method === "GET" && path.join("/") === "directory") return await listDirectory(sql, user);
      if (method === "GET" && path.join("/") === "visits") return await listVisits(sql, user);
      if (method === "POST" && path.join("/") === "visits") return await createVisit(sql, event, user);
      if (path[0] === "visits" && path.length === 3 && method === "POST") {
        return await transitionVisit(sql, event, user, path[1], path[2]);
      }
      throw new ApiError(404, "La ruta solicitada no existe.");
    } catch (error) {
      if (error instanceof ApiError) return json(error.status, { ok: false, error: error.message });
      console.error("[api] Error al procesar solicitud:", error);
      return json(500, { ok: false, error: "Ocurrió un error interno. Inténtalo más tarde." });
    }
  };
}

export default createHandler();
