/** Ordered schema migrations; index + 1 is the schema version stored in `meta.version`. */
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS liked_tracks (track_id TEXT PRIMARY KEY, liked_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS playlists (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS playlist_tracks (playlist_id TEXT NOT NULL, track_id TEXT NOT NULL, position INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_pt ON playlist_tracks (playlist_id, position)`,
    `CREATE TABLE IF NOT EXISTS saved_albums (album_id TEXT PRIMARY KEY, data TEXT NOT NULL, saved_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS saved_artists (artist_id TEXT PRIMARY KEY, data TEXT NOT NULL, saved_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, track_id TEXT NOT NULL, played_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS lyrics_cache (track_id TEXT PRIMARY KEY, data TEXT NOT NULL, fetched_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ],
];
