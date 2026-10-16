// Rutas de administración (solo rol admin).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/users -> todos los usuarios con conteos
router.get('/users', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
           (SELECT COUNT(*) FROM songs s WHERE s.user_id = u.id) AS song_count,
           (SELECT COUNT(*) FROM playlists p WHERE p.user_id = u.id) AS playlist_count
    FROM users u
    ORDER BY u.created_at DESC
  `);
  res.json(rows);
});

// GET /api/admin/users/:id -> detalle con listas y canciones
router.get('/users/:id', async (req, res) => {
  const [users] = await pool.query(
    'SELECT id, username, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
    [req.params.id]
  );
  if (!users[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const [playlists] = await pool.query(`
    SELECT p.id, p.name, p.share_token, COUNT(ps.id) AS song_count
    FROM playlists p
    LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [req.params.id]);

  const [songs] = await pool.query(
    `SELECT id, title, artist, original_key, transpose, bpm, beats_per_bar, accent_mode
     FROM songs WHERE user_id = ? ORDER BY updated_at DESC`,
    [req.params.id]
  );

  res.json({ user: users[0], playlists, songs });
});

// POST /api/admin/users -> crear usuario
router.post('/users', async (req, res) => {
  const { username, email, password, role } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos (usuario, email, contraseña).' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  const finalRole = role === 'admin' ? 'admin' : 'musico';
  try {
    const hash = await bcrypt.hash(String(password), 10);
    const [r] = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username.trim(), email.trim().toLowerCase(), hash, finalRole]
    );
    res.status(201).json({ id: r.insertId, username: username.trim(), email, role: finalRole, is_active: 1 });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ese usuario o email ya existe.' });
    }
    throw err;
  }
});

// PATCH /api/admin/users/:id -> habilitar/deshabilitar o cambiar rol
router.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No podés modificar tu propia cuenta de admin desde acá.' });
  }
  const fields = [];
  const values = [];
  if (req.body.is_active !== undefined) { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
  if (req.body.role !== undefined) { fields.push('role = ?'); values.push(req.body.role === 'admin' ? 'admin' : 'musico'); }
  if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar.' });

  values.push(id);
  const [r] = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  if (!r.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id -> borrar usuario (y sus datos, por cascade)
router.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No podés borrar tu propia cuenta.' });
  const [r] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json({ ok: true });
});

export default router;
