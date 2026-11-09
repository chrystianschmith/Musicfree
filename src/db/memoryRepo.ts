import type { Album, Artist, Track } from "../sources/types";
import {
  HISTORY_LIMIT,
  newId,
  slimAlbum,
  slimArtist,
  type LibraryRepo,
  type PlaylistSummary,
} from "./LibraryRepo";

type Snapshot = {
  liked: Track[];
  playlists: { id: string; name: string; tracks: Track[] }[];
  albums: Album[];
  artists: Artist[];
  history: Track[];
  settings: Record<string, unknown>;
};

const empty = (): Snapshot => ({
  liked: [],
  playlists: [],
  albums: [],
  artists: [],
  history: [],
  settings: {},
});

/** In-memory repo for the browser build and tests. Optionally persisted to localStorage. */
export class MemoryRepo implements LibraryRepo {
  private d: Snapshot;
  constructor(private storageKey?: string) {
    let loaded: Snapshot | undefined;
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) loaded = { ...empty(), ...JSON.parse(raw) };
      } catch {
        /* corrupt or unavailable storage: start fresh */
      }
    }
    this.d = loaded ?? empty();
  }
  private save() {
    if (!this.storageKey) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.d));
    } catch {
      /* quota or private mode */
    }
  }
  private pl(id: string) {
    const p = this.d.playlists.find((x) => x.id === id);
    if (!p) throw new Error(`playlist ${id} not found`);
    return p;
  }

  async isLiked(id: string) {
    return this.d.liked.some((t) => t.id === id);
  }
  async likedIds() {
    return this.d.liked.map((t) => t.id);
  }
  async toggleLike(t: Track) {
    const had = await this.isLiked(t.id);
    this.d.liked = had ? this.d.liked.filter((x) => x.id !== t.id) : [t, ...this.d.liked];
    this.save();
    return !had;
  }
  async liked() {
    return [...this.d.liked];
  }

  async playlists(): Promise<PlaylistSummary[]> {
    return this.d.playlists.map((p) => ({ id: p.id, name: p.name, count: p.tracks.length }));
  }
  async createPlaylist(name: string) {
    const id = newId();
    this.d.playlists.push({ id, name, tracks: [] });
    this.save();
    return id;
  }
  async renamePlaylist(id: string, name: string) {
    this.pl(id).name = name;
    this.save();
  }
  async deletePlaylist(id: string) {
    this.d.playlists = this.d.playlists.filter((p) => p.id !== id);
    this.save();
  }
  async playlistTracks(id: string) {
    return [...this.pl(id).tracks];
  }
  async addToPlaylist(id: string, t: Track) {
    this.pl(id).tracks.push(t);
    this.save();
  }
  async removeFromPlaylist(id: string, pos: number) {
    this.pl(id).tracks.splice(pos, 1);
    this.save();
  }
  async movePlaylistTrack(id: string, from: number, to: number) {
    const tr = this.pl(id).tracks;
    const [x] = tr.splice(from, 1);
    if (x) tr.splice(to, 0, x);
    this.save();
  }

  async saveAlbum(a: Album) {
    this.d.albums = [slimAlbum(a), ...this.d.albums.filter((x) => x.id !== a.id)];
    this.save();
  }
  async unsaveAlbum(id: string) {
    this.d.albums = this.d.albums.filter((x) => x.id !== id);
    this.save();
  }
  async isAlbumSaved(id: string) {
    return this.d.albums.some((x) => x.id === id);
  }
  async savedAlbums() {
    return [...this.d.albums];
  }
  async saveArtist(a: Artist) {
    this.d.artists = [slimArtist(a), ...this.d.artists.filter((x) => x.id !== a.id)];
    this.save();
  }
  async unsaveArtist(id: string) {
    this.d.artists = this.d.artists.filter((x) => x.id !== id);
    this.save();
  }
  async isArtistSaved(id: string) {
    return this.d.artists.some((x) => x.id === id);
  }
  async savedArtists() {
    return [...this.d.artists];
  }

  async pushHistory(t: Track) {
    this.d.history.unshift(t);
    if (this.d.history.length > HISTORY_LIMIT) this.d.history.length = HISTORY_LIMIT;
    this.save();
  }
  async history(limit = 200) {
    return this.d.history.slice(0, limit);
  }

  async getSetting<T>(key: string) {
    return this.d.settings[key] as T | undefined;
  }
  async setSetting(key: string, value: unknown) {
    this.d.settings[key] = structuredClone(value);
    this.save();
  }
}
