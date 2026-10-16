// Transposición de acordes. Soporta notación INGLESA (A B C D E F G) y
// ESPAÑOLA (Do Re Mi Fa Sol La Si), con # y b. Detecta la notación de cada
// acorde y devuelve el resultado en la MISMA notación (y respetando mayúsculas).

const SHARP_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_EN  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP_ES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const FLAT_ES  = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

// Índice (0..11) de cada nota base.
const EN_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ES_BASE = { DO: 0, RE: 2, MI: 4, FA: 5, SOL: 7, LA: 9, SI: 11 };

// Parsea la raíz al inicio de una cadena.
// Devuelve { index, length, lang: 'es'|'en', upper } o null.
function parseRoot(str) {
  if (!str) return null;

  // Español primero (Sol antes que Si por ser más largo).
  const es = str.match(/^(Sol|Do|Re|Mi|Fa|La|Si)([#b]?)/i);
  if (es) {
    const base = ES_BASE[es[1].toUpperCase()];
    if (base !== undefined) {
      const acc = es[2] === '#' ? 1 : es[2] === 'b' ? -1 : 0;
      return {
        index: (base + acc + 12) % 12,
        length: es[0].length,
        lang: 'es',
        upper: es[1] === es[1].toUpperCase(),
      };
    }
  }

  // Inglés.
  const en = str.match(/^([A-G])([#b]?)/);
  if (en) {
    const base = EN_BASE[en[1]];
    const acc = en[2] === '#' ? 1 : en[2] === 'b' ? -1 : 0;
    return { index: (base + acc + 12) % 12, length: en[0].length, lang: 'en', upper: true };
  }

  return null;
}

// Nombre de nota a partir del índice, en la notación/caso pedido.
function noteName(index, preferFlats, lang = 'en', upper = true) {
  const i = ((index % 12) + 12) % 12;
  if (lang === 'es') {
    const name = preferFlats ? FLAT_ES[i] : SHARP_ES[i];
    if (!upper) return name;
    // Mayúsculas solo en las letras; el bemol 'b' queda en minúscula.
    const acc = /[#b]$/.test(name) ? name.slice(-1) : '';
    const bodyLen = acc ? name.length - 1 : name.length;
    return name.slice(0, bodyLen).toUpperCase() + acc;
  }
  return preferFlats ? FLAT_EN[i] : SHARP_EN[i];
}

// Transpone un token de acorde completo (con sufijo y bajo /X), preservando notación.
export function transposeChord(chord, semitones, preferFlats = false) {
  if (!chord || semitones === 0) return chord;

  const lead = chord.match(/^\s*/)[0];
  const trail = chord.match(/\s*$/)[0];
  const body = chord.slice(lead.length, chord.length - trail.length);
  if (!body) return chord;

  const slashIdx = body.indexOf('/');
  const main = slashIdx >= 0 ? body.slice(0, slashIdx) : body;
  const bass = slashIdx >= 0 ? body.slice(slashIdx + 1) : null;

  const root = parseRoot(main);
  if (!root) return chord; // no es un acorde reconocible

  const suffix = main.slice(root.length);
  let out = noteName(root.index + semitones, preferFlats, root.lang, root.upper) + suffix;

  if (bass !== null) {
    const bassRoot = parseRoot(bass);
    if (bassRoot) {
      const bassSuffix = bass.slice(bassRoot.length);
      out += '/' + noteName(bassRoot.index + semitones, preferFlats, bassRoot.lang, bassRoot.upper) + bassSuffix;
    } else {
      out += '/' + bass;
    }
  }

  return lead + out + trail;
}

// Convierte un acorde (español o inglés) a inglés — para buscar el diagrama.
export function toEnglishChord(name) {
  if (!name) return name;
  const conv = (part) => {
    const r = parseRoot(part.trim());
    if (!r) return part.trim();
    return SHARP_EN[r.index] + part.trim().slice(r.length);
  };
  const [main, bass] = name.split('/');
  let out = conv(main);
  if (bass !== undefined) out += '/' + conv(bass);
  return out;
}

// Tonalidad resultante de transponer (preserva notación del original).
export function keyAfterTranspose(originalKey, semitones, preferFlats = false) {
  if (!originalKey) return null;
  const root = parseRoot(originalKey);
  if (!root) return originalKey;
  const suffix = originalKey.slice(root.length);
  return noteName(root.index + semitones, preferFlats, root.lang, root.upper) + suffix;
}

// Deduce la tonalidad original: primer acorde del contenido (en su notación).
export function detectKey(versionLines) {
  for (const line of versionLines) {
    for (const seg of line) {
      if (seg.c) {
        const txt = seg.t.trim();
        const root = parseRoot(txt);
        if (root) {
          const isMinor = /^m(?!a)/i.test(txt.slice(root.length));
          return noteName(root.index, false, root.lang, root.upper) + (isMinor ? 'm' : '');
        }
      }
    }
  }
  return null;
}
