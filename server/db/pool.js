// Pool de conexiones MySQL reutilizable en toda la app.
import 'dotenv/config';
import mysql from 'mysql2/promise';

// SSL opcional (las bases gratis en la nube como Aiven lo exigen).
// DB_SSL=true activa TLS. Si pegás el certificado CA en DB_SSL_CA, lo verifica;
// si no, igual conecta por TLS sin verificar el CA (rejectUnauthorized=false).
function sslConfig() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined;
  if (process.env.DB_SSL_CA) {
    return { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'acordes',
  ssl: sslConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// Chequeo simple de conexion al arrancar.
export async function assertDbConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}
