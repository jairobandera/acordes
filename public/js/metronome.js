// Metrónomo con Web Audio API. Scheduling con lookahead para timing preciso.
// Soporta compás (beats por compás, ej 4 para 4/4) y modos de acento:
//   'first' -> acento en el primer golpe
//   'none'  -> todos los golpes iguales (sin acento)
//   'all'   -> acento en todos los golpes

export class Metronome {
  constructor() {
    this.audioCtx = null;
    this.bpm = 100;
    this.beatsPerBar = 4;
    this.accentMode = 'first';
    this.isRunning = false;

    this._currentBeat = 0;
    this._nextNoteTime = 0;
    this._lookahead = 25;        // ms entre chequeos del scheduler
    this._scheduleAhead = 0.1;   // seg que programamos por adelantado
    this._timer = null;

    // callback(beatIndex, beatsPerBar) para feedback visual
    this.onBeat = null;
  }

  _ensureCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  setBpm(v) {
    this.bpm = Math.max(20, Math.min(400, Number(v) || 100));
  }
  setBeatsPerBar(v) {
    this.beatsPerBar = Math.max(1, Math.min(16, Number(v) || 4));
  }
  setAccentMode(mode) {
    if (['first', 'none', 'all'].includes(mode)) this.accentMode = mode;
  }

  _isAccent(beatIndex) {
    if (this.accentMode === 'none') return false;
    if (this.accentMode === 'all') return true;
    return beatIndex === 0; // 'first'
  }

  _scheduleClick(beatIndex, time) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const accent = this._isAccent(beatIndex);
    // Acento = tono más agudo y más fuerte
    osc.frequency.value = accent ? 1500 : 800;
    const peak = accent ? 0.6 : 0.3;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.06);

    // Feedback visual sincronizado
    if (this.onBeat) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => this.onBeat(beatIndex, this.beatsPerBar, accent), delayMs);
    }
  }

  _scheduler() {
    const secondsPerBeat = 60.0 / this.bpm;
    while (this._nextNoteTime < this.audioCtx.currentTime + this._scheduleAhead) {
      this._scheduleClick(this._currentBeat, this._nextNoteTime);
      this._nextNoteTime += secondsPerBeat;
      this._currentBeat = (this._currentBeat + 1) % this.beatsPerBar;
    }
  }

  start() {
    if (this.isRunning) return;
    this._ensureCtx();
    this.isRunning = true;
    this._currentBeat = 0;
    this._nextNoteTime = this.audioCtx.currentTime + 0.05;
    this._timer = setInterval(() => this._scheduler(), this._lookahead);
  }

  stop() {
    this.isRunning = false;
    clearInterval(this._timer);
    this._timer = null;
  }

  toggle() {
    this.isRunning ? this.stop() : this.start();
  }
}
