// Diagramas de acordes para guitarra. Usa el dataset local (chords-db) y
// dibuja un SVG con el digitado. Expone showChordPopover() para el popover.
import { toEnglishChord } from './transpose.js';

let DB = null;      // dataset cargado
let loading = null; // promesa de carga

export function loadChordDB() {
  if (DB) return Promise.resolve(DB);
  if (!loading) {
    loading = fetch('/data/guitar-chords.json')
      .then((r) => r.json())
      .then((j) => { DB = j; return j; })
      .catch(() => { DB = { chords: {} }; return DB; });
  }
  return loading;
}

// Raíz (C, C#, Db...) -> clave del dataset (C, Csharp, Eb, Fsharp, Ab, Bb, B...)
const ROOT_MAP = {
  'C': 'C', 'B#': 'C',
  'C#': 'Csharp', 'Db': 'Csharp',
  'D': 'D',
  'D#': 'Eb', 'Eb': 'Eb',
  'E': 'E', 'Fb': 'E',
  'F': 'F', 'E#': 'F',
  'F#': 'Fsharp', 'Gb': 'Fsharp',
  'G': 'G',
  'G#': 'Ab', 'Ab': 'Ab',
  'A': 'A',
  'A#': 'Bb', 'Bb': 'Bb',
  'B': 'B', 'Cb': 'B',
};

// Sufijo de nuestra notación -> sufijo del dataset.
function mapSuffix(raw) {
  let s = (raw || '').trim();
  if (s === '' ) return 'major';
  // normalizaciones comunes
  s = s.replace('maj', '§maj§'); // proteger maj
  s = s.replace('M7', 'maj7').replace('§maj§', 'maj');
  const table = {
    'm': 'minor', 'min': 'minor', '-': 'minor',
    'maj7': 'maj7', 'maj9': 'maj9', 'maj11': 'maj11', 'maj13': 'maj13',
    'm7': 'm7', 'min7': 'm7',
    'm6': 'm6', 'm9': 'm9', 'm11': 'm11',
    'm7b5': 'm7b5', 'ø': 'm7b5',
    '7': '7', '9': '9', '11': '11', '13': '13',
    '6': '6', '69': '69', '6/9': '69',
    'sus': 'sus4', 'sus4': 'sus4', 'sus2': 'sus2', '7sus4': '7sus4',
    'dim': 'dim', 'dim7': 'dim7', '°': 'dim', 'º': 'dim',
    'aug': 'aug', '+': 'aug', 'aug7': 'aug7',
    'add9': 'add9', '7b5': '7b5', '7b9': '7b9', '7#9': '7#9',
  };
  return table[s] || s; // si no está, probamos tal cual
}

// Devuelve la primera posición (digitado) del acorde, o null.
export function getChordPosition(name) {
  if (!DB || !name) return null;
  // Convertimos español->inglés (Do->C, MIm->Em) para buscar en el dataset.
  const english = toEnglishChord(name);
  const clean = english.trim().split('/')[0]; // ignoramos el bajo para el dibujo
  const m = clean.match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return null;
  const root = ROOT_MAP[m[1] + (m[2] || '')];
  if (!root || !DB.chords[root]) return null;

  const wanted = mapSuffix(m[3]);
  const list = DB.chords[root];
  let entry = list.find((c) => c.suffix === wanted);
  // Fallbacks sensatos si no existe el sufijo exacto
  if (!entry) {
    const base = m[3].startsWith('m') && !/^maj/i.test(m[3]) ? 'minor' : 'major';
    entry = list.find((c) => c.suffix === base);
  }
  if (!entry || !entry.positions?.length) return null;
  return { position: entry.positions[0], root, suffix: entry.suffix };
}

// Dibuja el SVG del acorde a partir de una posición de chords-db.
function renderSVG(name, pos) {
  const frets = pos.frets;       // 6 valores: -1 mute, 0 open, n fret relativo
  const fingers = pos.fingers || [];
  const baseFret = pos.baseFret || 1;
  const barres = pos.barres || [];

  const W = 120, H = 150;
  const padX = 16, padTop = 34, padBottom = 14;
  const gridW = W - padX * 2;
  const gridH = H - padTop - padBottom;
  const nStr = 6, nFret = 5;
  const colW = gridW / (nStr - 1);
  const rowH = gridH / nFret;

  const x = (i) => padX + i * colW;             // string i (0=low E ... 5=high E)
  const y = (f) => padTop + f * rowH;           // fret line f (0..nFret)

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="chord-svg">`;
  svg += `<text x="${W/2}" y="16" text-anchor="middle" class="cd-name">${name}</text>`;

  // Nut (cejilla superior) o número de traste base
  if (baseFret === 1) {
    svg += `<rect x="${x(0)}" y="${padTop-3}" width="${gridW}" height="4" class="cd-nut"/>`;
  } else {
    svg += `<text x="${padX-6}" y="${padTop+rowH-4}" text-anchor="end" class="cd-base">${baseFret}</text>`;
  }

  // Trastes (horizontales) y cuerdas (verticales)
  for (let f = 0; f <= nFret; f++) {
    svg += `<line x1="${x(0)}" y1="${y(f)}" x2="${x(nStr-1)}" y2="${y(f)}" class="cd-line"/>`;
  }
  for (let i = 0; i < nStr; i++) {
    svg += `<line x1="${x(i)}" y1="${padTop}" x2="${x(i)}" y2="${y(nFret)}" class="cd-line"/>`;
  }

  // Barras (cejillas)
  for (const b of barres) {
    const rel = b - (baseFret - 1);
    if (rel < 1 || rel > nFret) continue;
    const cy = y(rel) - rowH / 2;
    svg += `<rect x="${x(0)-5}" y="${cy-5}" width="${gridW+10}" height="10" rx="5" class="cd-barre"/>`;
  }

  // Marcas por cuerda
  for (let i = 0; i < nStr; i++) {
    const v = frets[i];
    const sx = x(i);
    if (v === -1) {
      svg += `<text x="${sx}" y="${padTop-8}" text-anchor="middle" class="cd-mark">✕</text>`;
    } else if (v === 0) {
      svg += `<circle cx="${sx}" cy="${padTop-12}" r="4" class="cd-open"/>`;
    } else {
      const rel = v - (baseFret - 1);
      if (rel < 1 || rel > nFret) continue;
      const cy = y(rel) - rowH / 2;
      svg += `<circle cx="${sx}" cy="${cy}" r="6.5" class="cd-dot"/>`;
      const fg = fingers[i];
      if (fg && fg > 0) svg += `<text x="${sx}" y="${cy+3.5}" text-anchor="middle" class="cd-finger">${fg}</text>`;
    }
  }

  svg += `</svg>`;
  return svg;
}

// Devuelve el HTML del diagrama (o un mensaje si no hay digitado).
export function chordDiagramHTML(name) {
  const got = getChordPosition(name);
  if (!got) return `<div class="cd-missing">Sin diagrama para <b>${name}</b></div>`;
  return renderSVG(name, got.position);
}

// --- Popover ---
let popoverEl = null;
function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.className = 'chord-popover hidden';
  document.body.appendChild(popoverEl);
  document.addEventListener('click', (e) => {
    if (popoverEl && !popoverEl.contains(e.target) && !e.target.classList.contains('chord')) {
      popoverEl.classList.add('hidden');
    }
  });
  return popoverEl;
}

export async function showChordPopover(name, anchorEl) {
  await loadChordDB();
  const pop = ensurePopover();
  pop.innerHTML = chordDiagramHTML(name);
  pop.classList.remove('hidden');
  // Posición: debajo del acorde, sin salirse de la pantalla
  const r = anchorEl.getBoundingClientRect();
  const pw = 140, ph = 170;
  let left = r.left + window.scrollX + r.width / 2 - pw / 2;
  let top = r.bottom + window.scrollY + 6;
  left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - pw - 8));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}
