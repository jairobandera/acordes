-- Schema de la app Acordes
-- Se puede correr tal cual en phpMyAdmin (XAMPP) o con: npm run init-db

CREATE DATABASE IF NOT EXISTS acordes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE acordes;

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  -- 'musico' = usuario común, 'admin' = administrador (vos)
  role          ENUM('musico','admin') NOT NULL DEFAULT 'musico',
  -- 0 = cuenta deshabilitada (no puede loguear)
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Canciones guardadas por cada usuario
CREATE TABLE IF NOT EXISTS songs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  title         VARCHAR(255) NOT NULL,
  artist        VARCHAR(255) NOT NULL,
  source_url    VARCHAR(512),
  -- Contenido parseado (lineas con segmentos acorde/texto) en JSON
  content_json  LONGTEXT NOT NULL,
  original_key  VARCHAR(10),
  -- Semitonos de transposicion guardados por el usuario (-11..11)
  transpose     INT NOT NULL DEFAULT 0,
  -- Metronomo
  bpm           INT NOT NULL DEFAULT 100,
  beats_per_bar INT NOT NULL DEFAULT 4,
  -- 'first' = acento en primer golpe, 'none' = sin acento, 'all' = acento en todos
  accent_mode   ENUM('first','none','all') NOT NULL DEFAULT 'first',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_songs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Listas de canciones (setlists)
CREATE TABLE IF NOT EXISTS playlists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  -- Token para compartir la lista públicamente (NULL = no compartida)
  share_token VARCHAR(32) NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relacion canciones <-> listas (con orden)
CREATE TABLE IF NOT EXISTS playlist_songs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  playlist_id INT NOT NULL,
  song_id     INT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_ps_playlist FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_song     FOREIGN KEY (song_id)     REFERENCES songs(id)     ON DELETE CASCADE,
  UNIQUE KEY uniq_playlist_song (playlist_id, song_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Uso de las APIs de scraping (para el panel de administrador)
CREATE TABLE IF NOT EXISTS api_usage (
  provider     VARCHAR(20) PRIMARY KEY,
  requests     INT NOT NULL DEFAULT 0,
  failures     INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
