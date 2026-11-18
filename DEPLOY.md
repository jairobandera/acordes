# 🚀 Deploy en Render + Supabase (gratis)

Dos servicios gratis:
- **Render** → corre el servidor Node.
- **Supabase** → base **PostgreSQL**.

La app crea sus tablas sola al arrancar, dentro de un **schema `acordes`** aislado
(nunca toca el schema `public` ni otras apps del mismo proyecto Supabase).

> **GitHub solo guarda el código**, no lo ejecuta. Por eso se usan Render + Supabase.

---

## Parte 1 — Connection string de Supabase

1. Entrá a tu proyecto en **[supabase.com](https://supabase.com)**.
2. Arriba, tocá **Connect** (o **Project Settings → Database → Connection string**).
3. Elegí la pestaña **Connection pooling** (Supavisor) — modo **Transaction**.
   Copiá el string, que se ve así:
   ```
   postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
4. Reemplazá `[YOUR-PASSWORD]` por la contraseña de la base (la que pusiste al crear el proyecto; si no la recordás, la reseteás en **Database → Reset database password**).

> Usá el **pooler** (`...pooler.supabase.com`), no la conexión directa, porque Render
> necesita IPv4 y la directa de Supabase es solo IPv6.

---

## Parte 2 — Servidor en Render

1. Entrá a **[render.com](https://render.com)** con tu **GitHub**.
2. **New +** → **Web Service** → conectá el repo **`jairobandera/acordes`**. Plan **Free**.
3. En **Environment / Environment Variables**, agregá:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | el connection string del Paso 1 (con la password puesta) |
| `DB_SCHEMA` | `acordes` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | una cadena larga inventada |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | la clave que quieras para el admin |
| `PUBLIC_URL` | (lo completás en el paso 5) |

4. **Create Web Service**. En los **Logs** deberías ver:
   ```
   ✓ Conectado a Postgres.
   ✓ Admin "admin" creado desde variables de entorno.
   🎸 Acordes corriendo en ...
   ```
   (El schema `acordes`, las tablas y el admin se crean solos.)

5. Render te da una URL pública. Copiala, ponela en **`PUBLIC_URL`** y guardá (redeploya solo).

6. Entrá a tu URL, logueate con `admin` / tu clave. ¡Listo!

---

## Notas
- **Aislamiento:** todas las tablas de Acordes viven en el schema **`acordes`**. Tu otra
  app (en `public` u otro schema) no se toca.
- **Render free** duerme tras ~15 min sin uso (la 1ª visita tarda ~30-50 s en despertar).
- **Supabase free** es permanente; alcanza de sobra para esta app.
- Si ves errores de conexión: revisá que `DATABASE_URL` tenga la password correcta y que
  sea el string del **pooler** (puerto 6543).
