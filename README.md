# 🎸 Acordes — Cancionero con acordes de lacuerda.net

App web para **buscar, scrapear, transponer y organizar** acordes de [lacuerda.net](https://lacuerda.net), con login de usuarios, listas de canciones y metrónomo.

## Características

- 🔎 **Buscar** canciones por artista/nombre (resultados en vivo desde lacuerda.net).
- 🎼 **Acordes alineados** con la letra (respeta el formato original).
- 🎚️ **Transponer** de a medio tono (subir/bajar tonalidad) y **guardar la tonalidad**.
- 🔁 **Varias versiones** por canción (las que ofrece lacuerda).
- 👤 **Registro e inicio de sesión** (contraseñas hasheadas con bcrypt, sesión con JWT).
- 💾 **Guardar canciones** por usuario (PostgreSQL).
- 📂 **Listas de canciones** (setlists), con agregar/quitar y reordenar.
- 🥁 **Metrónomo** por canción con BPM, compás (2/4, 3/4, 4/4, 5/4, 6/8, 7/8), **TAP tempo** y acento configurable: *primer golpe*, *todos* o *sin acento*.
- 🔗 **Compartir listas** por link (y botón de **WhatsApp**) con todas las canciones, su tonalidad y BPM. La página compartida es pública y de solo lectura, sin login.
- 👑 **Dos roles**: *músico* (uso normal) y *administrador*. El admin ve todos los usuarios y sus listas/canciones, puede **crear usuarios** y **deshabilitar/habilitar cuentas**.
- 🎸 **Dos fuentes**: lacuerda.net y cifraclub.com (elegís en el buscador).
- 🎵 **Diagramas de acordes**: tocás un acorde y ves el digitado en la guitarra.
- 🎧 **Analizar música**: escucha por el micrófono, **identifica la canción exacta**, muestra artista/BPM/tonalidad y un **reproductor de YouTube**. El BPM y la tonalidad los calcula lógica propia (sin API); solo la identificación usa un servicio.
- 📱 **Responsive** (se adapta a celular, tablet y escritorio).

## Stack

- **Frontend:** HTML + CSS + JavaScript nativo (sin frameworks).
- **Backend:** Node.js + Express.
- **Base de datos:** PostgreSQL (en el VPS, junto a la app). Todo vive en un schema `acordes` aislado.
- **Scraper:** nativo (fetch + cheerio), gratis y sin API keys. Funciona para lacuerda.net y cifraclub.com.
- **Analizar música:** microservicio **Python** aparte (FastAPI) en `python-service/`. Reconoce el tema con **shazamio** (motor de Shazam) y calcula **BPM/tonalidad con algoritmos propios (numpy)** sobre un preview limpio de Deezer. Es opcional: si no está desplegado, el resto de la app anda igual.

---

## Puesta en marcha

### 1. Requisitos
- [Node.js](https://nodejs.org) 18 o superior (probado con v24).
- Una base **PostgreSQL** (local, o la del VPS por túnel SSH).

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copiá `.env.example` a `.env` y pegá tu **connection string de PostgreSQL** en `DATABASE_URL`.
Dejá `DB_SCHEMA=acordes`; `DB_SSL=false` para una base local o del mismo servidor.

### 4. Crear el schema y las tablas
```bash
npm run init-db
```
Crea el schema **`acordes`** y todas las tablas (no toca el schema `public`).
También se crean solas al arrancar el server.

### 4b. Crear el usuario administrador
```bash
npm run create-admin
```
Crea la cuenta **admin / 123456**. (Podés pasar otros datos: `npm run create-admin usuario clave`.)
> O ponés `ADMIN_USERNAME` / `ADMIN_PASSWORD` en el `.env` y se crea solo al arrancar.

### 5. Arrancar el servidor
```bash
npm start
```
Abrí tu navegador en **http://localhost:3000**

Creá una cuenta, buscá una canción y ¡a tocar! 🎶

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Levanta el servidor en el puerto 3000. |
| `npm run dev` | Igual, pero reinicia al guardar cambios (`node --watch`). |
| `npm run init-db` | Crea la base de datos y las tablas (instalación nueva). |
| `npm run migrate` | Agrega columnas/tablas nuevas sin borrar datos (actualización). |
| `npm run create-admin` | Crea/actualiza la cuenta admin (por defecto admin/123456). |

## Compartir una lista

Entrá a una de tus listas → botón **🔗 Compartir** → copiás el link o lo mandás por **WhatsApp**.
Quien lo abra ve la lista con los acordes en la tonalidad y el BPM guardados, sin necesidad de registrarse.

> En local el link usa `localhost`, así que solo funciona en tu PC. Para que funcione por internet (para tu banda), hacé el **deploy gratis**: ver [DEPLOY.md](DEPLOY.md).

## Administrador

Entrá con la cuenta admin → el menú muestra solo **🛠️ Administración**. Desde ahí ves todos los usuarios, sus listas y canciones, podés crear usuarios y deshabilitar cuentas.

## Estructura

```
Acordes/
├── server/
│   ├── index.js            # Servidor Express + sirve el frontend
│   ├── auth.js             # JWT + middleware
│   ├── db/
│   │   ├── pool.js         # Pool PostgreSQL (schema acordes) + wrapper
│   │   ├── schema.sql      # Esquema de la base
│   │   └── initdb.js       # Crea base y tablas
│   ├── routes/             # auth, search, songs, playlists, analyze (proxy)
│   └── services/
│       └── scraper.js      # scraper nativo (lacuerda + cifraclub) + parser
├── public/                 # Frontend (HTML/CSS/JS nativo)
│   ├── index.html
│   ├── css/styles.css
│   └── js/                 # api, transpose, metronome, app
└── python-service/         # Microservicio "Analizar música" (FastAPI)
    ├── app.py              # POST /analyze
    ├── recognizer.py       # shazamio (identificación)
    ├── clean_audio.py      # preview limpio (Deezer)
    ├── tempo.py / key.py   # BPM y tonalidad: algoritmos propios (numpy)
    ├── youtube.py          # videoId para el reproductor (sin key)
    └── Dockerfile          # incluye ffmpeg
```

## Analizar música

Entrá a **🎧 Analizar música** → **Escuchar**: la app graba ~10s del micrófono, identifica el tema
y muestra artista, **BPM**, **tonalidad** y un reproductor de YouTube. Botones para **usar ese BPM en
el metrónomo** o **buscar los acordes** del tema. Necesita el microservicio Python corriendo
(`ANALYZE_SERVICE_URL`); ver [DEPLOY.md](DEPLOY.md). En local requiere **ffmpeg** instalado.

## Notas

- El scraping es solo para uso personal; respetá los términos de lacuerda.net.
- La transposición usa notación inglesa (A, B, C, D, E, F, G con # y b), que es la que usa lacuerda.
