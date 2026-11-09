/** Domain model. Nothing from youtubei.js may leak past src/sources/youtube. */

export type Thumb = { url: string; w: number; h: number };
export type ArtistRef = { id?: string; name: string };

export type Track = {
  id: string;
  title: string;
  artists: ArtistRef[];
  album?: { id?: string; title: string };
  durationMs?: number;
  thumbs: Thumb[];
  explicit?: boolean;
};

export type Album = {
  id: string;
  title: string;
  artists: ArtistRef[];
  year?: string;
  kind?: "album" | "single" | "ep";
  thumbs: Thumb[];
  tracks: Track[];
};

export type Artist = {
  id: string;
  name: string;
  thumbs: Thumb[];
  subtitle?: string;
  topTracks: Track[];
  albums: Album[];
  singles: Album[];
  related: Artist[];
};

export type Playlist = {
  id: string;
  title: string;
  author?: string;
  thumbs: Thumb[];
  tracks: Track[];
};

export type ShelfItem =
  | { kind: "track"; track: Track }
  | { kind: "album"; album: Album }
  | { kind: "playlist"; playlist: Playlist }
  | { kind: "artist"; artist: Artist };

export type Shelf = { title: string; items: ShelfItem[] };

export type SearchFilter = "all" | "songs" | "albums" | "artists" | "playlists";

export type SearchResult = {
  top?: ShelfItem;
  songs: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
};

/** `userAgent` is the client UA the URL was issued for; the Rust proxy replays it. */
export type StreamInfo = { url: string; mime: string; expiresAt: number; userAgent?: string };

export type HomeFeed = { moods: string[]; shelves: Shelf[] };

export interface MusicSource {
  home(mood?: string): Promise<HomeFeed>;
  search(q: string, filter?: SearchFilter): Promise<SearchResult>;
  suggestions(q: string): Promise<string[]>;
  artist(id: string): Promise<Artist>;
  album(id: string): Promise<Album>;
  playlist(id: string): Promise<Playlist>;
  radio(videoId: string): Promise<Track[]>;
  related(videoId: string): Promise<Track[]>;
  explore(): Promise<Shelf[]>;
  resolveStream(videoId: string): Promise<StreamInfo>;
}

export type SourceErrorKind = "network" | "parse" | "not-found" | "unplayable";

export class SourceError extends Error {
  constructor(
    public kind: SourceErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SourceError";
  }
}

export const artistNames = (t: { artists: ArtistRef[] }) => t.artists.map((a) => a.name).join(", ");
