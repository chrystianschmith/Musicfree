import {
  SourceError,
  type Album,
  type Artist,
  type HomeFeed,
  type MusicSource,
  type Playlist,
  type SearchFilter,
  type SearchResult,
  type Shelf,
  type StreamInfo,
  type Track,
} from "../types";
import { albums, artists, moods, playlists, tracks } from "./fixtures";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Offline source with fictional data, used for development, tests and screenshots. */
export class MockMusicSource implements MusicSource {
  private latencyMs: number;
  constructor(opts: { latencyMs?: number } = {}) {
    this.latencyMs = opts.latencyMs ?? 150;
  }

  private delay<T>(v: T): Promise<T> {
    return new Promise((r) => setTimeout(() => r(v), this.latencyMs));
  }

  private find<T extends { id: string }>(list: T[], id: string, what: string): Promise<T> {
    const item = list.find((x) => x.id === id);
    return item ? this.delay(item) : Promise.reject(new SourceError("not-found", `${what} ${id}`));
  }

  async home(mood?: string): Promise<HomeFeed> {
    const rot = mood ? moods.indexOf(mood) + 1 : 0;
    const rotate = <T>(a: T[]) => a.slice(rot).concat(a.slice(0, rot));
    const shelves: Shelf[] = [
      {
        title: "Feito para você",
        items: rotate(playlists.slice(0, 4)).map((p) => ({ kind: "playlist", playlist: p })),
      },
      {
        title: "Tocadas recentemente",
        items: rotate(tracks.slice(0, 8)).map((t) => ({ kind: "track", track: t })),
      },
      {
        title: "Lançamentos",
        items: rotate(albums)
          .slice(0, 6)
          .map((a) => ({ kind: "album", album: a })),
      },
      {
        title: "Artistas que você pode curtir",
        items: rotate(artists)
          .slice(0, 6)
          .map((a) => ({ kind: "artist", artist: a })),
      },
    ];
    return this.delay({ moods, shelves });
  }

  async search(q: string, filter: SearchFilter = "all"): Promise<SearchResult> {
    const n = norm(q.trim());
    const has = (s: string) => norm(s).includes(n);
    const songs = tracks.filter(
      (t) => has(t.title) || t.artists.some((a) => has(a.name)) || has(t.album?.title ?? ""),
    );
    const al = albums.filter((a) => has(a.title) || a.artists.some((x) => has(x.name)));
    const ar = artists.filter((a) => has(a.name));
    const pl = playlists.filter((p) => has(p.title));
    const keep = (f: SearchFilter) => filter === "all" || filter === f;
    const top = ar[0]
      ? { kind: "artist" as const, artist: ar[0] }
      : songs[0]
        ? { kind: "track" as const, track: songs[0] }
        : undefined;
    return this.delay({
      top: filter === "all" ? top : undefined,
      songs: keep("songs") ? songs : [],
      albums: keep("albums") ? al : [],
      artists: keep("artists") ? ar : [],
      playlists: keep("playlists") ? pl : [],
    });
  }

  async suggestions(q: string): Promise<string[]> {
    const n = norm(q.trim());
    if (!n) return this.delay([]);
    const pool = [...artists.map((a) => a.name), ...tracks.map((t) => t.title)];
    return this.delay(pool.filter((s) => norm(s).startsWith(n)).slice(0, 6));
  }

  artist(id: string): Promise<Artist> {
    return this.find(artists, id, "artist");
  }
  album(id: string): Promise<Album> {
    return this.find(albums, id, "album");
  }
  playlist(id: string): Promise<Playlist> {
    return this.find(playlists, id, "playlist");
  }

  async radio(videoId: string): Promise<Track[]> {
    const seed = tracks.find((t) => t.id === videoId);
    if (!seed) throw new SourceError("not-found", `track ${videoId}`);
    const i = tracks.indexOf(seed);
    const rest = [3, 7, 11, 13, 17, 19, 23, 29].map((d) => tracks[(i + d) % tracks.length]);
    return this.delay([seed, ...rest]);
  }

  async related(videoId: string): Promise<Track[]> {
    const r = await this.radio(videoId);
    return r.slice(1);
  }

  async explore(): Promise<Shelf[]> {
    return this.delay([
      {
        title: "Climas e gêneros",
        items: playlists.map((p) => ({ kind: "playlist", playlist: p })),
      },
      { title: "Novos álbuns", items: albums.map((a) => ({ kind: "album", album: a })) },
      { title: "Em alta", items: tracks.slice(10, 20).map((t) => ({ kind: "track", track: t })) },
    ]);
  }

  async resolveStream(videoId: string): Promise<StreamInfo> {
    if (!tracks.some((t) => t.id === videoId)) throw new SourceError("not-found", videoId);
    // Silent WAV so the browser build can exercise the real <audio> pipeline.
    return this.delay({
      url: silentWav(),
      mime: "audio/wav",
      expiresAt: Date.now() + 6 * 3600_000,
    });
  }
}

let cachedWav: string | undefined;
function silentWav(): string {
  if (cachedWav) return cachedWav;
  const rate = 3000;
  const n = rate * 240; // 4 minutes, 8-bit mono, ~720 KB
  const buf = new Uint8Array(44 + n);
  const dv = new DataView(buf.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  dv.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  w(36, "data");
  dv.setUint32(40, n, true);
  buf.fill(128, 44);
  let bin = "";
  buf.forEach((b) => (bin += String.fromCharCode(b)));
  cachedWav = `data:audio/wav;base64,${btoa(bin)}`;
  return cachedWav;
}
