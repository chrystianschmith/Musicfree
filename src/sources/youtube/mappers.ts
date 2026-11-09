/**
 * Pure mappers from youtubei.js parser nodes to the domain model.
 * Inputs are typed structurally (only the fields we read), so a library update that
 * renames something fails here, in one place, and the tests point at it.
 */
import type { Album, Artist, ArtistRef, Playlist, ShelfItem, Thumb, Track } from "../types";

type TextLike = { text?: string } | string | undefined | null;
type YtThumb = { url: string; width: number; height: number };
type YtArtist = { name: string; channel_id?: string };
type YtBadge = { type?: string; label?: string; icon_type?: string };

export type YtListItem = {
  item_type?: string;
  id?: string;
  title?: string;
  name?: string;
  artists?: YtArtist[];
  authors?: YtArtist[];
  author?: YtArtist;
  album?: { id?: string; name: string };
  duration?: { text?: string; seconds: number };
  year?: string;
  subtitle?: TextLike;
  thumbnails?: YtThumb[];
  badges?: YtBadge[];
};

export type YtTwoRow = {
  item_type?: string;
  id?: string;
  title?: TextLike;
  subtitle?: TextLike;
  year?: string;
  artists?: YtArtist[];
  author?: YtArtist;
  thumbnail?: YtThumb[];
  badges?: YtBadge[] | null;
};

export type YtPanelVideo = {
  video_id?: string;
  title?: TextLike;
  artists?: YtArtist[];
  author?: string;
  album?: { id?: string; name: string };
  duration?: { text?: string; seconds: number };
  thumbnail?: YtThumb[];
  badges?: YtBadge[];
};

export const textOf = (t: TextLike): string => (typeof t === "string" ? t : (t?.text ?? ""));

const SIZE_RE = /=w\d+-h\d+/;

/** Maps thumbnails and, for googleusercontent art, adds a crisp 544px variant. */
export function mapThumbs(list: YtThumb[] | undefined | null): Thumb[] {
  if (!list?.length) return [];
  const out = list.map((t) => ({ url: t.url, w: t.width, h: t.height }));
  const best = out.reduce((a, b) => (b.w > a.w ? b : a));
  if (SIZE_RE.test(best.url) && best.w < 544)
    out.push({ url: best.url.replace(SIZE_RE, "=w544-h544"), w: 544, h: 544 });
  return out;
}

const refs = (a: YtArtist[] | undefined): ArtistRef[] =>
  (a ?? []).map((x) => ({ id: x.channel_id, name: x.name }));
const isExplicit = (b: YtBadge[] | null | undefined) =>
  !!b?.some((x) => x.icon_type === "MUSIC_EXPLICIT_BADGE" || /explicit/i.test(x.label ?? ""));

const track = (id: string, title: string, artists: ArtistRef[], extra: Partial<Track>): Track => ({
  id,
  title,
  artists,
  album: extra.album,
  durationMs: extra.durationMs,
  thumbs: extra.thumbs ?? [],
  explicit: extra.explicit ?? false,
});

const album = (
  id: string,
  title: string,
  artists: ArtistRef[],
  thumbs: Thumb[],
  year?: string,
): Album => ({
  id,
  title,
  artists,
  year,
  thumbs,
  tracks: [],
});
const artist = (id: string, name: string, thumbs: Thumb[], subtitle?: string): Artist => ({
  id,
  name,
  thumbs,
  subtitle,
  topTracks: [],
  albums: [],
  singles: [],
  related: [],
});
const playlist = (id: string, title: string, thumbs: Thumb[], author?: string): Playlist => ({
  id,
  title,
  author,
  thumbs,
  tracks: [],
});

/** MusicResponsiveListItem (search rows, album/playlist tracks, artist top songs). */
export function mapListItem(i: YtListItem): ShelfItem | undefined {
  if (!i.id) return undefined;
  const thumbs = mapThumbs(i.thumbnails);
  switch (i.item_type) {
    case "song":
    case "video":
    case "non_music_track":
      return {
        kind: "track",
        track: track(
          i.id,
          i.title ?? "",
          refs(i.artists?.length ? i.artists : (i.authors ?? (i.author ? [i.author] : []))),
          {
            album: i.album ? { id: i.album.id, title: i.album.name } : undefined,
            durationMs: i.duration?.seconds ? i.duration.seconds * 1000 : undefined,
            thumbs,
            explicit: isExplicit(i.badges),
          },
        ),
      };
    case "album":
      return {
        kind: "album",
        album: album(
          i.id,
          i.title ?? "",
          refs(i.artists ?? (i.author ? [i.author] : [])),
          thumbs,
          i.year,
        ),
      };
    case "artist":
    case "library_artist":
      return {
        kind: "artist",
        artist: artist(i.id, i.name ?? i.title ?? "", thumbs, textOf(i.subtitle) || undefined),
      };
    case "playlist":
      return {
        kind: "playlist",
        playlist: playlist(i.id, i.title ?? "", thumbs, i.author?.name ?? i.authors?.[0]?.name),
      };
    default:
      return undefined;
  }
}

/** MusicTwoRowItem (home/explore carousels, artist albums/singles/related). */
export function mapTwoRow(i: YtTwoRow): ShelfItem | undefined {
  if (!i.id) return undefined;
  const thumbs = mapThumbs(i.thumbnail);
  const title = textOf(i.title);
  switch (i.item_type) {
    case "album":
      return {
        kind: "album",
        album: album(i.id, title, refs(i.artists ?? (i.author ? [i.author] : [])), thumbs, i.year),
      };
    case "playlist":
      return {
        kind: "playlist",
        playlist: playlist(
          i.id,
          title,
          thumbs,
          i.author?.name ?? (textOf(i.subtitle) || undefined),
        ),
      };
    case "artist":
      return {
        kind: "artist",
        artist: artist(i.id, title, thumbs, textOf(i.subtitle) || undefined),
      };
    case "song":
    case "video":
      return {
        kind: "track",
        track: track(i.id, title, refs(i.artists ?? (i.author ? [i.author] : [])), {
          thumbs,
          explicit: isExplicit(i.badges),
        }),
      };
    default:
      return undefined;
  }
}

/** PlaylistPanelVideo (radio / up next). */
export function mapPanelVideo(v: YtPanelVideo): Track | undefined {
  if (!v.video_id) return undefined;
  const artists = v.artists?.length ? refs(v.artists) : v.author ? [{ name: v.author }] : [];
  return track(v.video_id, textOf(v.title), artists, {
    album: v.album ? { id: v.album.id, title: v.album.name } : undefined,
    durationMs: v.duration?.seconds ? v.duration.seconds * 1000 : undefined,
    thumbs: mapThumbs(v.thumbnail),
    explicit: isExplicit(v.badges),
  });
}

export const onlyTracks = (items: (ShelfItem | undefined)[]): Track[] =>
  items.flatMap((i) => (i?.kind === "track" ? [i.track] : []));
export const defined = <T>(xs: (T | undefined)[]): T[] => xs.filter((x): x is T => x !== undefined);

/**
 * Groups mapped items by kind (deduplicated by id). Used for search results so we never depend
 * on shelf titles, which YouTube localizes ("Songs" vs "Músicas").
 */
export function bucketItems(items: (ShelfItem | undefined)[]) {
  const seen = new Set<string>();
  const out = {
    songs: [] as Track[],
    albums: [] as Album[],
    artists: [] as Artist[],
    playlists: [] as Playlist[],
  };
  for (const i of items) {
    if (!i) continue;
    const id =
      i.kind === "track"
        ? i.track.id
        : i.kind === "album"
          ? i.album.id
          : i.kind === "artist"
            ? i.artist.id
            : i.playlist.id;
    const key = `${i.kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (i.kind === "track") out.songs.push(i.track);
    else if (i.kind === "album") out.albums.push(i.album);
    else if (i.kind === "artist") out.artists.push(i.artist);
    else out.playlists.push(i.playlist);
  }
  return out;
}
