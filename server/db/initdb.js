// Crea la base de datos y las tablas ejecutando schema.sql.
// Uso: npm run init-db
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

  // Conexion sin seleccionar base (el schema la crea). multipleStatements para correr todo el archivo.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('Conectado a MySQL. Ejecutando schema...');
  await conn.query(sql);
  console.log('✓ Base de datos y tablas listas (base: %s).', process.env.DB_NAME || 'acordes');
  await conn.end();
}

main().catch((err) => {
  console.error('✗ Error inicializando la base de datos:');
  console.error(err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('\n¿Está corriendo MySQL en XAMPP? Abrí el panel de XAMPP y arrancá "MySQL".');
  }
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('\nRevisá DB_USER / DB_PASSWORD en el archivo .env');
  }
  process.exit(1);
});
