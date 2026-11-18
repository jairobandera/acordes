// Crea el schema "acordes" y sus tablas si no existen (idempotente).
// Se corre al arrancar el server, así en el servidor no hace falta
// inicializar nada a mano. NUNCA toca el schema public ni otras apps.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function ensureSchema() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  // Postgres acepta todo el archivo (multi-sentencia, incluida la función $$) en
  // una sola llamada. Es idempotente (IF NOT EXISTS / CREATE OR REPLACE).
  try {
    await pool.exec(sql);
  } catch (err) {
    console.warn('[ensureSchema] aviso:', err.message);
  }
}

// Crea un admin desde variables de entorno (ADMIN_USERNAME / ADMIN_PASSWORD)
// si todavía no existe ningún admin. Útil para el primer deploy en la nube.
export async function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;

  try {
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.length) return; // ya hay un admin

    const hash = await bcrypt.hash(String(password), 10);
    await pool.query(
      "INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, 'admin', 1)",
      [username, hash]
    );
    console.log(`✓ Admin "${username}" creado desde variables de entorno.`);
  } catch (err) {
    console.warn('[ensureAdmin] aviso:', err.message);
  }
}
