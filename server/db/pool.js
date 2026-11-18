// Pool de conexiones PostgreSQL (Supabase).
// Todo vive en el schema "acordes" (search_path), así NO se toca el schema
// public ni ninguna otra app del mismo proyecto Supabase.
//
// Wrapper de compatibilidad: el resto del código usa estilo mysql2
// (placeholders "?", destructuring `const [rows] = ...`, `result.insertId`,
// `result.affectedRows`). Acá traducimos "?" -> "$1,$2.." y devolvemos
// resultados con esa misma forma para no reescribir todas las rutas.
import 'dotenv/config';
import pg from 'pg';

const SCHEMA = process.env.DB_SCHEMA || 'acordes';

// Config: preferimos DATABASE_URL (string de conexión de Supabase); si no, vars sueltas.
const pgConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'postgres',
    };

// SSL para Supabase (y cualquier Postgres en la nube).
if (String(process.env.DB_SSL || 'true').toLowerCase() !== 'false') {
  pgConfig.ssl = { rejectUnauthorized: false };
}
// Cada conexión arranca con el search_path en nuestro schema.
pgConfig.options = `-c search_path=${SCHEMA}`;

const pgPool = new pg.Pool(pgConfig);

// Por las dudas (si el pooler ignora 'options'), fijamos el search_path al conectar.
pgPool.on('connect', (client) => {
  client.query(`SET search_path TO ${SCHEMA}, public`).catch(() => {});
});

// "?" -> "$1, $2, ..."
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Devuelve el resultado con forma compatible con mysql2:
//   const [rows] = ...   -> rows es el array de filas (con .insertId y .affectedRows)
function shape(result) {
  const rows = result.rows || [];
  // insertId: cuando el INSERT usó RETURNING id
  try { rows.insertId = rows[0] ? (rows[0].id ?? Object.values(rows[0])[0]) : undefined; } catch { /* noop */ }
  rows.affectedRows = result.rowCount;
  return [rows];
}

export const pool = {
  async query(sql, params) {
    const r = await pgPool.query(toPg(sql), params);
    return shape(r);
  },
  // Ejecuta SQL crudo (multi-sentencia, sin placeholders) — para el schema.
  exec(sql) {
    return pgPool.query(sql);
  },
  // Transacciones estilo mysql2 (getConnection + beginTransaction/commit/rollback).
  async getConnection() {
    const client = await pgPool.connect();
    return {
      query: async (sql, params) => shape(await client.query(toPg(sql), params)),
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release(),
    };
  },
  end: () => pgPool.end(),
  _pg: pgPool,
};

// Chequeo simple de conexion al arrancar.
export async function assertDbConnection() {
  const c = await pgPool.connect();
  try {
    await c.query('SELECT 1');
  } finally {
    c.release();
  }
}
