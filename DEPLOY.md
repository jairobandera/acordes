# 🚀 Deploy en el VPS (Coolify)

La app corre en el VPS de **pckairos.cloud**, administrado con **[Coolify](https://coolify.io)**:
- **App Node** → `https://acordes.pckairos.cloud`
- **PostgreSQL** → en el mismo servidor, base `apps`

La app crea sus tablas sola al arrancar, dentro de un **schema `acordes`** aislado
(nunca toca el schema `public` ni los esquemas de otras apps de la misma base).

---

## Crear la app en Coolify

1. Coolify → proyecto **pckairos** → **New resource → Public repository** → `https://github.com/jairobandera/acordes`, rama `main`.
2. Build pack **Nixpacks**, puerto **3000**, dominio `https://acordes.pckairos.cloud`.
3. En **Environment Variables**, agregá:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `postgresql://USUARIO:CLAVE@HOST-INTERNO:5432/apps` (host = nombre interno del contenedor de PostgreSQL en Coolify) |
| `DB_SCHEMA` | `acordes` |
| `DB_SSL` | `false` (la base está en el mismo servidor) |
| `JWT_SECRET` | una cadena larga al azar |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | la clave que quieras para el admin |
| `PUBLIC_URL` | `https://acordes.pckairos.cloud` |
| `NODE_ENV` | `production` |
| `ANALYZE_SERVICE_URL` | host interno del microservicio Python (ver abajo), ej. `http://acordes-analyze:8000`. Dejalo vacío si todavía no desplegaste esa parte. |

4. **Deploy**. En los **Logs** deberías ver:
   ```
   ✓ Conectado a Postgres.
   ✓ Admin "admin" creado desde variables de entorno.
   🎸 Acordes corriendo en ...
   ```
   (El schema `acordes`, las tablas y el admin se crean solos.)

5. Entrá a `https://acordes.pckairos.cloud` y logueate con `admin` / tu clave. ¡Listo!

---

## Analizar música (microservicio Python) — opcional

La función **"Analizar música"** (reconocer un tema por el micrófono y calcular BPM/tonalidad)
corre en un **segundo servicio** Python (FastAPI), en la carpeta `python-service/` del mismo repo.
El Node le habla por la red interna de Coolify; **no se expone a internet**.

1. Coolify → proyecto **pckairos** → **New resource → Public repository** → mismo repo
   `https://github.com/jairobandera/acordes`, rama `main`.
2. **Base Directory**: `python-service`. Build pack **Dockerfile** (ya incluye **ffmpeg**, que hace falta).
   Puerto interno **8000**. No le pongas dominio público (solo red interna).
3. En el servicio **Node**, poné `ANALYZE_SERVICE_URL` apuntando al nombre interno de este
   contenedor, ej. `http://acordes-analyze:8000` (el nombre lo da Coolify).
4. Deploy. Probá `GET /health` del servicio Python: debería responder `{"ok":true,"ffmpeg":true}`.

> El reconocimiento usa **shazamio** (motor de Shazam, gratis, no oficial). El BPM y la tonalidad
> los calcula código propio (numpy) sobre un preview limpio de Deezer. Todo gratis, sin API keys.
> Si este servicio no está desplegado, el resto de la app funciona igual; solo "Analizar música"
> avisará que el servicio no está disponible.

---

## Notas
- **Aislamiento:** todas las tablas de Acordes viven en el schema **`acordes`**.
- **Siempre encendida:** en el VPS la app no se duerme.
- **Respaldos:** Coolify respalda la base todos los días.
- Si ves errores de conexión: revisá que `DATABASE_URL` tenga el host interno y la clave correctos.
