// Aplica el schema de forma idempotente (crea lo que falte, no borra datos).
// En Postgres el schema usa IF NOT EXISTS, así que init y migración son lo mismo.
// Uso: npm run migrate
import 'dotenv/config';
import { pool } from './pool.js';
import { ensureSchema } from './ensureSchema.js';

async function main() {
  await ensureSchema();
  console.log('✓ Migración completa (schema "acordes" al día).');
  await pool.end();
}

main().catch((err) => {
  console.error('✗ Error en la migración:', err.message);
  process.exit(1);
});
