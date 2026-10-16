// Crea (o actualiza) la cuenta de administrador.
// Uso: npm run create-admin            -> admin / 123456
//      npm run create-admin usuario clave email
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

async function main() {
  const [, , argUser, argPass, argEmail] = process.argv;
  const username = argUser || 'admin';
  const password = argPass || '123456';
  const email = argEmail || 'admin@acordes.local';

  const hash = await bcrypt.hash(String(password), 10);

  // Si ya existe (por username o email), lo promovemos a admin y reseteamos la clave.
  const [existing] = await pool.query(
    'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
    [username, email]
  );

  if (existing.length) {
    await pool.query(
      "UPDATE users SET password_hash = ?, role = 'admin', is_active = 1 WHERE id = ?",
      [hash, existing[0].id]
    );
    console.log(`✓ Cuenta "${username}" actualizada a administrador.`);
  } else {
    await pool.query(
      "INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)",
      [username, email, hash]
    );
    console.log(`✓ Administrador creado: ${username} / ${password}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('✗ Error creando admin:', err.message);
  process.exit(1);
});
