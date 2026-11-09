import type { Album, Artist, Track } from "../sources/types";
import {
  HISTORY_LIMIT,
  newId,
  slimAlbum,
  slimArtist,
  type LibraryRepo,
  type PlaylistSummary,
} from "./LibraryRepo";
import { MIGRATIONS } from "./migrations";

/** Minimal surface of @tauri-apps/plugin-sql's Database (also implemented by sql.js in tests). */
export interface SqlDriver {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

const now = () => Date.now();
const parse = <T>(rows: { data: string }[]): T[] => rows.map((r) => JSON.parse(r.data) as T);

export class SqliteRepo implements LibraryRepo {
  private constructor(private db: SqlDriver) {}

  static async open(db: SqlDriver): Promise<SqliteRepo> {
    await db.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const rows = await db.select<{ value: string }>(`SELECT value FROM meta WHERE key = 'version'`);
    let version = rows.length ? Number(rows[0].value) : 0;
    while (version < MIGRATIONS.length) {
      for (const stmt of MIGRATIONS[version]) await db.execute(stmt);
      version++;
      await db.execute(`INSERT OR REPLACE INTO meta (key, value) VALUES ('version', $1)`, [
        String(version),
      ]);
    }
    return new SqliteRepo(db);
  }

  private upsertTrack(t: Track) {
    return this.db.execute(`INSERT OR REPLACE INTO tracks (id, data) VALUES ($1, $2)`, [
      t.id,
      JSON.stringify(t),
    ]);
  }

  async isLiked(id: string) {
    return (
      (await this.db.select(`SELECT 1 FROM liked_tracks WHERE track_id = $1`, [id])).length > 0
    );
  }
  async likedIds() {
    return (await this.db.select<{ track_id: string }>(`SELECT track_id FROM liked_tracks`)).map(
      (r) => r.track_id,
    );
  }
  async toggleLike(t: Track) {
    if (await this.isLiked(t.id)) {
      await this.db.execute(`DELETE FROM liked_tracks WHERE track_id = $1`, [t.id]);
      return false;
    }
    await this.upsertTrack(t);
    // liked_at gets a monotonic tie-breaker so rapid likes keep their order.
    await this.db.execute(
      `INSERT INTO liked_tracks (track_id, liked_at) VALUES ($1, MAX($2, COALESCE((SELECT MAX(liked_at) + 1 FROM liked_tracks), 0)))`,
      [t.id, now()],
    );
    return true;
  }
  async liked() {
    return parse<Track>(
      await this.db.select(
        `SELECT t.data FROM liked_tracks l JOIN tracks t ON t.id = l.track_id ORDER BY l.liked_at DESC`,
      ),
    );
  }

  async playlists(): Promise<PlaylistSummary[]> {
    return this.db.select<PlaylistSummary>(
      `SELECT p.id, p.name, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS count
       FROM playlists p ORDER BY p.created_at, p.rowid`,
    );
  }
  async createPlaylist(name: string) {
    const id = newId();
    await this.db.execute(
      `INSERT INTO playlists (id, name, created_at, updated_at) VALUES ($1, $2, $3, $3)`,
      [id, name, now()],
    );
    return id;
  }
  async renamePlaylist(id: string, name: string) {
    await this.db.execute(`UPDATE playlists SET name = $1, updated_at = $2 WHERE id = $3`, [
      name,
      now(),
      id,
    ]);
  }
  async deletePlaylist(id: string) {
    await this.db.execute(`DELETE FROM playlist_tracks WHERE playlist_id = $1`, [id]);
    await this.db.execute(`DELETE FROM playlists WHERE id = $1`, [id]);
  }
  async playlistTracks(id: string) {
    return parse<Track>(
      await this.db.select(
        `SELECT t.data FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = $1 ORDER BY pt.position`,
        [id],
      ),
    );
  }
  async addToPlaylist(id: string, t: Track) {
    await this.upsertTrack(t);
    await this.db.execute(
      `INSERT INTO playlist_tracks (playlist_id, track_id, position)
       VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM playlist_tracks WHERE playlist_id = $1), 0))`,
      [id, t.id],
    );
    await this.touch(id);
  }
  /** Rewrites positions 0..n-1 from an ordered list of track ids. */
  private async rewrite(id: string, ids: string[]) {
    await this.db.execute(`DELETE FROM playlist_tracks WHERE playlist_id = $1`, [id]);
    for (let i = 0; i < ids.length; i++) {
      await this.db.execute(
        `INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3)`,
        [id, ids[i], i],
      );
    }
    await this.touch(id);
  }
  private async orderedIds(id: string) {
    return (
      await this.db.select<{ track_id: string }>(
        `SELECT track_id FROM playlist_tracks WHERE playlist_id = $1 ORDER BY position`,
        [id],
      )
    ).map((r) => r.track_id);
  }
  private touch(id: string) {
    return this.db.execute(`UPDATE playlists SET updated_at = $1 WHERE id = $2`, [now(), id]);
  }
  async removeFromPlaylist(id: string, pos: number) {
    const ids = await this.orderedIds(id);
    if (pos < 0 || pos >= ids.length) return;
    ids.splice(pos, 1);
    await this.rewrite(id, ids);
  }
  async movePlaylistTrack(id: string, from: number, to: number) {
    const ids = await this.orderedIds(id);
    if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) return;
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    await this.rewrite(id, ids);
  }

  async saveAlbum(a: Album) {
    await this.db.execute(
      `INSERT OR REPLACE INTO saved_albums (album_id, data, saved_at) VALUES ($1, $2, $3)`,
      [a.id, JSON.stringify(slimAlbum(a)), now()],
    );
  }
  async unsaveAlbum(id: string) {
    await this.db.execute(`DELETE FROM saved_albums WHERE album_id = $1`, [id]);
  }
  async isAlbumSaved(id: string) {
    return (
      (await this.db.select(`SELECT 1 FROM saved_albums WHERE album_id = $1`, [id])).length > 0
    );
  }
  async savedAlbums() {
    return parse<Album>(
      await this.db.select(`SELECT data FROM saved_albums ORDER BY saved_at DESC, rowid DESC`),
    );
  }
  async saveArtist(a: Artist) {
    await this.db.execute(
      `INSERT OR REPLACE INTO saved_artists (artist_id, data, saved_at) VALUES ($1, $2, $3)`,
      [a.id, JSON.stringify(slimArtist(a)), now()],
    );
  }
  async unsaveArtist(id: string) {
    await this.db.execute(`DELETE FROM saved_artists WHERE artist_id = $1`, [id]);
  }
  async isArtistSaved(id: string) {
    return (
      (await this.db.select(`SELECT 1 FROM saved_artists WHERE artist_id = $1`, [id])).length > 0
    );
  }
  async savedArtists() {
    return parse<Artist>(
      await this.db.select(`SELECT data FROM saved_artists ORDER BY saved_at DESC, rowid DESC`),
    );
  }

  async pushHistory(t: Track) {
    await this.upsertTrack(t);
    await this.db.execute(`INSERT INTO history (track_id, played_at) VALUES ($1, $2)`, [
      t.id,
      now(),
    ]);
    await this.db.execute(
      `DELETE FROM history WHERE id <= (SELECT id FROM history ORDER BY id DESC LIMIT 1 OFFSET $1)`,
      [HISTORY_LIMIT],
    );
  }
  async history(limit = 200) {
    return parse<Track>(
      await this.db.select(
        `SELECT t.data FROM history h JOIN tracks t ON t.id = h.track_id ORDER BY h.id DESC LIMIT $1`,
        [limit],
      ),
    );
  }

  async getSetting<T>(key: string) {
    const rows = await this.db.select<{ value: string }>(
      `SELECT value FROM settings WHERE key = $1`,
      [key],
    );
    return rows.length ? (JSON.parse(rows[0].value) as T) : undefined;
  }
  async setSetting(key: string, value: unknown) {
    await this.db.execute(`INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)`, [
      key,
      JSON.stringify(value),
    ]);
  }
}
