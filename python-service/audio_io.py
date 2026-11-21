"""Decodificación de audio a PCM mono con numpy.

Esto es solo utilería (no es "la lógica" de BPM/tonalidad): usa ffmpeg para
pasar cualquier formato (mp3/webm/ogg/m4a...) a float32 mono a la frecuencia
pedida. En producción ffmpeg viene en el Docker; en local hay que tenerlo en PATH.
"""
import shutil
import subprocess
import numpy as np


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def decode_to_mono(src_path: str, target_sr: int = 22050):
    """Devuelve (x: np.float32[], sr) con el audio en mono a target_sr."""
    if not ffmpeg_available():
        raise RuntimeError("ffmpeg no está instalado (necesario para decodificar audio).")
    cmd = [
        "ffmpeg", "-v", "quiet", "-i", src_path,
        "-ac", "1", "-ar", str(target_sr),
        "-f", "f32le", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError("ffmpeg no pudo decodificar el audio.")
    x = np.frombuffer(proc.stdout, dtype=np.float32).copy()
    return x, target_sr
