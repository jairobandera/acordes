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

4. **Deploy**. En los **Logs** deberías ver:
   ```
   ✓ Conectado a Postgres.
   ✓ Admin "admin" creado desde variables de entorno.
   🎸 Acordes corriendo en ...
   ```
   (El schema `acordes`, las tablas y el admin se crean solos.)

5. Entrá a `https://acordes.pckairos.cloud` y logueate con `admin` / tu clave. ¡Listo!

---

## Notas
- **Aislamiento:** todas las tablas de Acordes viven en el schema **`acordes`**.
- **Siempre encendida:** en el VPS la app no se duerme.
- **Respaldos:** Coolify respalda la base todos los días.
- Si ves errores de conexión: revisá que `DATABASE_URL` tenga el host interno y la clave correctos.
