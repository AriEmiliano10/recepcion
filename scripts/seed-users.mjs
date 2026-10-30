import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync } from "node:crypto";

const connectionString = process.env.DATABASE_URL;
const seedUsers = process.env.SEED_USERS_JSON;

if (!connectionString || !seedUsers) {
  throw new Error("Define DATABASE_URL y SEED_USERS_JSON antes de ejecutar npm run seed.");
}

const users = JSON.parse(seedUsers);
if (!Array.isArray(users) || users.length === 0) {
  throw new Error("SEED_USERS_JSON debe ser un arreglo de cuentas.");
}

const sql = neon(connectionString);
const companies = await sql`SELECT id FROM companies`;
const companyIds = new Set(companies.map((company) => company.id));
const seenUsernames = new Set();
const seenIds = new Set();

for (const user of users) {
  const username = String(user.username || "").trim().toLowerCase();
  if (!user.id || !username || !user.name || !user.password || user.password.length < 12) {
    throw new Error("Cada cuenta requiere id, username, name y password de al menos 12 caracteres.");
  }
  if (seenUsernames.has(username) || seenIds.has(user.id)) {
    throw new Error("No se permiten usuarios o ids duplicados en SEED_USERS_JSON.");
  }
  seenUsernames.add(username);
  seenIds.add(user.id);

  if (!["RECEPCION", "EMPRESA", "PISO"].includes(user.role)) {
    throw new Error(`Rol no válido para ${username}.`);
  }
  if (user.role === "EMPRESA" && !companyIds.has(user.companyId)) {
    throw new Error(`La empresa de ${username} no existe en companies.`);
  }
  if (user.role === "PISO" && (!Number.isInteger(Number(user.floor)) || Number(user.floor) < 1 || Number(user.floor) > 6)) {
    throw new Error(`El piso de ${username} debe ser un entero entre 1 y 6.`);
  }
  if (user.role !== "PISO" && user.floor != null) {
    throw new Error(`Solo las cuentas PISO deben tener floor (${username}).`);
  }
  if (user.role !== "EMPRESA" && user.companyId != null) {
    throw new Error(`Solo las cuentas EMPRESA deben tener companyId (${username}).`);
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(user.password, salt, 64).toString("hex")}`;
  await sql`
    INSERT INTO users (id, username, password_hash, name, role, company_id, floor, active)
    VALUES (
      ${user.id}, ${username}, ${passwordHash}, ${String(user.name).trim()},
      ${user.role}, ${user.companyId ?? null}, ${user.role === "PISO" ? Number(user.floor) : null},
      ${user.active !== false}
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      password_hash = EXCLUDED.password_hash,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      company_id = EXCLUDED.company_id,
      floor = EXCLUDED.floor,
      active = EXCLUDED.active
  `;
}

console.log(`Se guardaron ${users.length} cuentas con contraseñas derivadas mediante scrypt.`);
