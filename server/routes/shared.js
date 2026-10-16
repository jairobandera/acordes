// Ruta PÚBLICA (sin login) para ver una lista compartida por su token.
import { Router } from 'express';
import { pool } from '../db/pool.js';

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

export default router;
