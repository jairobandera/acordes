// Crea el schema "acordes" y sus tablas en Postgres/Supabase.
// Uso: npm run init-db
import 'dotenv/config';
import { pool } from './pool.js';
import { ensureSchema } from './ensureSchema.js';

async function main() {
  console.log('Conectando a Postgres...');
  await ensureSchema();
  console.log('✓ Schema "acordes" y tablas listas.');
  await pool.end();
}

main().catch((err) => {
  console.error('✗ Error inicializando la base:', err.message);
  if (/password|auth/i.test(err.message)) {
    console.error('\nRevisá DATABASE_URL (o DB_USER/DB_PASSWORD) en el archivo .env');
  }
  process.exit(1);
});
