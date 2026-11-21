// Sincroniza el metrónomo con una canción que está sonando, escuchándola por el micrófono.
//
// 1) Del micrófono saca una "curva de ataques" (cuándo hay golpes: bombo, rasgueo, etc.),
//    con tiempos exactos en el reloj del AudioContext (contando muestras, no timers).
// 2) Con el BPM aproximado, prueba tempos cercanos y todas las fases posibles y se queda
//    con la que mejor cae sobre los golpes. Eso da: BPM fino + en qué momento cae cada tiempo.

const HOP = 512; // muestras por cuadro (~11 ms a 44.1 kHz)

export class BeatSync {
  constructor(ctx) {
    this.ctx = ctx;
    this.frames = []; // { t, o } t = tiempo (reloj del AudioContext), o = fuerza del ataque
    this._nodes = [];
    this._samples = 0;
    this._t0 = null;
    this._lastPt = null;
    this._prev = [null, null];
    this._acc = [0, 0];
    this._accN = 0;
  }

  /** Empieza a escuchar el stream del micrófono. */
  start(stream) {
    this.stop();
    this.frames = [];
    this._samples = 0;
    this._t0 = null;
    this._lastPt = null;
    this._prev = [null, null];
    this._acc = [0, 0];
    this._accN = 0;

    const ctx = this.ctx;
    const src = ctx.createMediaStreamSource(stream);
    const low = ctx.createBiquadFilter(); // banda grave (bombo / bajo)
    low.type = 'lowpass';
    low.frequency.value = 180;
    const merger = ctx.createChannelMerger(2);
    src.connect(merger, 0, 0); // canal 0: todo
    src.connect(low);
    low.connect(merger, 0, 1); // canal 1: graves
    const proc = ctx.createScriptProcessor(2048, 2, 1);
    merger.connect(proc);
    // El processor necesita estar conectado a la salida para que corra; sale en silencio.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    proc.connect(mute);
    mute.connect(ctx.destination);

    const sr = ctx.sampleRate;
    proc.onaudioprocess = (e) => {
      const n = e.inputBuffer.length;
      // Reloj por conteo de muestras: el primer bloque fija el origen y después no hay jitter.
      if (this._t0 === null) this._t0 = ctx.currentTime - n / sr;
      // Si el navegador se saltea bloques (celular cargado, pestaña en segundo plano),
      // playbackTime salta: se suma ese hueco para no "comprimir" el tiempo (daría un BPM más alto).
      const pt = e.playbackTime;
      if (this._lastPt != null && pt - this._lastPt > (1.5 * n) / sr) this._t0 += pt - this._lastPt - n / sr;
      this._lastPt = pt;
      const a = e.inputBuffer.getChannelData(0);
      const b = e.inputBuffer.getChannelData(1);
      for (let i = 0; i < n; i++) {
        this._acc[0] += a[i] * a[i];
        this._acc[1] += b[i] * b[i];
        if (++this._accN === HOP) {
          const t = this._t0 + (this._samples + i - HOP / 2) / sr;
          this._pushFrame(t);
        }
      }
      this._samples += n;
    };
    this._nodes = [src, low, merger, proc, mute];
  }

  _pushFrame(t) {
    let o = 0;
    for (let c = 0; c < 2; c++) {
      const e = Math.log10(1e-10 + this._acc[c] / HOP);
      if (this._prev[c] !== null) o += Math.max(0, e - this._prev[c]) * (c === 1 ? 1.5 : 1);
      this._prev[c] = e;
      this._acc[c] = 0;
    }
    this._accN = 0;
    this.frames.push({ t, o });
  }

  stop() {
    this._nodes.forEach((n) => { try { n.disconnect(); } catch { /* noop */ } });
    if (this._nodes[3]) this._nodes[3].onaudioprocess = null;
    this._nodes = [];
  }

  /** Segundos de audio escuchados. */
  get seconds() {
    return this.frames.length ? this.frames[this.frames.length - 1].t - this.frames[0].t : 0;
  }

  /**
   * Busca el tempo (±4% del aproximado) y la fase que mejor cuadran.
   * Devuelve { bpm, beatTime, confidence } o null si todavía no hay datos.
   * beatTime: un instante (reloj del AudioContext) en el que cayó un tiempo.
   */
  estimate(bpmApprox) {
    if (this.frames.length < 200) return null;
    // Normaliza y se queda con los ataques más claros (ignora el ruido de fondo).
    const vals = this.frames.map((f) => f.o).sort((x, y) => x - y);
    const thr = vals[Math.floor(vals.length * 0.6)];
    const max = vals[vals.length - 1] || 1;
    const pts = this.frames.filter((f) => f.o > thr).map((f) => ({ t: f.t, w: (f.o - thr) / max }));
    if (pts.length < 10) return null;

    const sigma = 0.022;
    const k = 1 / (2 * sigma * sigma);
    let best = null;
    const tryBpm = (bpm) => {
      const P = 60 / bpm;
      const steps = Math.ceil(P / 0.005);
      let rowBest = -1;
      let rowPhase = 0;
      let rowSum = 0;
      for (let s = 0; s < steps; s++) {
        const phi = (s / steps) * P;
        let score = 0;
        for (const p of pts) {
          let d = (p.t - phi) % P;
          if (d < 0) d += P;
          if (d > P / 2) d -= P;
          score += p.w * Math.exp(-d * d * k);
        }
        rowSum += score;
        if (score > rowBest) { rowBest = score; rowPhase = phi; }
      }
      const conf = rowBest / (rowSum / steps || 1);
      if (!best || rowBest > best.score) best = { bpm, beatTime: rowPhase, score: rowBest, confidence: conf };
    };
    // Primero de a 0.25 BPM (±4%), después afina de a 0.05 alrededor del mejor.
    for (let bpm = bpmApprox * 0.96; bpm <= bpmApprox * 1.04; bpm += 0.25) tryBpm(bpm);
    const coarse = best.bpm;
    for (let bpm = coarse - 0.25; bpm <= coarse + 0.25; bpm += 0.05) tryBpm(bpm);
    return { bpm: Math.round(best.bpm * 100) / 100, beatTime: best.beatTime, confidence: best.confidence };
  }
}

/** Próximo tiempo (en el reloj del AudioContext) a partir de `after`, dado un tiempo conocido y el período. */
export function nextBeat(beatTime, bpm, after) {
  const P = 60 / bpm;
  return beatTime + Math.ceil((after - beatTime) / P) * P;
}
