"""Detección de BPM — algoritmo propio (numpy), sin librerías de MIR.

Pipeline:
  1. Envolvente de onsets por FLUJO ESPECTRAL: STFT (rfft por frames con ventana
     Hann), diferencia positiva de magnitudes entre frames consecutivos, sumada
     sobre la frecuencia.
  2. AUTOCORRELACIÓN de esa envolvente.
  3. Se restringen los lags al rango de BPM plausible y se pondera con un PRIOR
     log-gaussiano centrado en ~120 BPM para resolver errores de octava
     (mitad/doble tempo).
  4. Interpolación parabólica alrededor del pico para afinar el valor.
"""
import numpy as np

HOP = 512
WIN = 2048


def _onset_envelope(x: np.ndarray, sr: int):
    """Devuelve (envolvente, env_sr) donde env_sr = frames por segundo."""
    x = np.asarray(x, dtype=np.float32)
    n = x.size
    if n < WIN:
        x = np.pad(x, (0, WIN - n))
        n = x.size
    window = np.hanning(WIN).astype(np.float32)
    frames = 1 + (n - WIN) // HOP
    if frames < 2:
        return np.zeros(0, dtype=np.float32), sr / HOP
    mags = np.empty((frames, WIN // 2 + 1), dtype=np.float32)
    for i in range(frames):
        start = i * HOP
        seg = x[start:start + WIN] * window
        mags[i] = np.abs(np.fft.rfft(seg))
    # Compresión logarítmica: realza los ataques sin que dominen los picos fuertes.
    mags = np.log1p(mags)
    diff = np.diff(mags, axis=0)
    diff[diff < 0] = 0.0
    flux = diff.sum(axis=1)
    # Quitar la media y rectificar (deja solo los aumentos de energía).
    flux = flux - flux.mean()
    flux[flux < 0] = 0.0
    return flux.astype(np.float64), sr / HOP


def _parabolic(y: np.ndarray, i: int) -> float:
    """Ajuste parabólico de 3 puntos: devuelve el desplazamiento sub-muestra del pico."""
    if i <= 0 or i >= y.size - 1:
        return 0.0
    a, b, c = y[i - 1], y[i], y[i + 1]
    denom = (a - 2 * b + c)
    if denom == 0:
        return 0.0
    return 0.5 * (a - c) / denom


def estimate_bpm(x: np.ndarray, sr: int, min_bpm: float = 50.0, max_bpm: float = 200.0):
    """Devuelve (bpm:int|None, confianza:float 0..1)."""
    env, env_sr = _onset_envelope(x, sr)
    if env.size < 4 or not np.any(env):
        return None, 0.0

    env = env - env.mean()
    # Autocorrelación (solo lags >= 0).
    ac = np.correlate(env, env, mode="full")[env.size - 1:]
    ac[0] = 0.0
    if ac.max() <= 0:
        return None, 0.0

    min_lag = max(1, int(round(env_sr * 60.0 / max_bpm)))
    max_lag = int(round(env_sr * 60.0 / min_bpm))
    max_lag = min(max_lag, ac.size - 2)
    if max_lag <= min_lag:
        return None, 0.0

    lags = np.arange(min_lag, max_lag + 1)
    scores = ac[min_lag:max_lag + 1].astype(np.float64)
    scores = scores / (scores.max() + 1e-12)
    bpms = 60.0 * env_sr / lags

    # Prior log-gaussiano alrededor de 120 BPM (resuelve mitad/doble).
    prior = np.exp(-0.5 * (np.log2(bpms / 120.0) / 0.9) ** 2)
    weighted = scores * prior

    k = int(np.argmax(weighted))
    # Afinado sub-lag con parábola sobre la autocorrelación cruda.
    shift = _parabolic(ac, lags[k])
    best_lag = lags[k] + shift
    bpm = 60.0 * env_sr / best_lag

    pos = np.clip(weighted, 0.0, None)
    total = float(pos.sum()) + 1e-12
    conf = float(pos[k] / total) if weighted[k] > 0 else 0.0
    conf = max(0.0, min(1.0, conf))
    return int(round(bpm)), round(conf, 3)
