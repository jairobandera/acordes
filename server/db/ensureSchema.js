// Crea las tablas si no existen, usando la base ya conectada (no crea la base).
// Se corre al arrancar el server, así en la nube (Railway, etc.) no hace falta
// inicializar la base a mano. Es idempotente: CREATE TABLE IF NOT EXISTS.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function ensureSchema() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

  // 1) Sacamos las líneas de comentario (-- ...) ANTES de separar por ';',
  //    si no, un comentario pegado a un CREATE TABLE se lleva la sentencia entera.
  const noComments = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');

  // 2) Separamos por ';' y descartamos CREATE DATABASE / USE (la base ya existe).
  const statements = noComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !/^(CREATE\s+DATABASE|USE)\b/i.test(s));

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      console.warn('[ensureSchema] aviso:', err.message);
    }
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

    const email = process.env.ADMIN_EMAIL || `${username}@acordes.local`;
    const hash = await bcrypt.hash(String(password), 10);
    await pool.query(
      "INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)",
      [username, email, hash]
    );
    console.log(`✓ Admin "${username}" creado desde variables de entorno.`);
  } catch (err) {
    console.warn('[ensureAdmin] aviso:', err.message);
  }
}
