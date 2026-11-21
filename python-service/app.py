"""Microservicio de "Analizar música" (FastAPI).

POST /analyze  recibe el audio crudo del micrófono (bytes) y devuelve:
  { recognized, title, artist, cover, bpm, bpm_source, key, key_english,
    youtube_id, youtube_search, preview_url }

- Reconocimiento: shazamio (ÚNICA API de identificación).
- BPM y tonalidad: algoritmos propios (tempo.py / key.py) sobre audio LIMPIO
  (preview de Deezer) del tema reconocido; si no hay preview, sobre el micrófono.
- Reproductor: videoId de YouTube (sin key).

El server Node hace de proxy y mete la autenticación; este servicio no es público.
"""
import os
import tempfile

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import audio_io
import clean_audio
import key as key_mod
import recognizer
import tempo
import youtube

app = FastAPI(title="Acordes · Analizar música")

# CORS permisivo: en producción el acceso real va por el proxy Node en red interna;
# esto solo ayuda a probar en local pegándole directo al servicio.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "ffmpeg": audio_io.ffmpeg_available()}


def _save_temp(data: bytes, suffix: str) -> str:
    f = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        f.write(data)
        return f.name
    finally:
        f.close()


@app.post("/analyze")
async def analyze(request: Request):
    raw = await request.body()
    if not raw:
        return JSONResponse({"error": "Audio vacío."}, status_code=400)

    temp_files = []
    mic_path = _save_temp(raw, ".webm")
    temp_files.append(mic_path)

    try:
        # 1) Identificar el tema (shazamio).
        try:
            track = await recognizer.identify(mic_path)
        except Exception as exc:  # noqa: BLE001
            return JSONResponse(
                {"recognized": False, "error": f"No se pudo reconocer: {exc}"},
                status_code=200,
            )
        if not track:
            return {"recognized": False}

        # 2) Audio limpio del tema (Deezer) para el DSP.
        clean = None
        try:
            clean = await clean_audio.fetch_preview(track["title"], track["artist"])
        except Exception:  # noqa: BLE001
            clean = None

        preview_url = None
        if clean and clean.get("audio"):
            preview_url = clean["preview_url"]
            dsp_path = _save_temp(clean["audio"], ".mp3")
            temp_files.append(dsp_path)
            bpm_source = "preview"
        else:
            dsp_path = mic_path
            bpm_source = "micro"

        # 3) BPM y tonalidad con NUESTROS algoritmos.
        bpm = None
        key_info = None
        try:
            x, sr = audio_io.decode_to_mono(dsp_path, 22050)
            bpm, _bpm_conf = tempo.estimate_bpm(x, sr)
            key_info = key_mod.estimate_key(x, sr)
        except Exception:  # noqa: BLE001
            pass
        if bpm is None:
            bpm_source = None

        # 4) Video de YouTube para el reproductor.
        yt = await youtube.find_video_id(track["title"], track["artist"])

        return {
            "recognized": True,
            "title": track["title"],
            "artist": track["artist"],
            "cover": track.get("cover"),
            "shazam_url": track.get("shazam_url"),
            "bpm": bpm,
            "bpm_source": bpm_source,
            "key": key_info["key"] if key_info else None,
            "key_english": key_info["key_english"] if key_info else None,
            "youtube_id": yt.get("youtube_id"),
            "youtube_search": yt.get("youtube_search"),
            "preview_url": preview_url,
        }
    finally:
        for p in temp_files:
            try:
                os.unlink(p)
            except OSError:
                pass
