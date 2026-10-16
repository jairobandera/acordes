// Rutas de busqueda y scraping de lacuerda.
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { searchSongs, scrapeSong } from '../services/scraper.js';

const router = Router();

// GET /api/search?q=soda+stereo&source=lacuerda|cifraclub
router.get('/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const source = (req.query.source || 'lacuerda').toString().toLowerCase();
  if (!q) return res.status(400).json({ error: 'Falta el término de búsqueda.' });
  try {
    const data = await searchSongs(q, source === 'cifraclub' ? 'cifraclub' : 'lacuerda');
    res.json(data);
  } catch (err) {
    console.error('[search]', err.message);
    res.status(502).json({ error: 'No se pudo buscar. Intentá de nuevo.' });
  }
});

// GET /api/scrape?url=... (lacuerda.net o cifraclub.com)
router.get('/scrape', requireAuth, async (req, res) => {
  const url = (req.query.url || '').toString().trim();
  if (!/^https?:\/\/([a-z]+\.)?(lacuerda\.net|cifraclub\.com)\//i.test(url)) {
    return res.status(400).json({ error: 'URL inválida (solo lacuerda.net o cifraclub.com).' });
  }
  try {
    const song = await scrapeSong(url);
    res.json(song);
  } catch (err) {
    console.error('[scrape]', err.message);
    res.status(502).json({ error: err.message || 'No se pudo obtener la canción.' });
  }
});

export default router;
