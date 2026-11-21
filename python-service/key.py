"""Detección de tonalidad — algoritmo propio (numpy): croma + Krumhansl-Schmuckler.

Pipeline:
  1. CROMA: STFT, cada bin de frecuencia se asigna a una de las 12 clases de altura
     (pitch classes) y se acumula su magnitud; se promedia en el tiempo.
  2. KRUMHANSL-SCHMUCKLER: se correlaciona el vector croma con los 24 perfiles
     (12 mayores + 12 menores) rotados; el máximo da tónica + modo.

Devuelve la tonalidad en notación inglesa (G, Em) y española (Sol mayor, Mi menor).
"""
import numpy as np

# Perfiles de Krumhansl-Kessler.
KS_MAJOR = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
KS_MINOR = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)

NOTES_EN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
NOTES_ES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"]

WIN = 4096
HOP = 2048
FMIN = 55.0     # ~A1
FMAX = 5000.0


def _chroma(x: np.ndarray, sr: int) -> np.ndarray:
    x = np.asarray(x, dtype=np.float32)
    n = x.size
    if n < WIN:
        x = np.pad(x, (0, WIN - n))
        n = x.size
    window = np.hanning(WIN).astype(np.float32)
    freqs = np.fft.rfftfreq(WIN, 1.0 / sr)
    with np.errstate(divide="ignore", invalid="ignore"):
        midi = 69.0 + 12.0 * np.log2(np.where(freqs > 0, freqs, np.nan) / 440.0)
    pc = np.mod(np.round(midi), 12)
    valid = (freqs >= FMIN) & (freqs <= FMAX) & np.isfinite(pc)
    pc_valid = pc[valid].astype(int)

    frames = 1 + (n - WIN) // HOP
    chroma = np.zeros(12, dtype=np.float64)
    for i in range(frames):
        start = i * HOP
        seg = x[start:start + WIN] * window
        mag = np.abs(np.fft.rfft(seg))[valid]
        # Acumular por clase de altura.
        np.add.at(chroma, pc_valid, mag)
    s = chroma.sum()
    if s > 0:
        chroma /= s
    return chroma


def _corr(a: np.ndarray, b: np.ndarray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d > 0 else 0.0


def estimate_key(x: np.ndarray, sr: int):
    chroma = _chroma(x, sr)
    if not np.any(chroma):
        return None

    best_score = -2.0
    best_root = 0
    best_mode = "major"
    for i in range(12):
        cm = _corr(chroma, np.roll(KS_MAJOR, i))
        if cm > best_score:
            best_score, best_root, best_mode = cm, i, "major"
        cn = _corr(chroma, np.roll(KS_MINOR, i))
        if cn > best_score:
            best_score, best_root, best_mode = cn, i, "minor"

    en = NOTES_EN[best_root] + ("" if best_mode == "major" else "m")
    es = NOTES_ES[best_root] + (" mayor" if best_mode == "major" else " menor")
    return {
        "key_english": en,
        "key": es,
        "root": NOTES_EN[best_root],
        "mode": best_mode,
        "confidence": round(float(best_score), 3),
    }
