// Cliente de la API. Maneja el token JWT en localStorage.

const TOKEN_KEY = 'acordes_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body, opts = {}) {
  const raw = opts.raw === true; // body binario (Blob/ArrayBuffer): no se serializa a JSON
  const headers = {};
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers, // si body es un Blob, fetch pone el Content-Type del propio Blob
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const msg = (data && data.error) || `Error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  register: (payload) => request('POST', '/auth/register', payload),
  login: (payload) => request('POST', '/auth/login', payload),
  me: () => request('GET', '/auth/me'),

  // Búsqueda / scraping
  search: (q, source = 'lacuerda') => request('GET', `/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`),
  scrape: (url) => request('GET', `/scrape?url=${encodeURIComponent(url)}`),

  // Canciones
  listSongs: () => request('GET', '/songs'),
  getSong: (id) => request('GET', `/songs/${id}`),
  createSong: (payload) => request('POST', '/songs', payload),
  updateSong: (id, payload) => request('PUT', `/songs/${id}`, payload),
  deleteSong: (id) => request('DELETE', `/songs/${id}`),

  // Listas
  listPlaylists: () => request('GET', '/playlists'),
  getPlaylist: (id) => request('GET', `/playlists/${id}`),
  createPlaylist: (name) => request('POST', '/playlists', { name }),
  renamePlaylist: (id, name) => request('PUT', `/playlists/${id}`, { name }),
  deletePlaylist: (id) => request('DELETE', `/playlists/${id}`),
  addToPlaylist: (id, songId) => request('POST', `/playlists/${id}/songs`, { song_id: songId }),
  removeFromPlaylist: (id, songId) => request('DELETE', `/playlists/${id}/songs/${songId}`),
  reorderPlaylist: (id, songIds) => request('PUT', `/playlists/${id}/order`, { song_ids: songIds }),
  sharePlaylist: (id) => request('POST', `/playlists/${id}/share`),
  unsharePlaylist: (id) => request('DELETE', `/playlists/${id}/share`),

  // Analizar música (manda el audio del micrófono como binario crudo)
  analyze: (blob) => request('POST', '/analyze', blob, { raw: true }),

  // Admin
  adminUsers: () => request('GET', '/admin/users'),
  adminUser: (id) => request('GET', `/admin/users/${id}`),
  adminCreateUser: (payload) => request('POST', '/admin/users', payload),
  adminUpdateUser: (id, payload) => request('PATCH', `/admin/users/${id}`, payload),
  adminDeleteUser: (id) => request('DELETE', `/admin/users/${id}`),
};
