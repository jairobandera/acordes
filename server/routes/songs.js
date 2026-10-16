// CRUD de canciones guardadas del usuario.
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const ACCENTS = new Set(['first', 'none', 'all']);

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

// Normaliza/valida el payload de una cancion
function normalizeBody(body) {
  const title = (body.title || '').toString().trim();
  const artist = (body.artist || '').toString().trim();
  if (!title) throw new Error('Falta el título.');

  let contentJson;
  if (typeof body.content === 'string') {
    contentJson = body.content;
  } else {
    contentJson = JSON.stringify(body.content ?? body.versions ?? []);
  }

  return {
    title,
    artist: artist || 'Desconocido',
    source_url: (body.source_url || body.url || '').toString().slice(0, 500) || null,
    content_json: contentJson,
    original_key: (body.original_key || '').toString().slice(0, 10) || null,
    transpose: clampInt(body.transpose, -11, 11, 0),
    bpm: clampInt(body.bpm, 20, 400, 100),
    beats_per_bar: clampInt(body.beats_per_bar, 1, 16, 4),
    accent_mode: ACCENTS.has(body.accent_mode) ? body.accent_mode : 'first',
  };
}

function rowToSong(r) {
  let content;
  try { content = JSON.parse(r.content_json); } catch { content = []; }
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    source_url: r.source_url,
    content,
    original_key: r.original_key,
    transpose: r.transpose,
    bpm: r.bpm,
    beats_per_bar: r.beats_per_bar,
    accent_mode: r.accent_mode,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// GET /api/songs  -> lista (sin contenido pesado)
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, title, artist, source_url, original_key, transpose, bpm, beats_per_bar, accent_mode, updated_at
     FROM songs WHERE user_id = ? ORDER BY updated_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

// GET /api/songs/:id  -> cancion completa
router.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM songs WHERE id = ? AND user_id = ? LIMIT 1',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No encontrada.' });
  res.json(rowToSong(rows[0]));
});

// POST /api/songs  -> crear
router.post('/', async (req, res) => {
  let data;
  try { data = normalizeBody(req.body || {}); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const [result] = await pool.query(
    `INSERT INTO songs
      (user_id, title, artist, source_url, content_json, original_key, transpose, bpm, beats_per_bar, accent_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, data.title, data.artist, data.source_url, data.content_json,
     data.original_key, data.transpose, data.bpm, data.beats_per_bar, data.accent_mode]
  );
  const [rows] = await pool.query('SELECT * FROM songs WHERE id = ?', [result.insertId]);
  res.status(201).json(rowToSong(rows[0]));
});

// PUT /api/songs/:id  -> actualizar (transpose, bpm, accent, etc.)
router.put('/:id', async (req, res) => {
  const [existing] = await pool.query(
    'SELECT id FROM songs WHERE id = ? AND user_id = ? LIMIT 1',
    [req.params.id, req.user.id]
  );
  if (!existing[0]) return res.status(404).json({ error: 'No encontrada.' });

  // Actualizacion parcial de los campos de ajuste.
  const fields = [];
  const values = [];
  const b = req.body || {};
  if (b.transpose !== undefined) { fields.push('transpose = ?'); values.push(clampInt(b.transpose, -11, 11, 0)); }
  if (b.bpm !== undefined) { fields.push('bpm = ?'); values.push(clampInt(b.bpm, 20, 400, 100)); }
  if (b.beats_per_bar !== undefined) { fields.push('beats_per_bar = ?'); values.push(clampInt(b.beats_per_bar, 1, 16, 4)); }
  if (b.accent_mode !== undefined && ACCENTS.has(b.accent_mode)) { fields.push('accent_mode = ?'); values.push(b.accent_mode); }
  if (b.title !== undefined && String(b.title).trim()) { fields.push('title = ?'); values.push(String(b.title).trim()); }
  if (b.content !== undefined) { fields.push('content_json = ?'); values.push(typeof b.content === 'string' ? b.content : JSON.stringify(b.content)); }

  if (!fields.length) return res.status(400).json({ error: 'Nada para actualizar.' });

  values.push(req.params.id, req.user.id);
  await pool.query(
    `UPDATE songs SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  );
  const [rows] = await pool.query('SELECT * FROM songs WHERE id = ?', [req.params.id]);
  res.json(rowToSong(rows[0]));
});

// DELETE /api/songs/:id
router.delete('/:id', async (req, res) => {
  const [result] = await pool.query(
    'DELETE FROM songs WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'No encontrada.' });
  res.json({ ok: true });
});

export default router;
