"""Busca el videoId de YouTube SIN API key (parse de la página de resultados).

Es un best-effort: si YouTube cambia el HTML, cae al link de búsqueda para que
el usuario abra el video manualmente.
"""
import re
import urllib.parse

import httpx

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
_VIDEO_RE = re.compile(r'"videoId":"([A-Za-z0-9_-]{11})"')


async def find_video_id(title: str, artist: str):
    query = f"{artist} {title}".strip()
    search_url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(query)
    headers = {"User-Agent": _UA, "Accept-Language": "es-ES,es;q=0.9"}
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
            r = await client.get(search_url)
            html = r.text
        m = _VIDEO_RE.search(html)
        vid = m.group(1) if m else None
    except Exception:
        vid = None
    return {"youtube_id": vid, "youtube_search": search_url}
