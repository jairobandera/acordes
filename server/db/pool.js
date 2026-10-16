// Pool de conexiones MySQL reutilizable en toda la app.
import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'acordes',
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
