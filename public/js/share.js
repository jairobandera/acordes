// Página pública de lista compartida (sin login).
import { transposeChord, keyAfterTranspose, detectKey } from './transpose.js';
import { Metronome } from './metronome.js';
import { loadChordDB, showChordPopover } from './chord-diagram.js';

loadChordDB();

const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };

const token = location.pathname.split('/share/')[1] || '';

function beatsLabel(n) {
  const map = { 2: '2/4', 3: '3/4', 4: '4/4', 5: '5/4', 6: '6/8', 7: '7/8' };
  return map[n] || `${n}/4`;
}

// Renderiza una canción (acordes ya transpuestos a la tonalidad guardada).
function renderSong(song) {
  const card = el('div', 'share-song');

  const head = el('div', 'share-song-head');
  const titleWrap = el('div');
  titleWrap.appendChild(el('div', 'card-title', song.title));
  titleWrap.appendChild(el('div', 'card-sub', song.artist));
  head.appendChild(titleWrap);

  const meta = el('div', 'card-meta');
  const lines = (song.content?.[0]?.lines) || [];
  const origKey = song.original_key || detectKey(lines);
  const shownKey = origKey ? keyAfterTranspose(origKey, song.transpose) : null;
  if (shownKey) meta.appendChild(el('span', 'badge key', '♪ ' + shownKey));
  meta.appendChild(el('span', 'badge', song.bpm + ' bpm'));
  meta.appendChild(el('span', 'badge', beatsLabel(song.beats_per_bar)));
  head.appendChild(meta);
  card.appendChild(head);

  // Metrónomo mini
  const metro = new Metronome();
  metro.setBpm(song.bpm); metro.setBeatsPerBar(song.beats_per_bar); metro.setAccentMode(song.accent_mode);
  const metroRow = el('div', 'metro-row', null);
  metroRow.style.marginBottom = '12px';
  const playBtn = el('button', 'btn btn-metro', `▶ ${song.bpm} bpm`);
  playBtn.onclick = () => {
    metro.toggle();
    playBtn.classList.toggle('playing', metro.isRunning);
    playBtn.textContent = metro.isRunning ? '■ Stop' : `▶ ${song.bpm} bpm`;
  };
  metroRow.appendChild(playBtn);
  metroRow.appendChild(el('span', 'metro-opt', `Compás ${beatsLabel(song.beats_per_bar)} · ${accentLabel(song.accent_mode)}`));
  card.appendChild(metroRow);

  // Hoja de acordes (transpuesta)
  const sheet = el('div', 'chord-sheet');
  lines.forEach((segs) => {
    const line = el('div', 'cs-line');
    if (!segs.length) { line.innerHTML = '&nbsp;'; sheet.appendChild(line); return; }
    segs.forEach((seg) => {
      if (seg.c) {
        const shown = transposeChord(seg.t, song.transpose);
        const sp = el('span', 'chord clickable', shown);
        sp.onclick = (ev) => { ev.stopPropagation(); showChordPopover(shown.trim(), sp); };
        line.appendChild(sp);
      } else {
        line.appendChild(document.createTextNode(seg.t));
      }
    });
    sheet.appendChild(line);
  });
  card.appendChild(sheet);

  return card;
}

function accentLabel(m) {
  return m === 'none' ? 'sin acento' : m === 'all' ? 'acento en todos' : 'acento 1er golpe';
}

// Caja para guardar la lista compartida en la cuenta propia.
function renderImport(data) {
  const box = el('div', 'share-import');
  const authToken = localStorage.getItem('acordes_token');

  if (!authToken) {
    const a = el('a', 'btn btn-secondary', 'Iniciá sesión para guardarla en tus listas');
    a.href = '/';
    box.appendChild(a);
    return box;
  }

  const btn = el('button', 'btn btn-primary', '➕ Guardar en mis listas');
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      const r = await fetch(`/api/shared/${encodeURIComponent(token)}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar.');
      box.innerHTML = '';
      box.appendChild(el('span', 'share-import-ok', `✓ Guardada como “${d.name}”. `));
      const a = el('a', 'btn-link', 'Ver en Mis listas ›');
      a.href = '/';
      box.appendChild(a);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '➕ Guardar en mis listas';
      const msg = el('div', 'status error');
      msg.textContent = e.message;
      box.appendChild(msg);
    }
  };
  box.appendChild(btn);
  return box;
}

async function boot() {
  try {
    const res = await fetch(`/api/shared/${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo cargar la lista.');

    $('#shareStatus').classList.add('hidden');
    $('#shareContent').classList.remove('hidden');
    $('#plName').textContent = data.name;
    $('#plOwner').textContent = `Lista compartida por ${data.owner} · ${data.songs.length} canción(es)`;

    const list = $('#songList');
    list.before(renderImport(data));
    if (!data.songs.length) {
      list.appendChild(el('div', 'empty', 'Esta lista no tiene canciones.'));
      return;
    }
    data.songs.forEach((s) => list.appendChild(renderSong(s)));
  } catch (err) {
    $('#shareStatus').textContent = err.message;
    $('#shareStatus').className = 'status error';
  }
}

boot();
