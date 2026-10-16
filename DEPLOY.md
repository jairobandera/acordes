# 🚀 Deploy en Railway (gratis)

Railway corre el **Node** y te da la **base MySQL** en el mismo proyecto, así que es lo más simple para esta app. El código ya se auto-configura: al arrancar **crea las tablas solo** y, si le pasás variables, **crea el admin solo**. No hace falta tocar la base a mano.

> **Ojo con GitHub:** GitHub solo *guarda* el código; no puede *ejecutar* esta app (tiene backend Node + MySQL). Por eso se usa Railway para que ande online.

---

## Pasos

### 1. Entrar a Railway
- Andá a **[railway.app](https://railway.app)** y entrá con tu cuenta de **GitHub**.

### 2. Crear el proyecto desde el repo
- **New Project** → **Deploy from GitHub repo** → elegí **`jairobandera/acordes`**.
- Railway detecta Node y corre `npm install` + `npm start` solo.

### 3. Agregar la base MySQL
- Dentro del proyecto: **New** (o **Create**) → **Database** → **Add MySQL**.
- Railway crea la base y sus variables (`MYSQLHOST`, `MYSQLPORT`, etc.).

### 4. Conectar la app con la base (Variables)
- Entrá al servicio **acordes** (el de Node) → pestaña **Variables** → agregá estas
  (las de la base se escriben con referencias `${{ MySQL.XXX }}`, Railway las completa):

| Variable | Valor |
|---|---|
| `DB_HOST` | `${{ MySQL.MYSQLHOST }}` |
| `DB_PORT` | `${{ MySQL.MYSQLPORT }}` |
| `DB_USER` | `${{ MySQL.MYSQLUSER }}` |
| `DB_PASSWORD` | `${{ MySQL.MYSQLPASSWORD }}` |
| `DB_NAME` | `${{ MySQL.MYSQLDATABASE }}` |
| `JWT_SECRET` | una cadena larga y secreta (inventala) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | la clave que quieras para el admin |
| `PUBLIC_URL` | (lo completás en el paso 6) |

> `PORT` lo pone Railway solo; la app ya lo respeta.

### 5. Primer deploy
- Railway redeploya al guardar las variables. En los **logs** del servicio deberías ver:
  ```
  ✓ Conectado a MySQL.
  ✓ Admin "admin" creado desde variables de entorno.
  🎸 Acordes corriendo en ...
  ```
  (Las tablas y el admin se crean solos en este primer arranque.)

### 6. Generar el dominio público
- Servicio **acordes** → **Settings** → **Networking** → **Generate Domain**.
- Copiá la URL (ej. `https://acordes-production.up.railway.app`).
- Volvé a **Variables** y poné esa URL en **`PUBLIC_URL`** (para que los links de compartir salgan bien).

### 7. ¡Listo!
- Entrá a tu URL pública, logueate con `admin` / la clave que pusiste, y a usar la app.
- Los links de compartir por WhatsApp ahora funcionan para cualquiera.

---

## Sobre el límite / tu app vieja
Railway tiene **créditos gratis mensuales** compartidos entre todos tus servicios. Si ya tenías otra app corriendo ahí y no la usás, conviene **darla de baja** para no gastar créditos:
- En railway.app → abrí ese proyecto viejo → **Settings** → **Delete Project** (o pausá el servicio).

---

## Alternativa: Render
Si preferís Render (corre el Node gratis, con la base MySQL en otro proveedor como Clever Cloud/Aiven), hay un `render.yaml` en el repo. Las variables son las mismas de la tabla de arriba.
