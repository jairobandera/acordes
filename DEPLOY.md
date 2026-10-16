# 🚀 Deploy en Render + Aiven (gratis, sin fecha de vencimiento)

Dos servicios, los dos con **plan gratis permanente** (no son trials):
- **Render** → corre el servidor Node.
- **Aiven** → base **MySQL** gratis.

El código se auto-configura: al arrancar **crea las tablas solo** y, si le pasás variables, **crea el admin solo**. No hace falta tocar la base a mano.

> **GitHub solo guarda el código**, no lo ejecuta. Por eso se usan Render + Aiven.

---

## Parte 1 — Base MySQL en Aiven

1. Entrá a **[aiven.io](https://aiven.io)** y creá una cuenta.
2. **Create service** → **MySQL** → elegí el plan **Free** (dice "Free", sin tarjeta).
3. Elegí una región cercana y creá el servicio. Esperá unos minutos a que diga **Running**.
4. En la pantalla del servicio (**Overview / Connection information**) anotá:
   - **Host** (algo como `mysql-xxxx.a.aivencloud.com`)
   - **Port** (un número tipo `12345`, NO 3306)
   - **User** (normalmente `avnadmin`)
   - **Password**
   - **Database name** (normalmente `defaultdb`)

> No hace falta crear tablas: la app las crea sola al arrancar.

---

## Parte 2 — Servidor en Render

1. Entrá a **[render.com](https://render.com)** y entrá con tu **GitHub**.
2. **New +** → **Web Service** → conectá el repo **`jairobandera/acordes`**.
3. Render detecta Node (`npm install` + `npm start`). Dejá el plan **Free**.
4. En **Environment / Environment Variables**, agregá estas (con los datos de Aiven del paso anterior):

| Variable | Valor |
|---|---|
| `DB_HOST` | el Host de Aiven |
| `DB_PORT` | el Port de Aiven (ej. `12345`) |
| `DB_USER` | `avnadmin` |
| `DB_PASSWORD` | la password de Aiven |
| `DB_NAME` | `defaultdb` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | una cadena larga inventada |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | la clave que quieras para el admin |
| `PUBLIC_URL` | (lo completás en el paso 6) |

> `PORT` lo pone Render solo; la app ya lo respeta. `DB_SSL=true` es clave: Aiven exige conexión segura.

5. **Create Web Service**. En los **Logs** deberías ver:
   ```
   ✓ Conectado a MySQL.
   ✓ Admin "admin" creado desde variables de entorno.
   🎸 Acordes corriendo en ...
   ```
   (Las tablas y el admin se crean solos en este primer arranque.)

6. Render te da una URL pública (ej. `https://acordes.onrender.com`). Copiala, volvé a
   **Environment Variables** y ponela en **`PUBLIC_URL`** (para que los links de compartir salgan bien). Guardá → redeploya solo.

7. ¡Listo! Entrá a tu URL, logueate con `admin` / tu clave, y a usar la app.

---

## Notas

- **Render free duerme** el servicio tras ~15 min sin uso: la primera visita después tarda ~30 seg en despertar. Es normal del plan gratis.
- **Aiven free** es chico (~1GB) pero permanente y sobra para miles de canciones.
- Si querés verificación SSL estricta: Aiven te da un **CA certificate** (botón de descarga en Connection info). Pegá su contenido en una variable `DB_SSL_CA` y el código lo usa.
- Si ves `ER_ACCESS_DENIED` o timeouts: revisá que `DB_SSL=true` esté puesto y que host/puerto/clave sean los de Aiven.

---

## Alternativa de base: TiDB Cloud o Clever Cloud
Si preferís más espacio, **TiDB Cloud Serverless** (compatible MySQL, ~5GB gratis) también sirve — mismas variables, `DB_SSL=true`. **Clever Cloud** es otra opción (más chica pero simple).
