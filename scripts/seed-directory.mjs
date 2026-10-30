import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Define DATABASE_URL antes de ejecutar npm run seed:directory.");

let contacts;
try {
  contacts = JSON.parse(await readFile("data/directorio.json", "utf8"));
} catch {
  throw new Error("Falta data/directorio.json. Crea ese archivo local con los contactos; no lo subas a Git.");
}

if (!Array.isArray(contacts) || contacts.length === 0) {
  throw new Error("data/directorio.json debe contener una lista de contactos.");
}

const sql = neon(connectionString);
for (const [index, contact] of contacts.entries()) {
  const name = String(contact.nombre || "").trim();
  const company = String(contact.empresa || "").trim();
  const floor = Number(contact.piso);
  const phone = String(contact.celular || "").trim();
  if (!name || !phone || !Number.isInteger(floor) || floor < 1 || floor > 6) {
    throw new Error(`Contacto ${index + 1}: nombre, teléfono y piso del 1 al 6 son obligatorios.`);
  }

  const id = `contact-${String(index + 1).padStart(3, "0")}`;
  await sql`
    INSERT INTO directory_contacts (id, name, company, floor, phone)
    VALUES (${id}, ${name}, ${company}, ${floor}, ${phone})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      company = EXCLUDED.company,
      floor = EXCLUDED.floor,
      phone = EXCLUDED.phone
  `;
}

console.log(`Se guardaron ${contacts.length} contactos en Neon.`);
