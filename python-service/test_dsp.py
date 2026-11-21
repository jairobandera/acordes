"""Test local del DSP propio (BPM y tonalidad) SIN ffmpeg ni red.

Genera señales sintéticas de BPM y tonalidad conocidos y verifica que
tempo.estimate_bpm / key.estimate_key los aciertan con tolerancia razonable.

Correr:  python test_dsp.py
"""
import numpy as np

import key as key_mod
import tempo


def click_track(bpm, sr=22050, secs=12.0):
    """Clicks (ruido corto) espaciados a 'bpm' sobre silencio."""
    n = int(sr * secs)
    x = np.zeros(n, dtype=np.float32)
    period = int(round(sr * 60.0 / bpm))
    click = (np.random.randn(int(sr * 0.02)) * np.hanning(int(sr * 0.02))).astype(np.float32)
    for start in range(0, n - click.size, period):
        x[start:start + click.size] += click
    return x, sr


def chord_tone(root_midi, sr=22050, secs=8.0):
    """Acorde mayor (triada) sostenido en la tónica dada (MIDI)."""
    t = np.arange(int(sr * secs)) / sr
    semis = [0, 4, 7, 12]  # tónica, 3ª mayor, 5ª, octava
    x = np.zeros_like(t, dtype=np.float32)
    for s in semis:
        f = 440.0 * 2 ** ((root_midi + s - 69) / 12.0)
        x += np.sin(2 * np.pi * f * t).astype(np.float32)
    return (x / len(semis)).astype(np.float32), sr


def test_bpm():
    print("== BPM ==")
    ok = 0
    for target in (90, 120, 140):
        x, sr = click_track(target)
        est, conf = tempo.estimate_bpm(x, sr)
        # Aceptamos el valor o su mitad/doble (errores de octava conocidos).
        hit = est is not None and (
            abs(est - target) <= 3
            or abs(est - target / 2) <= 3
            or abs(est - target * 2) <= 3
        )
        ok += hit
        print(f"  target={target:>3}  estimado={est}  conf={conf}  {'OK' if hit else 'FAIL'}")
    return ok == 3


def test_key():
    print("== Tonalidad ==")
    # C=60, G=67. Esperamos la tónica correcta (modo puede variar en señal sintética).
    cases = {60: "C", 67: "G", 62: "D"}
    ok = 0
    for midi, expect_root in cases.items():
        x, sr = chord_tone(midi)
        info = key_mod.estimate_key(x, sr)
        hit = info is not None and info["root"] == expect_root
        ok += hit
        got = info["key_english"] if info else None
        print(f"  raíz esperada={expect_root}  estimado={got}  {'OK' if hit else 'FAIL'}")
    return ok >= 2


if __name__ == "__main__":
    np.random.seed(0)
    b = test_bpm()
    k = test_key()
    print("\nRESULTADO:", "TODO OK" if (b and k) else "revisar")
