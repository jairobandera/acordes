# 🚀 Deploy gratis (para que el link de WhatsApp funcione por internet)

La app necesita dos cosas en la nube: **el servidor Node** y **una base MySQL**.
Ambas tienen opciones gratuitas. Esta es la ruta más simple.

---

## Paso 1 — Base de datos MySQL gratis

Elegí **uno** de estos proveedores (todos tienen plan gratis con MySQL):

| Proveedor | Link | Notas |
|---|---|---|
| **Clever Cloud** | clever-cloud.com | MySQL gratis chico, estable. Recomendado. |
| **Aiven** | aiven.io | Plan free de MySQL. |
| **Railway** | railway.app | MySQL con créditos gratis mensuales. |

Cuando crees la base, anotá estos datos (te los da el panel del proveedor):
- **host** (ej: `xxx.mysql.database.azure.com` o similar)
- **puerto** (casi siempre `3306`)
- **usuario**
- **contraseña**
- **nombre de la base**

### Crear las tablas en la base de la nube
Desde tu PC, con esos datos, editá el `.env` temporalmente apuntando a la base de la nube y corré:
```bash
npm run init-db
npm run create-admin
```
(O usá el cliente web del proveedor e importá `server/db/schema.sql`.)
Después volvé a dejar el `.env` como estaba para desarrollo local.

---

## Paso 2 — Servidor en Render (gratis)

1. Subí este proyecto a un repositorio de **GitHub**.
2. Entrá a [render.com](https://render.com) → **New +** → **Web Service** → conectá tu repo.
3. Render detecta el `render.yaml`. Configurá las variables de entorno con los datos del Paso 1:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `PUBLIC_URL` → la URL que te da Render, ej: `https://acordes.onrender.com`
   - `JWT_SECRET` → Render lo genera solo (o poné una cadena larga).
4. **Deploy**. En unos minutos tenés tu app en `https://acordes.onrender.com`.

> El `PUBLIC_URL` es importante: es lo que hace que los **links de compartir** salgan con la dirección pública (y no `localhost`), así funcionan por WhatsApp para cualquiera.

---

## Notas del plan gratis

- **Render free** duerme el servicio tras ~15 min sin uso: la primera visita después de dormir tarda ~30 seg en despertar. Para una app de banda está perfecto.
- La base MySQL gratis suele tener límite de tamaño (sobra para miles de canciones).
- Si más adelante querés algo sin "dormir", los planes pagos de Render arrancan baratos.

## Alternativa todo-en-uno: Railway
En [railway.app](https://railway.app) podés tener **Node + MySQL en el mismo proyecto**:
1. New Project → Deploy from GitHub repo.
2. Add → Database → MySQL.
3. En el servicio Node, mapeá las variables (`DB_HOST=${{MySQL.MYSQLHOST}}`, etc.) y definí `PUBLIC_URL`.
4. Deploy.
