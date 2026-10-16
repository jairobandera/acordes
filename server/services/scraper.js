// Scraper de lacuerda.net y cifraclub.com.
// Obtención de HTML con fetch nativo (rápido y gratis; funciona en ambos sitios).
import 'dotenv/config';
import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// fetch con timeout: si tarda demasiado, aborta.
function fetchT(url, opts = {}, ms = 20000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}

// Devuelve { html, finalUrl } usando el scraper nativo.
export async function fetchHtml(url) {
  const res = await fetchT(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`La página respondió ${res.status}`);
  const html = await res.text();
  return { html, finalUrl: res.url || url, via: 'native' };
}

// ---------------------------------------------------------------------------
// BUSQUEDA: busca.php?exp=term  ->  lista de resultados
// ---------------------------------------------------------------------------

const BASE = 'https://acordes.lacuerda.net';

// Normaliza un título para comparar (sin acentos, minúsculas, espacios colapsados).
function normTitle(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Despachador público: elige la fuente (lacuerda por defecto).
export async function searchSongs(term, source = 'lacuerda') {
  return source === 'cifraclub' ? searchCifraclub(term) : searchLacuerda(term);
}

// --- CIFRACLUB: búsqueda vía su API JSON pública (solr) ---
async function searchCifraclub(term) {
  const url = `https://solr.sscdn.co/cc/h2/?q=${encodeURIComponent(term)}&rows=30`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`cifraclub respondió ${res.status}`);
  const txt = await res.text();
  // La respuesta es JSONP: lo desenvolvemos.
  const json = JSON.parse(txt.trim().replace(/^[^({]*\(/, '').replace(/\)\s*;?\s*$/, ''));
  const docs = json?.response?.docs || [];
  const results = [];
  const seen = new Set();
  for (const d of docs) {
    if (String(d.t) !== '2') continue; // t=2 => canción (t=1 => artista)
    if (!d.d || !d.u) continue;
    const songUrl = `https://www.cifraclub.com/${d.d}/${d.u}/`;
    if (seen.has(songUrl)) continue;
    seen.add(songUrl);
    results.push({ title: d.m || d.u.replace(/-/g, ' '), artist: d.a || d.d.replace(/-/g, ' '), url: songUrl });
  }
  return { term, source: 'cifraclub', results };
}

// --- LACUERDA: búsqueda vía busca.php ---
async function searchLacuerda(term) {
  const url = `${BASE}/busca.php?exp=${encodeURIComponent(term)}`;
  const { html, finalUrl } = await fetchHtml(url);
  const $ = cheerio.load(html);

  const results = [];
  const seen = new Set();
  const push = (r) => {
    const key = r.url;
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push(r);
  };

  // --- Caso 1: busca.php redirigió a la página de un artista ---
  // Las canciones vienen como links reales en ul#b_main > li > a[href].
  $('ul#b_main > li > a, ul.b_main > li > a').each((_, a) => {
    let href = $(a).attr('href');
    if (!href || /^javascript:/i.test(href)) return;
    // Resolvemos links relativos (la página de artista usa href="slug_cancion").
    let abs;
    try { abs = new URL(href, finalUrl).href; } catch { return; }
    const m = abs.match(/lacuerda\.net\/([^/]+)\/([^/?#]+)/);
    if (!m) return;
    const title = $(a).clone().children('em').remove().end().text().trim();
    push({
      title: title || decodeURIComponent(m[2]).replace(/_/g, ' '),
      artist: decodeURIComponent(m[1]).replace(/_/g, ' '),
      url: abs.split('#')[0],
    });
  });

  const artistPageName = $('.bTit h1').first().text().trim() || null;
  if (artistPageName) for (const r of results) r.artist = artistPageName;

  // --- Caso 2: página de resultados con tabla #s_main ---
  // Acá los <li> traen el TÍTULO pero el href es "javascript:" (el slug lo arma
  // su JS con arrays internos que NO están alineados con los títulos mostrados).
  // Para obtener el slug real y correcto, resolvemos cada resultado contra la
  // página del artista (que sí tiene título -> slug reales).
  if (!results.length) {
    // 1) Filas de la tabla: artista + lista de títulos.
    const rows = [];
    $('#s_main tr').each((_, tr) => {
      const $tr = $(tr);
      const aArt = $tr.find('td a[href^="/"]').first();
      const artistSlug = (aArt.attr('href') || '').replace(/^\/|\/$/g, '');
      const artistName = aArt.text().trim();
      if (!artistSlug) return;
      const titles = [];
      $tr.find('ul.b_main > li, ul[id^="b_main"] > li').each((__, li) => {
        const title = $(li).find('a').first().text().trim();
        if (title) titles.push(title);
      });
      if (titles.length) rows.push({ artistSlug, artistName, titles });
    });

    // 2) Mapa título->url por artista (una fetch por artista, en paralelo, con tope).
    const distinctArtists = [...new Set(rows.map((r) => r.artistSlug))].slice(0, 25);
    const maps = {};
    await Promise.allSettled(distinctArtists.map(async (slug) => {
      try {
        const { html: ah, finalUrl: af } = await fetchHtml(`${BASE}/${slug}/`);
        const $$ = cheerio.load(ah);
        const map = {};
        $$('ul#b_main > li > a, ul.b_main > li > a').each((_, a) => {
          let href = $$(a).attr('href');
          if (!href || /^javascript:/i.test(href)) return;
          let abs;
          try { abs = new URL(href, af).href; } catch { return; }
          const title = $$(a).clone().children('em').remove().end().text().trim();
          if (title) map[normTitle(title)] = abs.split('#')[0];
        });
        maps[slug] = map;
      } catch { /* artista que falla se omite */ }
    }));

    // 3) Emitimos resultados con la URL real.
    for (const row of rows) {
      const map = maps[row.artistSlug];
      if (!map) continue;
      for (const title of row.titles) {
        const url = map[normTitle(title)];
        if (!url) continue; // si no matchea, mejor omitir que mostrar otra canción
        push({ title, artist: row.artistName || row.artistSlug.replace(/_/g, ' '), url });
      }
    }
  }

  return { term, finalUrl, artist: artistPageName, results };
}

// ---------------------------------------------------------------------------
// CANCION: parsea titulo, artista y todas las versiones (cada <pre>)
// ---------------------------------------------------------------------------

// Convierte un elemento <pre> en lineas de segmentos.
// chordTag: 'a' para lacuerda (<a>Bm</a>), 'b' para cifraclub (<b>Bm</b>).
// Es recursivo: entra en <div>/<span> para encontrar los acordes anidados.
// Los saltos de linea reales (\n dentro del <pre>) definen las lineas.
// Cada linea = [{ t: 'texto', c: false } | { t: 'Bm', c: true }]
function parsePre($, pre, chordTag = 'a') {
  const CH_START = '\u0001';
  const CH_END = '\u0002';

  let marked = '';
  const walk = (node) => {
    $(node).contents().each((_, n) => {
      if (n.type === 'text') { marked += n.data; return; }
      if (n.type !== 'tag') return;
      const name = (n.name || '').toLowerCase();
      if (name === chordTag) {
        marked += CH_START + $(n).text() + CH_END;
      } else if (name === 'br') {
        marked += '\n';
      } else {
        walk(n); // div, span, etc. -> recursión (los \n reales marcan las lineas)
      }
    });
  };
  walk(pre);

  // Normalizamos saltos de linea
  marked = marked.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const lines = marked.split('\n').map((line) => {
    const segments = [];
    let i = 0;
    while (i < line.length) {
      const start = line.indexOf(CH_START, i);
      if (start === -1) {
        const rest = line.slice(i);
        if (rest) segments.push({ t: rest, c: false });
        break;
      }
      if (start > i) segments.push({ t: line.slice(i, start), c: false });
      const end = line.indexOf(CH_END, start);
      const chordTxt = line.slice(start + 1, end === -1 ? line.length : end);
      if (chordTxt) segments.push({ t: chordTxt, c: true });
      i = end === -1 ? line.length : end + 1;
    }
    return segments;
  });

  // Quitamos lineas totalmente vacias al principio y al final
  while (lines.length && lines[0].length === 0) lines.shift();
  while (lines.length && lines[lines.length - 1].length === 0) lines.pop();

  return lines;
}

// Tipo de transcripcion segun el label de lacuerda
function versionLabel($, li) {
  const label = $(li).find('.rtLabel a, .rtLabel').first().text().trim();
  return label || 'Versión';
}

// Devuelve el <pre> con mas texto de una pagina (el contenido real de la version).
function biggestPre($) {
  let best = null, max = -1;
  $('pre').each((_, pre) => {
    const len = $(pre).text().length;
    if (len > max) { max = len; best = pre; }
  });
  return best;
}

// Despachador público: detecta la fuente por la URL.
export async function scrapeSong(url) {
  if (/cifraclub\.com/i.test(url)) return scrapeCifraclubSong(url);
  return scrapeLacuerdaSong(url);
}

// --- CIFRACLUB: una sola versión, acordes en <b data-chord-name> ---
async function scrapeCifraclubSong(url) {
  const { html, finalUrl, via } = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Título y artista desde el <title>: "Titulo (acordes) - Artista - Cifra Club"
  let title = '';
  let artist = '';
  const parts = ($('title').text() || '').split(' - ').map((s) => s.trim());
  if (parts.length >= 2) {
    title = parts[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
    artist = parts[1];
  }
  if (!title) title = ($('h1').first().text() || '').trim();
  if (!artist) {
    const m = (finalUrl || url).match(/cifraclub\.com\/([^/]+)\//);
    if (m) artist = decodeURIComponent(m[1]).replace(/-/g, ' ');
  }

  // El contenido de acordes está en <pre data-chord-content>
  let pre = $('pre[data-chord-content]').first();
  if (!pre.length) { const bp = biggestPre($); if (bp) pre = $(bp); }
  if (!pre.length) throw new Error('No se encontraron acordes en esta página.');

  const lines = parsePre($, pre, 'b');
  if (!lines.some((l) => l.some((s) => s.t.trim().length))) {
    throw new Error('No se encontraron acordes en esta página.');
  }

  return {
    title: title || 'Sin título',
    artist: artist || 'Desconocido',
    url: (finalUrl || url).split('#')[0],
    via,
    versions: [{ label: 'Acordes', lines }],
  };
}

// --- LACUERDA: varias versiones, acordes en <a> ---
async function scrapeLacuerdaSong(url) {
  const { html, finalUrl, via } = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Titulo y artista
  let title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';
  // La pagina de cancion suele tener "Titulo   Artista" en el h1 principal
  // Mejor: usar breadcrumb y og:url
  let artist = '';

  // breadcrumb: Acordes » S » Soda Stereo » De Música Ligera (Tab)
  const crumb = $('.mhTit').text().replace(/\s+/g, ' ').trim();
  const crumbParts = crumb.split('»').map((s) => s.trim()).filter(Boolean);
  if (crumbParts.length >= 3) {
    artist = crumbParts[crumbParts.length - 2];
    const last = crumbParts[crumbParts.length - 1];
    if (last) title = last.replace(/\(.*?\)\s*$/, '').trim() || title;
  }

  // Fallback de artista por la URL
  if (!artist) {
    const m = (finalUrl || url).match(/acordes\.lacuerda\.net\/([^/]+)\//);
    if (m) artist = decodeURIComponent(m[1]).replace(/_/g, ' ');
  }

  // El h1 de la pagina de cancion a veces trae "Titulo  Artista"; limpiamos.
  title = title.replace(/\s+/g, ' ').trim();
  if (artist && title.toLowerCase().endsWith(artist.toLowerCase())) {
    title = title.slice(0, title.length - artist.length).trim();
  }

  // Versiones.
  // La pagina principal muestra solo un PREVIEW truncado de cada version; el
  // contenido completo esta en su pagina .shtml (una por version). Juntamos los
  // links de version (.rtLabel a) y traemos cada .shtml completo en paralelo.
  const verLinks = [];
  const seenVer = new Set();
  $('.rtLabel a').each((_, a) => {
    const href = $(a).attr('href');
    if (!href) return;
    let abs;
    try { abs = new URL(href, finalUrl || url).href; } catch { return; }
    if (seenVer.has(abs)) return;
    seenVer.add(abs);
    verLinks.push({ label: $(a).text().trim() || 'Versión', url: abs });
  });

  let versions = [];

  if (verLinks.length) {
    const settled = await Promise.allSettled(verLinks.map((v) => fetchHtml(v.url)));
    settled.forEach((res, i) => {
      if (res.status !== 'fulfilled') return;
      const $$ = cheerio.load(res.value.html);
      const pre = biggestPre($$);
      if (!pre) return;
      const lines = parsePre($$, $$(pre));
      if (lines.some((l) => l.some((s) => s.t.trim().length))) {
        versions.push({ label: verLinks[i].label, lines });
      }
    });
  }

  // Fallback: si no hubo links de version (o fallaron), usamos los <pre> de la
  // pagina principal (preview). Mejor algo que nada.
  if (!versions.length) {
    $('pre').each((idx, pre) => {
      const lines = parsePre($, $(pre));
      const hasContent = lines.some((l) => l.some((s) => s.t.trim().length));
      if (!hasContent) return;
      const li = $(pre).closest('li');
      const label = li.length ? versionLabel($, li) : `Versión ${idx + 1}`;
      versions.push({ label, lines });
    });
  }

  if (!versions.length) {
    throw new Error('No se encontraron acordes en esta página.');
  }

  return {
    title: title || 'Sin título',
    artist: artist || 'Desconocido',
    url: (finalUrl || url).split('#')[0],
    via,
    versions,
  };
}
