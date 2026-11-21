"""Reconocimiento del tema con shazamio (ÚNICA API de identificación).

shazamio usa el motor de Shazam (gratis, no oficial). Según la versión expone
`recognize(path)` (nuevas) o `recognize_song(path)` (viejas): soportamos ambas.
Necesita ffmpeg para convertir el audio del micrófono.
"""
from shazamio import Shazam


async def _raw_recognize(path: str) -> dict:
    shazam = Shazam()
    # API nueva
    if hasattr(shazam, "recognize"):
        try:
            return await shazam.recognize(path)
        except TypeError:
            pass
    # API vieja
    if hasattr(shazam, "recognize_song"):
        return await shazam.recognize_song(path)
    raise RuntimeError("shazamio no expone recognize/recognize_song")


async def identify(path: str):
    """Devuelve {title, artist, cover, shazam_url, isrc} o None si no reconoce."""
    out = await _raw_recognize(path)
    track = (out or {}).get("track")
    if not track:
        return None
    images = track.get("images") or {}
    title = track.get("title")
    artist = track.get("subtitle")
    if not title:
        return None
    return {
        "title": title,
        "artist": artist or "",
        "cover": images.get("coverarthq") or images.get("coverart"),
        "shazam_url": track.get("url"),
        "isrc": track.get("isrc"),
    }
