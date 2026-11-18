-- Schema de la app Acordes (PostgreSQL / Supabase).
-- TODO vive en el schema "acordes" para no tocar el schema public ni otra app.

CREATE SCHEMA IF NOT EXISTS acordes;
SET search_path TO acordes;

-- Usuarios
CREATE TABLE IF NOT EXISTS acordes.users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  -- 'musico' = usuario común, 'admin' = administrador
  role          VARCHAR(10)  NOT NULL DEFAULT 'musico',
  -- 0 = cuenta deshabilitada (no puede loguear)
  is_active     SMALLINT     NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ  DEFAULT now()
);

-- Canciones guardadas por cada usuario
CREATE TABLE IF NOT EXISTS acordes.songs (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES acordes.users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  artist        VARCHAR(255) NOT NULL,
  source_url    VARCHAR(512),
  content_json  TEXT NOT NULL,
  original_key  VARCHAR(10),
  transpose     INTEGER NOT NULL DEFAULT 0,
  bpm           INTEGER NOT NULL DEFAULT 100,
  beats_per_bar INTEGER NOT NULL DEFAULT 4,
  -- 'first' = acento primer golpe, 'none' = sin acento, 'all' = todos
  accent_mode   VARCHAR(10) NOT NULL DEFAULT 'first',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Listas de canciones (setlists)
CREATE TABLE IF NOT EXISTS acordes.playlists (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES acordes.users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  share_token VARCHAR(32) UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Relacion canciones <-> listas (con orden)
CREATE TABLE IF NOT EXISTS acordes.playlist_songs (
  id          SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES acordes.playlists(id) ON DELETE CASCADE,
  song_id     INTEGER NOT NULL REFERENCES acordes.songs(id)     ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (playlist_id, song_id)
);

-- Mantiene updated_at al día en songs (equivale al ON UPDATE de MySQL)
CREATE OR REPLACE FUNCTION acordes.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS songs_updated_at ON acordes.songs;
CREATE TRIGGER songs_updated_at
  BEFORE UPDATE ON acordes.songs
  FOR EACH ROW EXECUTE FUNCTION acordes.set_updated_at();
