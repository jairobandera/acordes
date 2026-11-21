// Proxy autenticado al microservicio Python de "Analizar música".
// El navegador manda el audio del micrófono como binario crudo; acá se reenvía
// al servicio Python (ANALYZE_SERVICE_URL) y se devuelve su JSON. El Node no
// procesa audio: solo hace de puente same-origin con la sesión del usuario.
import { Router } from 'express';
import express from 'express';
import { requireAuth } from '../auth.js';

const router = Router();
const SERVICE_URL = process.env.ANALYZE_SERVICE_URL || 'http://localhost:8000';

// POST /api/analyze  (body: audio binario del micrófono)
router.post('/', requireAuth, express.raw({ type: '*/*', limit: '12mb' }), async (req, res) => {
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: 'No se recibió audio.' });
  }
  try {
    const r = await fetch(`${SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': req.headers['content-type'] || 'application/octet-stream' },
      body: req.body,
      signal: AbortSignal.timeout(60000),
    });
    const text = await r.text();
    res.status(r.status).type('application/json').send(text || '{}');
  } catch (err) {
    console.error('analyze proxy error:', err.message);
    res.status(503).json({
      error: 'El servicio de análisis no está disponible. Intentá de nuevo en un momento.',
    });
  }
});

export default router;
