// Controlador principal de la SPA.
import { api, getToken, setToken } from './api.js';
import { transposeChord, keyAfterTranspose, detectKey } from './transpose.js';
import { Metronome } from './metronome.js';
import { loadChordDB, showChordPopover } from './chord-diagram.js';

// ----------------------- Helpers DOM -----------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

let toastTimer = null;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

// Modal con promesa
function modal({ title, bodyHtml, okText = 'Aceptar', onRender }) {
  return new Promise((resolve) => {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml || '';
    $('#modalOk').textContent = okText;
    $('#modal').classList.remove('hidden');
    if (onRender) onRender($('#modalBody'));

    const cleanup = () => {
      $('#modal').classList.add('hidden');
      $('#modalOk').onclick = null;
      $('#modalCancel').onclick = null;
    };
    $('#modalOk').onclick = () => { cleanup(); resolve(true); };
    $('#modalCancel').onclick = () => { cleanup(); resolve(false); };
  });
}

// ----------------------- Estado -----------------------
const state = {
  user: null,
  current: null,      // canción en el visor { title, artist, versions, ... }
  versionIndex: 0,
  transpose: 0,
  // Tamaño inicial de la hoja de acordes: más chico en celular para que entren
  // más notas sin desbordar (el usuario igual lo ajusta con A- / A+).
  fontSize: window.matchMedia('(max-width: 400px)').matches ? 11
          : window.matchMedia('(max-width: 560px)').matches ? 12 : 15,
  savedSongId: null,  // id en DB si está guardada
  metronome: new Metronome(),
};

// ----------------------- Auth UI -----------------------
function showAuth() {
  $('#authView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
}
function showApp() {
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  $('#userName').textContent = state.user.username;
  $('#topbarUser').textContent = state.user.username + (state.user.role === 'admin' ? ' · admin' : '');
  const isAdmin = state.user.role === 'admin';
  // El admin solo ve Administración; el músico ve Buscar/Canciones/Listas.
  $('#navAdmin').classList.toggle('hidden', !isAdmin);
  ['search', 'library', 'playlists'].forEach((v) => {
    const btn = document.querySelector(`.nav-item[data-view="${v}"]`);
    if (btn) btn.classList.toggle('hidden', isAdmin);
  });
  setupBackGuard(); // manejo del "atrás" en la app instalada
}

// Vista inicial según el rol.
function landingView() {
  return state.user?.role === 'admin' ? 'admin' : 'search';
}

$$('.auth-tab').forEach((tab) => {
  tab.onclick = () => {
    $$('.auth-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    $('#loginForm').classList.toggle('hidden', which !== 'login');
    $('#registerForm').classList.toggle('hidden', which !== 'register');
    $('#authError').textContent = '';
  };
});

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const { token, user } = await api.login({
      username: fd.get('username'),
      password: fd.get('password'),
    });
    setToken(token);
    state.user = user;
    showApp();
    switchView(landingView());
  } catch (err) {
    $('#authError').textContent = err.message;
  }
};

$('#registerForm').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const { token, user } = await api.register({
      username: fd.get('username'),
      password: fd.get('password'),
    });
    setToken(token);
    state.user = user;
    showApp();
    switchView(landingView());
  } catch (err) {
    $('#authError').textContent = err.message;
  }
};

$('#logoutBtn').onclick = () => {
  setToken(null);
  state.user = null;
  state.metronome.stop();
  showAuth();
};

// ----------------------- Navegación -----------------------
function switchView(name) {
  state.currentView = name;
  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === name));
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  closeSidebar();

  if (name === 'library') loadLibrary();
  if (name === 'playlists') loadPlaylists();
  if (name === 'admin') loadAdmin();
}

$$('.nav-item').forEach((n) => {
  if (!n.dataset.view) return; // botones sin vista (ej. instalar) tienen su propio handler
  n.onclick = () => switchView(n.dataset.view);
});

// Sidebar mobile
function openSidebar() { $('#sidebar').classList.add('open'); $('#backdrop').classList.remove('hidden'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#backdrop').classList.add('hidden'); }
$('#menuToggle').onclick = openSidebar;
$('#backdrop').onclick = closeSidebar;

// ----------------------- Buscar -----------------------
$('#searchForm').onsubmit = async (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (!q) return;
  const status = $('#searchStatus');
  const list = $('#searchResults');
  list.innerHTML = '';
  status.textContent = 'Buscando…';
  status.className = 'status';
  try {
    const source = $('#sourceSelect').value;
    const data = await api.search(q, source);
    if (!data.results.length) {
      status.textContent = 'Sin resultados. Probá con otro término (revisá la ortografía).';
      return;
    }
    status.textContent = `${data.results.length} resultado(s)`;
    data.results.forEach((r) => {
      const item = el('div', 'result-item');
      const info = el('div');
      info.appendChild(el('div', 'ri-title', r.title));
      info.appendChild(el('div', 'ri-artist', r.artist));
      item.appendChild(info);
      item.appendChild(el('div', 'ri-go', '›'));
      item.onclick = () => openFromUrl(r.url);
      list.appendChild(item);
    });
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status error';
  }
};

// Si el input queda vacío, dejamos de mostrar resultados hasta la próxima búsqueda.
$('#searchInput').addEventListener('input', (e) => {
  if (!e.target.value.trim()) {
    $('#searchResults').innerHTML = '';
    $('#searchStatus').textContent = '';
    $('#searchStatus').className = 'status';
  }
});

async function openFromUrl(url) {
  const status = $('#searchStatus');
  status.textContent = 'Trayendo acordes…';
  status.className = 'status';
  try {
    const song = await api.scrape(url);
    status.textContent = '';
    loadSongIntoViewer(song, { savedId: null });
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status error';
  }
}

// ----------------------- Visor de canción -----------------------
function loadSongIntoViewer(song, { savedId = null } = {}) {
  state.current = song;
  state.savedSongId = savedId;
  state.versionIndex = 0;

  // Config inicial desde lo guardado (si viene de DB) o por defecto
  state.transpose = Number.isInteger(song.transpose) ? song.transpose : 0;
  state.metronome.setBpm(song.bpm || 100);
  state.metronome.setBeatsPerBar(song.beats_per_bar || 4);
  state.metronome.setAccentMode(song.accent_mode || 'first');

  $('#songTitle').textContent = song.title;
  $('#songArtist').textContent = song.artist;
  $('#bpmInput').value = state.metronome.bpm;
  $('#beatsSelect').value = String(state.metronome.beatsPerBar);
  $('#accentSelect').value = state.metronome.accentMode;

  // Versiones
  const versions = song.versions || (Array.isArray(song.content) ? song.content : []);
  state.current.versions = versions;
  const vsel = $('#versionSelect');
  vsel.innerHTML = '';
  versions.forEach((v, i) => {
    const o = el('option', null, v.label || `Versión ${i + 1}`);
    o.value = String(i);
    vsel.appendChild(o);
  });
  $('#versionGroup').style.display = versions.length > 1 ? '' : 'none';

  buildBeatDots();
  renderSongActions();
  renderSheet();
  loadChordDB(); // precargamos el dataset de diagramas en segundo plano
  switchView('song');
  $$('.nav-item').forEach((n) => n.classList.remove('active'));
}

function currentVersionLines() {
  const v = state.current.versions[state.versionIndex];
  return v ? v.lines : [];
}

function renderSheet() {
  const sheet = $('#chordSheet');
  sheet.innerHTML = '';
  sheet.style.fontSize = state.fontSize + 'px';
  const lines = currentVersionLines();
  const preferFlats = false;

  lines.forEach((segs) => {
    const line = el('div', 'cs-line');
    if (!segs.length) { line.innerHTML = '&nbsp;'; sheet.appendChild(line); return; }
    segs.forEach((seg) => {
      if (seg.c) {
        const shown = transposeChord(seg.t, state.transpose, preferFlats);
        const sp = el('span', 'chord clickable', shown);
        sp.title = 'Ver acorde';
        sp.onclick = (ev) => { ev.stopPropagation(); showChordPopover(shown.trim(), sp); };
        line.appendChild(sp);
      } else {
        line.appendChild(document.createTextNode(seg.t));
      }
    });
    sheet.appendChild(line);
  });

  // Tonalidad mostrada
  const origKey = detectKey(lines);
  const shown = origKey ? keyAfterTranspose(origKey, state.transpose) : '—';
  $('#keyDisplay').textContent = shown || '—';
  $('#transposeAmt').textContent = (state.transpose > 0 ? '+' : '') + state.transpose;
}

// Controles de transporte
$('#transUp').onclick = () => { if (state.transpose < 11) { state.transpose++; renderSheet(); autosaveSettings(); } };
$('#transDown').onclick = () => { if (state.transpose > -11) { state.transpose--; renderSheet(); autosaveSettings(); } };
$('#transReset').onclick = () => { state.transpose = 0; renderSheet(); autosaveSettings(); };

$('#versionSelect').onchange = (e) => { state.versionIndex = Number(e.target.value); renderSheet(); };

$('#fontUp').onclick = () => { state.fontSize = Math.min(26, state.fontSize + 1); renderSheet(); };
$('#fontDown').onclick = () => { state.fontSize = Math.max(10, state.fontSize - 1); renderSheet(); };

$('#backBtn').onclick = () => {
  state.metronome.stop();
  setMetroButton(false);
  switchView(state.savedSongId ? 'library' : 'search');
};

// Acciones (guardar / agregar a lista / borrar)
function renderSongActions() {
  const box = $('#songActions');
  box.innerHTML = '';
  if (state.savedSongId) {
    const addBtn = el('button', 'btn btn-secondary', '+ A una lista');
    addBtn.onclick = addCurrentToPlaylist;
    const delBtn = el('button', 'btn btn-secondary btn-danger', 'Eliminar');
    delBtn.onclick = deleteCurrent;
    box.append(addBtn, delBtn);
  } else {
    const saveBtn = el('button', 'btn btn-primary', '♥ Guardar');
    saveBtn.onclick = saveCurrent;
    box.append(saveBtn);
  }
}

async function saveCurrent() {
  if (!state.current) return;
  const lines = currentVersionLines();
  const origKey = detectKey(lines);
  try {
    const saved = await api.createSong({
      title: state.current.title,
      artist: state.current.artist,
      url: state.current.url,
      // Guardamos la versión elegida como contenido
      content: [{ label: state.current.versions[state.versionIndex].label, lines }],
      original_key: origKey,
      transpose: state.transpose,
      bpm: state.metronome.bpm,
      beats_per_bar: state.metronome.beatsPerBar,
      accent_mode: state.metronome.accentMode,
    });
    state.savedSongId = saved.id;
    renderSongActions();
    toast('Canción guardada ✓', 'ok');
  } catch (err) {
    toast(err.message, 'err');
  }
}

// Autosave de ajustes (transpose/bpm/acento) si la canción está guardada
let autosaveTimer = null;
function autosaveSettings() {
  if (!state.savedSongId) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      await api.updateSong(state.savedSongId, {
        transpose: state.transpose,
        bpm: state.metronome.bpm,
        beats_per_bar: state.metronome.beatsPerBar,
        accent_mode: state.metronome.accentMode,
      });
    } catch { /* silencioso */ }
  }, 600);
}

async function deleteCurrent() {
  if (!state.savedSongId) return;
  const ok = await modal({ title: 'Eliminar canción', bodyHtml: `<p>¿Eliminar "${state.current.title}" de tus canciones?</p>`, okText: 'Eliminar' });
  if (!ok) return;
  try {
    await api.deleteSong(state.savedSongId);
    toast('Eliminada', 'ok');
    switchView('library');
  } catch (err) { toast(err.message, 'err'); }
}

// ----------------------- Metrónomo -----------------------
function buildBeatDots() {
  const box = $('#beatDots');
  box.innerHTML = '';
  for (let i = 0; i < state.metronome.beatsPerBar; i++) {
    const d = el('div', 'beat-dot' + (i === 0 ? ' first' : ''));
    box.appendChild(d);
  }
}
state.metronome.onBeat = (beatIndex, _bpb, accent) => {
  const dots = $$('#beatDots .beat-dot');
  dots.forEach((d) => d.classList.remove('on', 'accent'));
  const d = dots[beatIndex];
  if (d) { d.classList.add('on'); if (accent) d.classList.add('accent'); }
};

function setMetroButton(playing) {
  const b = $('#metroToggle');
  b.classList.toggle('playing', playing);
  b.textContent = playing ? '■ Stop' : '▶ BPM';
}

$('#metroToggle').onclick = () => {
  state.metronome.toggle();
  setMetroButton(state.metronome.isRunning);
};
$('#bpmInput').onchange = (e) => { state.metronome.setBpm(e.target.value); e.target.value = state.metronome.bpm; autosaveSettings(); };
$('#bpmUp').onclick = () => { state.metronome.setBpm(state.metronome.bpm + 1); $('#bpmInput').value = state.metronome.bpm; autosaveSettings(); };
$('#bpmDown').onclick = () => { state.metronome.setBpm(state.metronome.bpm - 1); $('#bpmInput').value = state.metronome.bpm; autosaveSettings(); };
$('#beatsSelect').onchange = (e) => { state.metronome.setBeatsPerBar(e.target.value); buildBeatDots(); autosaveSettings(); };
$('#accentSelect').onchange = (e) => { state.metronome.setAccentMode(e.target.value); autosaveSettings(); };

// Tap tempo
let tapTimes = [];
$('#tapTempo').onclick = () => {
  const now = performance.now();
  tapTimes = tapTimes.filter((t) => now - t < 2500);
  tapTimes.push(now);
  if (tapTimes.length >= 2) {
    const diffs = [];
    for (let i = 1; i < tapTimes.length; i++) diffs.push(tapTimes[i] - tapTimes[i - 1]);
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const bpm = Math.round(60000 / avg);
    state.metronome.setBpm(bpm);
    $('#bpmInput').value = state.metronome.bpm;
    autosaveSettings();
  }
};

// ----------------------- Mis canciones -----------------------
async function loadLibrary() {
  const list = $('#libraryList');
  const status = $('#libraryStatus');
  list.innerHTML = '';
  status.textContent = 'Cargando…';
  try {
    const songs = await api.listSongs();
    status.textContent = '';
    if (!songs.length) {
      list.innerHTML = '<div class="empty">Todavía no guardaste canciones. Buscá una y tocá ♥ Guardar.</div>';
      return;
    }
    songs.forEach((s) => {
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-title', s.title));
      card.appendChild(el('div', 'card-sub', s.artist));
      const meta = el('div', 'card-meta');
      if (s.original_key) {
        const k = keyAfterTranspose(s.original_key, s.transpose);
        meta.appendChild(el('span', 'badge key', '♪ ' + k));
      }
      meta.appendChild(el('span', 'badge', s.bpm + ' bpm'));
      meta.appendChild(el('span', 'badge', beatsLabel(s.beats_per_bar)));
      card.appendChild(meta);

      const del = el('button', 'card-del', '✕');
      del.title = 'Eliminar';
      del.onclick = async (ev) => {
        ev.stopPropagation();
        const ok = await modal({ title: 'Eliminar', bodyHtml: `<p>¿Eliminar "${s.title}"?</p>`, okText: 'Eliminar' });
        if (!ok) return;
        await api.deleteSong(s.id);
        loadLibrary();
      };
      card.appendChild(del);

      card.onclick = () => openSavedSong(s.id);
      list.appendChild(card);
    });
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status error';
  }
}

function beatsLabel(n) {
  const map = { 2: '2/4', 3: '3/4', 4: '4/4', 5: '5/4', 6: '6/8', 7: '7/8' };
  return map[n] || `${n}/4`;
}

async function openSavedSong(id) {
  try {
    const s = await api.getSong(id);
    const song = {
      title: s.title, artist: s.artist, url: s.source_url,
      versions: Array.isArray(s.content) ? s.content : [],
      transpose: s.transpose, bpm: s.bpm, beats_per_bar: s.beats_per_bar, accent_mode: s.accent_mode,
    };
    loadSongIntoViewer(song, { savedId: s.id });
  } catch (err) { toast(err.message, 'err'); }
}

// ----------------------- Listas -----------------------
async function loadPlaylists() {
  $('#playlistDetail').classList.add('hidden');
  $('#playlistsList').classList.remove('hidden');
  const list = $('#playlistsList');
  const status = $('#playlistsStatus');
  list.innerHTML = '';
  status.textContent = 'Cargando…';
  try {
    const pls = await api.listPlaylists();
    status.textContent = '';
    if (!pls.length) {
      list.innerHTML = '<div class="empty">No tenés listas. Creá una con “+ Nueva lista”.</div>';
      return;
    }
    pls.forEach((p) => {
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-title', p.name));
      card.appendChild(el('div', 'card-sub', `${p.song_count} canción(es)`));
      const del = el('button', 'card-del', '✕');
      del.onclick = async (ev) => {
        ev.stopPropagation();
        const ok = await modal({ title: 'Eliminar lista', bodyHtml: `<p>¿Eliminar la lista "${p.name}"?</p>`, okText: 'Eliminar' });
        if (!ok) return;
        await api.deletePlaylist(p.id);
        loadPlaylists();
      };
      card.appendChild(del);
      card.onclick = () => openPlaylist(p.id);
      list.appendChild(card);
    });
  } catch (err) {
    status.textContent = err.message; status.className = 'status error';
  }
}

$('#newPlaylistBtn').onclick = () => {
  $('#modalTitle').textContent = 'Nueva lista';
  $('#modalBody').innerHTML = '<input type="text" id="plName" placeholder="Nombre de la lista">';
  $('#modalOk').textContent = 'Crear';
  $('#modal').classList.remove('hidden');
  $('#plName').focus();
  const done = (ok) => {
    const val = ok ? $('#plName').value.trim() : '';
    $('#modal').classList.add('hidden');
    $('#modalOk').onclick = null; $('#modalCancel').onclick = null;
    if (ok && val) api.createPlaylist(val).then(loadPlaylists).catch((e) => toast(e.message, 'err'));
  };
  $('#modalOk').onclick = () => done(true);
  $('#modalCancel').onclick = () => done(false);
};

async function openPlaylist(id) {
  try {
    const pl = await api.getPlaylist(id);
    const box = $('#playlistDetail');
    $('#playlistsList').classList.add('hidden');
    box.classList.remove('hidden');
    box.innerHTML = '';

    const head = el('div', 'view-head');
    const back = el('button', 'btn-link', '‹ Todas las listas');
    back.onclick = loadPlaylists;
    head.appendChild(back);
    const shareBtn = el('button', 'btn btn-secondary', '🔗 Compartir');
    shareBtn.onclick = () => sharePlaylistModal(id);
    head.appendChild(shareBtn);
    box.appendChild(head);

    box.appendChild(el('h3', 'view-title', pl.name));

    if (!pl.songs.length) {
      box.appendChild(el('div', 'empty', 'Lista vacía. Abrí una canción guardada y usá “+ A una lista”.'));
      return;
    }
    const list = el('div', 'result-list');
    pl.songs.forEach((s) => {
      const item = el('div', 'result-item');
      const info = el('div');
      info.appendChild(el('div', 'ri-title', s.title));
      info.appendChild(el('div', 'ri-artist', `${s.artist} · ${s.bpm} bpm · ${beatsLabel(s.beats_per_bar)}`));
      item.appendChild(info);
      const rm = el('button', 'card-del', '✕');
      rm.style.position = 'static';
      rm.onclick = async (ev) => {
        ev.stopPropagation();
        await api.removeFromPlaylist(id, s.id);
        openPlaylist(id);
      };
      item.appendChild(rm);
      item.onclick = () => openSavedSong(s.id);
      list.appendChild(item);
    });
    box.appendChild(list);
  } catch (err) { toast(err.message, 'err'); }
}

async function addCurrentToPlaylist() {
  if (!state.savedSongId) return;
  try {
    const pls = await api.listPlaylists();
    $('#modalTitle').textContent = 'Agregar a lista';
    const body = $('#modalBody');
    body.innerHTML = '';
    if (!pls.length) {
      body.innerHTML = '<p>No tenés listas todavía. Creá una desde “Mis listas”.</p>';
    } else {
      const wrap = el('div', 'modal-body-list');
      pls.forEach((p) => {
        const row = el('div', 'modal-row');
        row.appendChild(el('span', null, p.name));
        row.appendChild(el('span', 'badge', `${p.song_count}`));
        row.onclick = async () => {
          try {
            await api.addToPlaylist(p.id, state.savedSongId);
            toast('Agregada a la lista ✓', 'ok');
          } catch (e) { toast(e.message, 'err'); }
          close();
        };
        wrap.appendChild(row);
      });
      body.appendChild(wrap);
    }
    $('#modalOk').style.display = 'none';
    $('#modal').classList.remove('hidden');
    const close = () => {
      $('#modal').classList.add('hidden');
      $('#modalOk').style.display = '';
      $('#modalCancel').onclick = null;
    };
    $('#modalCancel').onclick = close;
  } catch (err) { toast(err.message, 'err'); }
}

// ----------------------- Compartir lista -----------------------
async function sharePlaylistModal(id) {
  $('#modalTitle').textContent = 'Compartir lista';
  const body = $('#modalBody');
  body.innerHTML = '<p class="status">Generando link…</p>';
  $('#modalOk').style.display = 'none';
  $('#modal').classList.remove('hidden');

  const close = () => {
    $('#modal').classList.add('hidden');
    $('#modalOk').style.display = '';
    $('#modalCancel').onclick = null;
  };
  $('#modalCancel').onclick = close;

  try {
    const { url } = await api.sharePlaylist(id);
    const waText = encodeURIComponent(`🎸 Mirá esta lista de canciones con acordes:\n${url}`);
    const waLink = `https://wa.me/?text=${waText}`;

    body.innerHTML = `
      <p>Cualquiera con este link puede ver la lista con los acordes, tonalidad y BPM guardados.</p>
      <div class="share-link-box">
        <input type="text" id="shareUrl" readonly value="${url}">
        <button id="copyShare" class="btn btn-secondary">Copiar</button>
      </div>
      <a class="btn btn-whatsapp btn-block" href="${waLink}" target="_blank" rel="noopener">
        Compartir por WhatsApp
      </a>
      <button id="unshareBtn" class="btn-link btn-danger" style="margin-top:12px">Dejar de compartir</button>
    `;
    body.querySelector('#copyShare').onclick = () => {
      const inp = body.querySelector('#shareUrl');
      inp.select();
      navigator.clipboard?.writeText(url).then(() => toast('Link copiado ✓', 'ok')).catch(() => {});
    };
    body.querySelector('#unshareBtn').onclick = async () => {
      try { await api.unsharePlaylist(id); toast('Dejaste de compartir', 'ok'); close(); }
      catch (e) { toast(e.message, 'err'); }
    };
  } catch (err) {
    body.innerHTML = `<p class="status error">${err.message}</p>`;
  }
}

// ----------------------- Administración -----------------------
async function loadAdmin() {
  $('#adminUserDetail').classList.add('hidden');
  $('#adminUsers').classList.remove('hidden');
  const list = $('#adminUsers');
  const status = $('#adminStatus');
  list.innerHTML = '';
  status.textContent = 'Cargando usuarios…';
  try {
    const users = await api.adminUsers();
    status.textContent = '';
    list.innerHTML = '';
    users.forEach((u) => {
      const row = el('div', 'admin-user-row');
      const info = el('div', 'au-info');
      const nameLine = el('div', 'au-name');
      nameLine.appendChild(el('span', null, u.username));
      if (u.role === 'admin') nameLine.appendChild(el('span', 'badge key', 'admin'));
      if (!u.is_active) nameLine.appendChild(el('span', 'badge', 'deshabilitado'));
      info.appendChild(nameLine);
      info.appendChild(el('div', 'au-sub', `${u.song_count} canción(es) · ${u.playlist_count} lista(s)`));
      row.appendChild(info);

      const actions = el('div', 'au-actions');
      const viewBtn = el('button', 'btn-link', 'Ver');
      viewBtn.onclick = () => openUserDetail(u.id);
      actions.appendChild(viewBtn);

      if (u.id !== state.user.id) {
        const toggle = el('button', 'btn-link', u.is_active ? 'Deshabilitar' : 'Habilitar');
        if (u.is_active) toggle.classList.add('btn-danger');
        toggle.onclick = async () => {
          try { await api.adminUpdateUser(u.id, { is_active: u.is_active ? 0 : 1 }); loadAdmin(); }
          catch (e) { toast(e.message, 'err'); }
        };
        actions.appendChild(toggle);
      }
      row.appendChild(actions);
      list.appendChild(row);
    });
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status error';
  }
}

async function openUserDetail(id) {
  try {
    const data = await api.adminUser(id);
    $('#adminUsers').classList.add('hidden');
    const box = $('#adminUserDetail');
    box.classList.remove('hidden');
    box.innerHTML = '';

    const back = el('button', 'btn-link', '‹ Volver a usuarios');
    back.onclick = () => loadAdmin();
    box.appendChild(back);

    box.appendChild(el('h3', 'view-title', data.user.username));
    box.appendChild(el('p', 'song-artist', `${data.user.role}${data.user.is_active ? '' : ' · deshabilitado'}`));

    box.appendChild(el('h4', 'subhead', `Listas (${data.playlists.length})`));
    if (data.playlists.length) {
      const ul = el('div', 'result-list');
      data.playlists.forEach((p) => {
        const item = el('div', 'result-item');
        const info = el('div');
        info.appendChild(el('div', 'ri-title', p.name));
        info.appendChild(el('div', 'ri-artist', `${p.song_count} canción(es)${p.share_token ? ' · compartida' : ''}`));
        item.appendChild(info);
        ul.appendChild(item);
      });
      box.appendChild(ul);
    } else {
      box.appendChild(el('div', 'empty', 'Sin listas.'));
    }

    box.appendChild(el('h4', 'subhead', `Canciones (${data.songs.length})`));
    if (data.songs.length) {
      const ul = el('div', 'result-list');
      data.songs.forEach((s) => {
        const item = el('div', 'result-item');
        const info = el('div');
        info.appendChild(el('div', 'ri-title', s.title));
        info.appendChild(el('div', 'ri-artist', `${s.artist} · ${s.bpm} bpm`));
        item.appendChild(info);
        ul.appendChild(item);
      });
      box.appendChild(ul);
    } else {
      box.appendChild(el('div', 'empty', 'Sin canciones.'));
    }
  } catch (err) { toast(err.message, 'err'); }
}

$('#newUserBtn').onclick = () => {
  $('#modalTitle').textContent = 'Crear usuario';
  $('#modalBody').innerHTML = `
    <div class="form-col">
      <input type="text" id="nuUser" placeholder="Usuario">
      <input type="password" id="nuPass" placeholder="Contraseña (mín. 6)">
      <label class="metro-opt">Rol
        <select id="nuRole" class="select select-sm">
          <option value="musico" selected>Músico</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
    </div>`;
  $('#modalOk').textContent = 'Crear';
  $('#modal').classList.remove('hidden');
  $('#nuUser').focus();
  const done = async (ok) => {
    if (!ok) { closeModal(); return; }
    try {
      await api.adminCreateUser({
        username: $('#nuUser').value.trim(),
        password: $('#nuPass').value,
        role: $('#nuRole').value,
      });
      toast('Usuario creado ✓', 'ok');
      closeModal();
      loadAdmin();
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#modalOk').onclick = () => done(true);
  $('#modalCancel').onclick = () => done(false);
};

function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modalOk').onclick = null;
  $('#modalCancel').onclick = null;
  $('#modalOk').style.display = '';
}

// ----------------------- PWA / Acceso directo -----------------------
// Registramos el service worker (necesario para que se pueda "instalar").
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Capturamos el evento de instalación (Chrome/Android/escritorio).
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  toast('¡Acceso directo creado! ✓', 'ok');
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// --- Botón/gesto "atrás" en la app instalada ---------------------------------
// En modo standalone, el "atrás" (gesto o botón) normalmente cerraría la app.
// Lo interceptamos: si no estás en la búsqueda, te lleva a la búsqueda; si ya
// estás en la búsqueda, muestra un cartel "¿Salir de la aplicación?".
let backGuardReady = false;
let exitingApp = false;

// Hace lo mismo que el botón "Volver" según dónde estés.
// Devuelve true si navegó a algún lado, false si ya estás en el home (hay que salir).
function goBack() {
  // Visor de canción -> vuelve a donde se abrió (como el botón Volver)
  if (state.currentView === 'song') {
    state.metronome.stop();
    setMetroButton(false);
    switchView(state.savedSongId ? 'library' : 'search');
    return true;
  }
  // Detalle de una lista -> vuelve al listado de listas
  if (state.currentView === 'playlists' && !$('#playlistDetail').classList.contains('hidden')) {
    loadPlaylists();
    return true;
  }
  // Detalle de un usuario (admin) -> vuelve al listado de usuarios
  if (state.currentView === 'admin' && !$('#adminUserDetail').classList.contains('hidden')) {
    loadAdmin();
    return true;
  }
  // Vista principal que no es el home -> va al home (búsqueda)
  const home = landingView();
  if (state.currentView && state.currentView !== home) {
    switchView(home);
    return true;
  }
  return false; // ya estás en el home
}

function onAppPopState() {
  if (exitingApp) return; // estamos saliendo a propósito: dejar cerrar
  if (!state.user) { history.pushState({ g: 1 }, ''); return; }
  const navigated = goBack();
  history.pushState({ g: 1 }, ''); // re-armamos la trampa para no cerrar
  if (!navigated) askExitApp(); // estabas en la búsqueda -> preguntar si salir
}

function setupBackGuard() {
  if (!isStandalone() || backGuardReady) return;
  backGuardReady = true;
  history.pushState({ g: 1 }, '');
  window.addEventListener('popstate', onAppPopState);
}

function askExitApp() {
  if (!$('#modal').classList.contains('hidden')) return; // ya hay un modal abierto
  $('#modalTitle').textContent = 'Salir de la aplicación';
  $('#modalBody').innerHTML = '<p>¿Querés salir de la aplicación?</p>';
  $('#modalOk').textContent = 'Salir';
  $('#modal').classList.remove('hidden');
  const cleanup = () => {
    $('#modal').classList.add('hidden');
    $('#modalOk').textContent = 'Aceptar';
    $('#modalOk').onclick = null;
    $('#modalCancel').onclick = null;
  };
  $('#modalCancel').onclick = cleanup; // Cancelar: nos quedamos (trampa ya re-armada)
  $('#modalOk').onclick = () => {
    cleanup();
    // Salir de verdad: dejamos de atrapar y retrocedemos más allá de la entrada.
    exitingApp = true;
    window.removeEventListener('popstate', onAppPopState);
    history.go(-2);
    setTimeout(() => { try { window.close(); } catch { /* noop */ } }, 150);
  };
}

$('#installBtn').onclick = async () => {
  closeSidebar();
  if (isStandalone()) {
    toast('Ya estás usando la app instalada 🎵', 'ok');
    return;
  }
  // Camino ideal: el navegador soporta instalación directa.
  if (deferredInstall) {
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch { /* noop */ }
    deferredInstall = null;
    return;
  }
  // Fallback: instrucciones (iPhone/Safari o navegadores sin prompt).
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('#modalTitle').textContent = 'Crear acceso directo';
  $('#modalBody').innerHTML = isIOS
    ? `<p>En iPhone/iPad:</p>
       <ol style="padding-left:18px; line-height:1.9">
         <li>Tocá el botón <b>Compartir</b> (el cuadrito con la flecha ↑).</li>
         <li>Elegí <b>“Agregar a inicio”</b>.</li>
         <li>Tocá <b>Agregar</b>. ¡Listo, queda el ícono en tu pantalla!</li>
       </ol>`
    : `<p>Para crear el acceso directo:</p>
       <ol style="padding-left:18px; line-height:1.9">
         <li>Abrí el menú del navegador (los <b>⋮</b> arriba a la derecha).</li>
         <li>Elegí <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.</li>
         <li>Confirmá. Queda el ícono 🎵 en tu escritorio/celular.</li>
       </ol>
       <p class="status" style="margin-top:8px">Si no te aparece la opción, recargá la página e intentá de nuevo.</p>`;
  $('#modalOk').style.display = 'none';
  $('#modal').classList.remove('hidden');
  $('#modalCancel').textContent = 'Entendido';
  $('#modalCancel').onclick = () => {
    $('#modal').classList.add('hidden');
    $('#modalOk').style.display = '';
    $('#modalCancel').textContent = 'Cancelar';
    $('#modalCancel').onclick = null;
  };
};

// ----------------------- Arranque -----------------------
async function boot() {
  if (!getToken()) { showAuth(); return; }
  try {
    const { user } = await api.me();
    state.user = user;
    showApp();
    switchView(landingView());
  } catch {
    setToken(null);
    showAuth();
  }
}

boot();
