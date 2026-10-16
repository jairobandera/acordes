# 🎸 Acordes — Cancionero con acordes de lacuerda.net

App web para **buscar, scrapear, transponer y organizar** acordes de [lacuerda.net](https://lacuerda.net), con login de usuarios, listas de canciones y metrónomo.

## Características

- 🔎 **Buscar** canciones por artista/nombre (resultados en vivo desde lacuerda.net).
- 🎼 **Acordes alineados** con la letra (respeta el formato original).
- 🎚️ **Transponer** de a medio tono (subir/bajar tonalidad) y **guardar la tonalidad**.
- 🔁 **Varias versiones** por canción (las que ofrece lacuerda).
- 👤 **Registro e inicio de sesión** (contraseñas hasheadas con bcrypt, sesión con JWT).
- 💾 **Guardar canciones** por usuario (MySQL).
- 📂 **Listas de canciones** (setlists), con agregar/quitar y reordenar.
- 🥁 **Metrónomo** por canción con BPM, compás (2/4, 3/4, 4/4, 5/4, 6/8, 7/8), **TAP tempo** y acento configurable: *primer golpe*, *todos* o *sin acento*.
- 🔗 **Compartir listas** por link (y botón de **WhatsApp**) con todas las canciones, su tonalidad y BPM. La página compartida es pública y de solo lectura, sin login.
- 👑 **Dos roles**: *músico* (uso normal) y *administrador*. El admin ve todos los usuarios y sus listas/canciones, puede **crear usuarios** y **deshabilitar/habilitar cuentas**.
- 🎸 **Dos fuentes**: lacuerda.net y cifraclub.com (elegís en el buscador).
- 🎵 **Diagramas de acordes**: tocás un acorde y ves el digitado en la guitarra.
- 📱 **Responsive** (se adapta a celular, tablet y escritorio).

## Stack

- **Frontend:** HTML + CSS + JavaScript nativo (sin frameworks).
- **Backend:** Node.js + Express.
- **Base de datos:** MySQL (pensado para XAMPP por defecto).
- **Scraper:** nativo (fetch + cheerio), gratis y sin API keys. Funciona para lacuerda.net y cifraclub.com.

---

## Puesta en marcha

### 1. Requisitos
- [Node.js](https://nodejs.org) 18 o superior (probado con v24).
- **XAMPP** con **MySQL** corriendo (panel de XAMPP → botón *Start* en MySQL).

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Ya hay un archivo `.env` listo con los valores por defecto de XAMPP
(`root` sin contraseña en `localhost:3306`). Si tu MySQL tiene otra config,
editá `.env` (tenés el ejemplo en `.env.example`).

### 4. Crear la base de datos y las tablas
Con MySQL de XAMPP encendido:
```bash
npm run init-db
```
Esto crea la base `acordes` y todas las tablas.
> Alternativa: abrí **phpMyAdmin** e importá/ejecutá el archivo `server/db/schema.sql`.

> **¿Ya tenías la base de una versión anterior?** Corré la migración (agrega roles, compartir, etc. sin borrar datos):
> ```bash
> npm run migrate
> ```

### 4b. Crear el usuario administrador
```bash
npm run create-admin
```
Crea la cuenta **admin / 123456**. (Podés pasar otros datos: `npm run create-admin usuario clave email`.)

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
│   │   ├── pool.js         # Pool MySQL
│   │   ├── schema.sql      # Esquema de la base
│   │   └── initdb.js       # Crea base y tablas
│   ├── routes/             # auth, search, songs, playlists
│   └── services/
│       └── scraper.js      # scraper nativo (lacuerda + cifraclub) + parser
└── public/                 # Frontend (HTML/CSS/JS nativo)
    ├── index.html
    ├── css/styles.css
    └── js/                 # api, transpose, metronome, app
```

## Notas

- El scraping es solo para uso personal; respetá los términos de lacuerda.net.
- La transposición usa notación inglesa (A, B, C, D, E, F, G con # y b), que es la que usa lacuerda.
