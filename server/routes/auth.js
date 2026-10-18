// Rutas de registro y login.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

// POST /api/auth/register  { username, password }
router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan datos (usuario y contraseña).' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const hash = await bcrypt.hash(String(password), 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username.trim(), hash]
    );
    const user = { id: result.insertId, username: username.trim(), role: 'musico' };
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre. Elegí otro.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al registrar.' });
  }
});

// POST /api/auth/login  { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan datos.' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, role, is_active FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const ok = await bcrypt.compare(String(password), u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    if (!u.is_active) return res.status(403).json({ error: 'Tu cuenta está deshabilitada. Contactá al administrador.' });

    const user = { id: u.id, username: u.username, role: u.role };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// GET /api/auth/me  -> datos del usuario actual (valida token y estado)
router.get('/me', requireAuth, async (req, res) => {
  // Revalidamos contra la DB por si la cuenta fue deshabilitada o cambió de rol.
  const [rows] = await pool.query(
    'SELECT id, username, role, is_active FROM users WHERE id = ? LIMIT 1',
    [req.user.id]
  );
  const u = rows[0];
  if (!u || !u.is_active) return res.status(401).json({ error: 'Cuenta no disponible.' });
  res.json({ user: { id: u.id, username: u.username, role: u.role } });
});

export default router;
