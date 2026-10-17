// Ruta PÚBLICA (sin login) para ver una lista compartida por su token.
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../auth.js';

const router = Router();

// GET /api/shared/:token -> lista + canciones completas (acordes, tonalidad, bpm)
router.get('/:token', async (req, res) => {
  const token = (req.params.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Token inválido.' });

  const [pl] = await pool.query(
    `SELECT p.id, p.name, u.username AS owner
     FROM playlists p JOIN users u ON u.id = p.user_id
     WHERE p.share_token = ? LIMIT 1`,
    [token]
  );
  if (!pl[0]) return res.status(404).json({ error: 'Lista no encontrada o dejó de compartirse.' });

  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.artist, s.content_json, s.original_key, s.transpose,
            s.bpm, s.beats_per_bar, s.accent_mode, ps.position
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = ?
     ORDER BY ps.position ASC, ps.id ASC`,
    [pl[0].id]
  );

  const songs = rows.map((r) => {
    let content;
    try { content = JSON.parse(r.content_json); } catch { content = []; }
    return {
      id: r.id,
      title: r.title,
      artist: r.artist,
      content,
      original_key: r.original_key,
      transpose: r.transpose,
      bpm: r.bpm,
      beats_per_bar: r.beats_per_bar,
      accent_mode: r.accent_mode,
    };
  });

  res.json({ name: pl[0].name, owner: pl[0].owner, songs });
});

// POST /api/shared/:token/import -> copia la lista a la cuenta del usuario logueado.
// Queda como una lista propia más, con nombre "(lista) - (quien la compartió)".
router.post('/:token/import', requireAuth, async (req, res) => {
  const token = (req.params.token || '').trim();

  const [pl] = await pool.query(
    `SELECT p.id, p.name, p.user_id, u.username AS owner
     FROM playlists p JOIN users u ON u.id = p.user_id
     WHERE p.share_token = ? LIMIT 1`,
    [token]
  );
  if (!pl[0]) return res.status(404).json({ error: 'Lista no encontrada o dejó de compartirse.' });
  if (pl[0].user_id === req.user.id) return res.status(400).json({ error: 'Esta lista ya es tuya.' });

  const newName = `${pl[0].name} - ${pl[0].owner}`;

  // Evitamos importarla dos veces (misma lista, mismo usuario).
  const [exists] = await pool.query(
    'SELECT id FROM playlists WHERE user_id = ? AND name = ? LIMIT 1',
    [req.user.id, newName]
  );
  if (exists[0]) return res.status(409).json({ error: 'Ya guardaste esta lista en tus listas.', playlist_id: exists[0].id });

  const [songs] = await pool.query(
    `SELECT s.title, s.artist, s.source_url, s.content_json, s.original_key, s.transpose,
            s.bpm, s.beats_per_bar, s.accent_mode
     FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = ? ORDER BY ps.position ASC, ps.id ASC`,
    [pl[0].id]
  );

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [plRes] = await conn.query(
      'INSERT INTO playlists (user_id, name) VALUES (?, ?)',
      [req.user.id, newName]
    );
    const newPlaylistId = plRes.insertId;
    let pos = 0;
    for (const s of songs) {
      const [sRes] = await conn.query(
        `INSERT INTO songs
          (user_id, title, artist, source_url, content_json, original_key, transpose, bpm, beats_per_bar, accent_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, s.title, s.artist, s.source_url, s.content_json, s.original_key,
         s.transpose, s.bpm, s.beats_per_bar, s.accent_mode]
      );
      await conn.query(
        'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
        [newPlaylistId, sRes.insertId, pos++]
      );
    }
    await conn.commit();
    res.status(201).json({ ok: true, playlist_id: newPlaylistId, name: newName, song_count: songs.length });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

export default router;
