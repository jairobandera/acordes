"""Audio LIMPIO del tema reconocido, vía la API pública de Deezer (sin key).

Se usa SOLO para bajar un preview mp3 (30s) limpio sobre el cual corren NUESTROS
algoritmos de BPM/tonalidad. NO se usan los campos bpm/key que trae Deezer.
"""
import httpx

SEARCH_URL = "https://api.deezer.com/search"


def _norm(s: str) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum() or ch.isspace()).strip()


async def fetch_preview(title: str, artist: str):
    """Devuelve {preview_url, audio(bytes), deezer:{title,artist}} o None."""
    query = f"{artist} {title}".strip()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(SEARCH_URL, params={"q": query, "limit": 8})
        r.raise_for_status()
        results = (r.json() or {}).get("data") or []

    if not results:
        return None

    want_artist = _norm(artist)
    want_title = _norm(title)

    def score(t: dict) -> int:
        ta = _norm((t.get("artist") or {}).get("name", ""))
        tt = _norm(t.get("title", ""))
        s = 0
        if t.get("preview"):
            s += 1
        if want_artist and want_artist in ta:
            s += 2
        if want_title and (want_title in tt or tt in want_title):
            s += 2
        return s

    best = max(results, key=score)
    preview = best.get("preview")
    if not preview:
        for t in results:
            if t.get("preview"):
                best, preview = t, t["preview"]
                break
    if not preview:
        return None

    async with httpx.AsyncClient(timeout=25.0) as client:
        a = await client.get(preview)
        a.raise_for_status()
        audio = a.content

    return {
        "preview_url": preview,
        "audio": audio,
        "deezer": {
            "title": best.get("title"),
            "artist": (best.get("artist") or {}).get("name"),
        },
    }
