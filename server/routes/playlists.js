// CRUD de listas (setlists) y manejo de canciones dentro de una lista.
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Construye la URL pública base (para los links de compartir).
function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  // Detrás de un proxy (deploy) respetamos x-forwarded-*.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

// GET /api/playlists -> listas del usuario con conteo de canciones
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.created_at, COUNT(ps.id) AS song_count
     FROM playlists p
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     WHERE p.user_id = ?
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// GET /api/playlists/:id -> lista con sus canciones ordenadas
router.get('/:id', async (req, res) => {
  const [pl] = await pool.query(
    'SELECT id, name, created_at FROM playlists WHERE id = ? AND user_id = ? LIMIT 1',
    [req.params.id, req.user.id]
  );
  if (!pl[0]) return res.status(404).json({ error: 'Lista no encontrada.' });

  const [songs] = await pool.query(
    `SELECT s.id, s.title, s.artist, s.bpm, s.beats_per_bar, s.accent_mode, s.transpose, ps.position
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = ?
     ORDER BY ps.position ASC, ps.id ASC`,
    [req.params.id]
  );
  res.json({ ...pl[0], songs });
});

// POST /api/playlists  { name }
router.post('/', async (req, res) => {
  const name = (req.body?.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'Falta el nombre de la lista.' });
  const [result] = await pool.query(
    'INSERT INTO playlists (user_id, name) VALUES (?, ?)',
    [req.user.id, name]
  );
  res.status(201).json({ id: result.insertId, name, song_count: 0 });
});

// PUT /api/playlists/:id  { name }
router.put('/:id', async (req, res) => {
  const name = (req.body?.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'Falta el nombre.' });
  const [r] = await pool.query(
    'UPDATE playlists SET name = ? WHERE id = ? AND user_id = ?',
    [name, req.params.id, req.user.id]
  );
  if (!r.affectedRows) return res.status(404).json({ error: 'Lista no encontrada.' });
  res.json({ id: Number(req.params.id), name });
});

// DELETE /api/playlists/:id
router.delete('/:id', async (req, res) => {
  const [r] = await pool.query(
    'DELETE FROM playlists WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!r.affectedRows) return res.status(404).json({ error: 'Lista no encontrada.' });
  res.json({ ok: true });
});

// Verifica que la lista y la cancion sean del usuario
async function ownsBoth(userId, playlistId, songId) {
  const [p] = await pool.query('SELECT id FROM playlists WHERE id = ? AND user_id = ?', [playlistId, userId]);
  const [s] = await pool.query('SELECT id FROM songs WHERE id = ? AND user_id = ?', [songId, userId]);
  return p[0] && s[0];
}

// POST /api/playlists/:id/songs  { song_id }
router.post('/:id/songs', async (req, res) => {
  const songId = parseInt(req.body?.song_id, 10);
  if (!songId) return res.status(400).json({ error: 'Falta song_id.' });
  if (!(await ownsBoth(req.user.id, req.params.id, songId))) {
    return res.status(404).json({ error: 'Lista o canción no encontrada.' });
  }
  const [[{ maxPos }]] = await pool.query(
    'SELECT COALESCE(MAX(position), -1) AS maxPos FROM playlist_songs WHERE playlist_id = ?',
    [req.params.id]
  );
  try {
    await pool.query(
      'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
      [req.params.id, songId, maxPos + 1]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La canción ya está en la lista.' });
    }
    throw err;
  }
  res.status(201).json({ ok: true });
});

// DELETE /api/playlists/:id/songs/:songId
router.delete('/:id/songs/:songId', async (req, res) => {
  const [p] = await pool.query('SELECT id FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!p[0]) return res.status(404).json({ error: 'Lista no encontrada.' });
  await pool.query(
    'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
    [req.params.id, req.params.songId]
  );
  res.json({ ok: true });
});

// POST /api/playlists/:id/share -> genera (o devuelve) el token y el link público
router.post('/:id/share', async (req, res) => {
  const [pl] = await pool.query(
    'SELECT id, share_token FROM playlists WHERE id = ? AND user_id = ? LIMIT 1',
    [req.params.id, req.user.id]
  );
  if (!pl[0]) return res.status(404).json({ error: 'Lista no encontrada.' });

  let token = pl[0].share_token;
  if (!token) {
    token = randomBytes(12).toString('hex'); // 24 chars
    await pool.query('UPDATE playlists SET share_token = ? WHERE id = ?', [token, req.params.id]);
  }
  const url = `${baseUrl(req)}/share/${token}`;
  res.json({ token, url });
});

// DELETE /api/playlists/:id/share -> deja de compartir
router.delete('/:id/share', async (req, res) => {
  const [r] = await pool.query(
    'UPDATE playlists SET share_token = NULL WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!r.affectedRows) return res.status(404).json({ error: 'Lista no encontrada.' });
  res.json({ ok: true });
});

// PUT /api/playlists/:id/order  { song_ids: [...] }  -> reordena
router.put('/:id/order', async (req, res) => {
  const ids = Array.isArray(req.body?.song_ids) ? req.body.song_ids : null;
  if (!ids) return res.status(400).json({ error: 'Falta song_ids.' });
  const [p] = await pool.query('SELECT id FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!p[0]) return res.status(404).json({ error: 'Lista no encontrada.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await conn.query(
        'UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?',
        [i, req.params.id, ids[i]]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ ok: true });
});

export default router;
