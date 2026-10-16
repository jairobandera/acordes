// Servidor principal: API + sirve el frontend estatico.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { assertDbConnection } from './db/pool.js';
import authRoutes from './routes/auth.js';
import searchRoutes from './routes/search.js';
import songRoutes from './routes/songs.js';
import playlistRoutes from './routes/playlists.js';
import adminRoutes from './routes/admin.js';
import sharedRoutes from './routes/shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.set('trust proxy', true); // respeta x-forwarded-* detrás del hosting

// API
app.use('/api/auth', authRoutes);
app.use('/api', searchRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shared', sharedRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Frontend estatico
const publicDir = join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Página pública de lista compartida
app.get('/share/:token', (req, res) => {
  res.sendFile(join(publicDir, 'share.html'));
});

// SPA fallback (cualquier ruta que no sea /api devuelve index.html)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(join(publicDir, 'index.html'));
});

async function start() {
  try {
    await assertDbConnection();
    console.log('✓ Conectado a MySQL.');
  } catch (err) {
    console.error('✗ No se pudo conectar a MySQL:', err.message);
    console.error('  Asegurate de que XAMPP tenga MySQL corriendo y de haber hecho: npm run init-db');
  }
  app.listen(PORT, () => {
    console.log(`\n🎸 Acordes corriendo en  http://localhost:${PORT}\n`);
  });
}

start();
