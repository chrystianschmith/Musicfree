import type { Innertube } from "youtubei.js";
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
  type ShelfItem,
  type StreamInfo,
  type Thumb,
  type Track,
} from "../types";
import { BROWSER_UA, fetchRange, httpFetch } from "../../lib/http";
import { isTauri } from "../../lib/platform";
import {
  bucketItems,
  defined,
  mapListItem,
  mapPanelVideo,
  mapThumbs,
  mapTwoRow,
  onlyTracks,
  textOf,
  type YtListItem,
  type YtPanelVideo,
  type YtTwoRow,
} from "./mappers";

/* eslint-disable @typescript-eslint/no-explicit-any -- parser nodes are dynamic; mappers type what we read */
type Node = { type: string } & Record<string, any>;

/** Clients tried in order when resolving a playable audio stream. */
const STREAM_CLIENTS = [
  "ANDROID_VR",
  "ANDROID",
  "IOS",
  "VISIONOS",
  "TV",
  "TV_EMBEDDED",
  "YTMUSIC",
  "TV_SIMPLY",
  "WEB_EMBEDDED",
  "MWEB",
  "WEB",
] as const;

let yt: Promise<Innertube> | undefined;

/** Lazily creates the InnerTube session (loads youtubei.js only when first needed). */
export function createInnertube(): Promise<Innertube> {
  yt ??= (async () => {
    const { Innertube, Platform, UniversalCache } = await import("youtubei.js");
    // youtubei.js needs a JS evaluator to run YouTube's player code (signature / n deciphering).
    Platform.shim.eval = (data: { output: string }) => new Function(data.output)();
    return Innertube.create({
      fetch: (input, init) => httpFetch(input as RequestInfo, init),
      cache: new UniversalCache(true),
      retrieve_player: true,
      // Fetch a real visitor session from YouTube: locally generated visitor data gets
      // LOGIN_REQUIRED ("confirm you're not a bot") on the player endpoint.
      generate_session_locally: false,
      lang: "pt",
      location: "BR",
    });
  })();
  yt.catch(() => (yt = undefined));
  return yt;
}

function toSourceError(err: unknown): SourceError {
  if (err instanceof SourceError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/fetch|network|timed? ?out|ENOTFOUND|Failed to/i.test(msg))
    return new SourceError("network", msg);
  return new SourceError("parse", msg);
}

async function guard<T>(fn: (yt: Innertube) => Promise<T>): Promise<T> {
  try {
    return await fn(await createInnertube());
  } catch (e) {
    console.error("[youtube]", e);
    throw toSourceError(e);
  }
}

const isType = (n: unknown, ...types: string[]): n is Node =>
  !!n && types.includes((n as Node).type);

function mapAny(n: Node): ShelfItem | undefined {
  if (isType(n, "MusicTwoRowItem")) return mapTwoRow(n as YtTwoRow);
  if (isType(n, "MusicResponsiveListItem"))
    // `thumbnails` is a getter on the class instance, so copy it explicitly.
    return mapListItem({ ...(n as YtListItem), thumbnails: (n as Record<string, any>).thumbnails });
  return undefined;
}

function carouselToShelf(c: Node): Shelf | undefined {
  if (!isType(c, "MusicCarouselShelf")) return undefined;
  const items = defined<ShelfItem>((c.contents ?? []).map((x: Node) => mapAny(x)));
  return items.length ? { title: textOf(c.header?.title), items } : undefined;
}

function listItems(nodes: Node[] | undefined): ShelfItem[] {
  return defined<ShelfItem>((nodes ?? []).map((n) => mapAny(n)));
}

function headerThumbs(h: Node | undefined): Thumb[] {
  if (!h) return [];
  return mapThumbs(h.thumbnail?.contents ?? h.thumbnails ?? h.foreground_thumbnail ?? h.thumbnail);
}

function unwrapPanel(n: Node): YtPanelVideo | undefined {
  if (isType(n, "PlaylistPanelVideo")) return n as YtPanelVideo;
  if (isType(n, "PlaylistPanelVideoWrapper"))
    return (n as Record<string, any>).primary as YtPanelVideo;
  return undefined;
}

export class YouTubeMusicSource implements MusicSource {
  home(mood?: string): Promise<HomeFeed> {
    return guard(async (yt) => {
      let feed = await yt.music.getHomeFeed();
      // `filters` is a getter that can throw on unusual responses; mood tabs are optional.
      let moods: string[] = [];
      try {
        moods = feed.filters ?? [];
      } catch {
        /* no mood chips in this response */
      }
      if (mood && moods.includes(mood)) feed = await feed.applyFilter(mood);
      const shelves = defined(
        (feed.sections ?? []).map((s) => carouselToShelf(s as unknown as Node)),
      );
      return { moods, shelves };
    });
  }

  search(q: string, filter: SearchFilter = "all"): Promise<SearchResult> {
    return guard(async (yt) => {
      const typeMap = {
        all: "all",
        songs: "song",
        albums: "album",
        artists: "artist",
        playlists: "playlist",
      } as const;
      const res = await yt.music.search(q, { type: typeMap[filter] });
      const shelfItems = (s: unknown) => listItems((s as Node | undefined)?.contents);
      // Classify by item type, never by shelf title (titles are localized).
      const { songs, albums, artists, playlists } = bucketItems(
        (res.contents ?? []).flatMap((s) => shelfItems(s)),
      );
      const card = (res.contents ?? []).find((s) => isType(s, "MusicCardShelf")) as
        Node | undefined;
      let top: ShelfItem | undefined;
      if (card && filter === "all") {
        const id: string | undefined =
          card.on_tap?.payload?.browseId ?? card.on_tap?.payload?.videoId;
        const title = textOf(card.title);
        if (id?.startsWith("UC"))
          top = {
            kind: "artist",
            artist: artists.find((a) => a.id === id) ?? {
              id,
              name: title,
              thumbs: headerThumbs(card),
              topTracks: [],
              albums: [],
              singles: [],
              related: [],
            },
          };
        else if (id?.startsWith("MPRE"))
          top = {
            kind: "album",
            album: albums.find((a) => a.id === id) ?? {
              id,
              title,
              artists: [],
              thumbs: headerThumbs(card),
              tracks: [],
            },
          };
        else if (id)
          top = songs.find((s) => s.id === id)
            ? { kind: "track", track: songs.find((s) => s.id === id)! }
            : undefined;
      }
      top ??= artists[0]
        ? { kind: "artist", artist: artists[0] }
        : songs[0]
          ? { kind: "track", track: songs[0] }
          : undefined;
      return { top: filter === "all" ? top : undefined, songs, albums, artists, playlists };
    });
  }

  suggestions(q: string): Promise<string[]> {
    if (!q.trim()) return Promise.resolve([]);
    return guard(async (yt) => {
      const sections = await yt.music.getSearchSuggestions(q);
      return sections
        .flatMap((s) => (s.contents ?? []) as unknown as Node[])
        .filter((n) => isType(n, "SearchSuggestion"))
        .map((n) => textOf(n.suggestion))
        .filter(Boolean)
        .slice(0, 8);
    });
  }

  artist(id: string): Promise<Artist> {
    return guard(async (yt) => {
      const a = await yt.music.getArtist(id);
      const h = a.header as unknown as Node | undefined;
      const sections = a.sections as unknown as Node[];
      const topTracks = onlyTracks(
        sections.filter((s) => isType(s, "MusicShelf")).flatMap((s) => listItems(s.contents)),
      ).slice(0, 10);
      const albums: Album[] = [];
      const singles: Album[] = [];
      const related: Artist[] = [];
      for (const s of sections) {
        const shelf = carouselToShelf(s);
        if (!shelf) continue;
        const isSingles = /single|ep\b/i.test(shelf.title);
        for (const it of shelf.items) {
          if (it.kind === "album") (isSingles ? singles : albums).push(it.album);
          else if (it.kind === "artist") related.push(it.artist);
        }
      }
      const subs = textOf(h?.subscription_button?.subscriber_count) || undefined;
      return {
        id,
        name: textOf(h?.title),
        thumbs: headerThumbs(h),
        subtitle: subs,
        topTracks,
        albums,
        singles,
        related,
      };
    });
  }

  album(id: string): Promise<Album> {
    return guard(async (yt) => {
      const a = await yt.music.getAlbum(id);
      const h = a.header as unknown as Node | undefined;
      const thumbs = headerThumbs(h);
      const title = textOf(h?.title);
      const strap = textOf(h?.strapline_text_one);
      const artists = h?.author
        ? [{ id: h.author.channel_id, name: h.author.name }]
        : strap
          ? [{ name: strap }]
          : [];
      const sub = textOf(h?.subtitle);
      const year = h?.year || sub.match(/\b(19|20)\d{2}\b/)?.[0];
      const kind = /single/i.test(sub) ? "single" : /\bep\b/i.test(sub) ? "ep" : "album";
      const tracks = onlyTracks(listItems(a.contents as unknown as Node[])).map((t) => ({
        ...t,
        artists: t.artists.length ? t.artists : artists,
        album: { id, title },
        thumbs: t.thumbs.length ? t.thumbs : thumbs,
      }));
      return { id, title, artists, year, kind, thumbs, tracks } satisfies Album;
    });
  }

  playlist(id: string): Promise<Playlist> {
    return guard(async (yt) => {
      let p = await yt.music.getPlaylist(id);
      const h = p.header as unknown as Node | undefined;
      const items: Node[] = [...((p.items ?? []) as unknown as Node[])];
      for (let i = 0; i < 3 && p.has_continuation; i++) {
        p = await p.getContinuation();
        items.push(...((p.items ?? []) as unknown as Node[]));
      }
      return {
        id,
        title: textOf(h?.title),
        author:
          textOf(h?.strapline_text_one) || h?.author?.name || textOf(h?.subtitle) || undefined,
        thumbs: headerThumbs(h),
        tracks: onlyTracks(listItems(items)),
      };
    });
  }

  radio(videoId: string): Promise<Track[]> {
    return guard(async (yt) => {
      // The automix request fails inside the library for some non-music videos; fall back to
      // the plain up-next list.
      const panel = await yt.music
        .getUpNext(videoId, true)
        .catch(() => yt.music.getUpNext(videoId, false));
      const tracks = defined(
        ((panel.contents ?? []) as unknown as Node[])
          .map((n) => unwrapPanel(n))
          .map((v) => (v ? mapPanelVideo(v) : undefined)),
      );
      const seedIdx = tracks.findIndex((t) => t.id === videoId);
      if (seedIdx > 0) tracks.unshift(...tracks.splice(seedIdx, 1));
      if (!tracks.length) throw new SourceError("not-found", `radio ${videoId}`);
      return tracks;
    });
  }

  related(videoId: string): Promise<Track[]> {
    return guard(async (yt) => {
      const rel = (await yt.music.getRelated(videoId)) as unknown as Node;
      const contents: Node[] = rel?.contents ?? [];
      const fromShelves = contents.flatMap((c) => carouselToShelf(c)?.items ?? []);
      const tracks = onlyTracks(fromShelves);
      return tracks.length ? tracks : (await this.radio(videoId)).slice(1);
    });
  }

  explore(): Promise<Shelf[]> {
    return guard(async (yt) => {
      const e = await yt.music.getExplore();
      return defined((e.sections as unknown as Node[]).map((s) => carouselToShelf(s)));
    });
  }

  resolveStream(videoId: string): Promise<StreamInfo> {
    return guard(async (yt) => {
      const { Constants } = await import("youtubei.js");
      const uaOf = (client: string) =>
        (Constants.CLIENTS as Record<string, { USER_AGENT?: string }>)[client]?.USER_AGENT ??
        BROWSER_UA;
      const report: string[] = [];
      for (const client of STREAM_CLIENTS) {
        try {
          const info = await yt.getBasicInfo(videoId, { client });
          const status = info.playability_status?.status;
          if (status && status !== "OK") {
            report.push(`${client}: ${status}`);
            continue;
          }
          let format;
          try {
            format = info.chooseFormat({ type: "audio", quality: "best", format: "mp4" });
          } catch {
            format = info.chooseFormat({ type: "audio", quality: "best", format: "any" });
          }
          const url = await format.decipher(yt.session.player);
          if (!url) throw new Error("empty url");
          const userAgent = uaOf(client);
          // A URL is only good if the media server really serves it: some clients hand out
          // URLs that answer 403 (missing PoToken, IP family mismatch…).
          const http = await probeStream(url, userAgent);
          let viaFetch = false;
          if (http !== 200 && http !== 206 && isTauri()) {
            // Second path: the same HTTP client the API calls use (they are known to work here).
            const js = await fetchRange(url, userAgent, 0, 1023).then(
              (r) => r.status,
              () => 0,
            );
            viaFetch = js === 200 || js === 206;
            report.push(`${client}: ${describeUrl(url)} → proxy HTTP ${http}, app HTTP ${js}`);
            if (!viaFetch) continue;
          } else {
            report.push(`${client}: ${describeUrl(url)} → HTTP ${http}`);
            if (http !== 200 && http !== 206) continue;
          }
          console.warn(`[stream] ${videoId} ok — ${report.join("; ")}`);
          const expire = Number(new URL(url).searchParams.get("expire"));
          return {
            url,
            mime: format.mime_type?.split(";")[0] ?? "audio/mp4",
            expiresAt: expire ? expire * 1000 : Date.now() + 5 * 3600_000,
            userAgent,
            viaFetch,
          };
        } catch (e) {
          report.push(`${client}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new SourceError(
        "unplayable",
        `no playable stream for ${videoId} (${report.join("; ")})`,
      );
    });
  }
}

/** Non-sensitive facts about a stream URL, for the log. */
function describeUrl(url: string): string {
  const q = new URL(url).searchParams;
  const ip = q.get("ip") ?? "";
  return [
    `itag ${q.get("itag")}`,
    `c=${q.get("c")}`,
    ip.includes(":") ? "ipv6" : ip ? "ipv4" : "no-ip",
    q.has("pot") ? "pot" : "no-pot",
    q.has("n") ? "n" : "no-n",
  ].join(" ");
}

/** HTTP status of the first bytes of a stream URL, fetched the same way playback will. */
async function probeStream(url: string, userAgent: string): Promise<number> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<number>("stream_probe", { url, userAgent });
  }
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-1023", "User-Agent": userAgent } });
    return res.status;
  } catch {
    return 0;
  }
}
