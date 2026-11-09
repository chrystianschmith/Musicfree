import type { Album, Artist, Track } from "../sources/types";

export type PlaylistSummary = { id: string; name: string; count: number };

export const HISTORY_LIMIT = 5000;

/** The only gateway to persisted user data (likes, playlists, saved items, history, settings). */
export interface LibraryRepo {
  isLiked(id: string): Promise<boolean>;
  likedIds(): Promise<string[]>;
  toggleLike(t: Track): Promise<boolean>;
  liked(): Promise<Track[]>;

  playlists(): Promise<PlaylistSummary[]>;
  createPlaylist(name: string): Promise<string>;
  renamePlaylist(id: string, name: string): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
  playlistTracks(id: string): Promise<Track[]>;
  addToPlaylist(id: string, t: Track): Promise<void>;
  removeFromPlaylist(id: string, pos: number): Promise<void>;
  movePlaylistTrack(id: string, from: number, to: number): Promise<void>;

  saveAlbum(a: Album): Promise<void>;
  unsaveAlbum(id: string): Promise<void>;
  isAlbumSaved(id: string): Promise<boolean>;
  savedAlbums(): Promise<Album[]>;
  saveArtist(a: Artist): Promise<void>;
  unsaveArtist(id: string): Promise<void>;
  isArtistSaved(id: string): Promise<boolean>;
  savedArtists(): Promise<Artist[]>;

  pushHistory(t: Track): Promise<void>;
  history(limit?: number): Promise<Track[]>;

  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown): Promise<void>;
}

/** Strip heavy nested lists before persisting albums/artists as library entries. */
export const slimAlbum = (a: Album): Album => ({ ...a, tracks: [] });
export const slimArtist = (a: Artist): Artist => ({
  ...a,
  topTracks: [],
  albums: [],
  singles: [],
  related: [],
});

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
