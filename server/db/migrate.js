// Migración idempotente: agrega columnas/tablas nuevas sin borrar datos.
// Uso: npm run migrate
import 'dotenv/config';
import { pool } from './pool.js';

const DB = process.env.DB_NAME || 'acordes';

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [DB, table, column]
  );
  return rows.length > 0;
}

async function addColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`· ${table}.${column} ya existe`);
    return;
  }
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`✓ ${table}.${column} agregada`);
}

async function main() {
  // Roles y estado de cuenta
  await addColumn('users', 'role', "ENUM('musico','admin') NOT NULL DEFAULT 'musico'");
  await addColumn('users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');

  // Token para compartir listas
  await addColumn('playlists', 'share_token', 'VARCHAR(32) NULL');
  // Índice único para el token (si no existe)
  const [idx] = await pool.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'playlists' AND INDEX_NAME = 'uniq_share_token' LIMIT 1`,
    [DB]
  );
  if (!idx.length) {
    await pool.query('ALTER TABLE playlists ADD UNIQUE KEY uniq_share_token (share_token)');
    console.log('✓ índice único share_token agregado');
  } else {
    console.log('· índice share_token ya existe');
  }

  // Tabla de uso de APIs de scraping
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_usage (
      provider     VARCHAR(20) PRIMARY KEY,
      requests     INT NOT NULL DEFAULT 0,
      failures     INT NOT NULL DEFAULT 0,
      last_used_at TIMESTAMP NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ tabla api_usage lista');

  console.log('\n✓ Migración completa.');
  await pool.end();
}

main().catch((err) => {
  console.error('✗ Error en la migración:', err.message);
  process.exit(1);
});
