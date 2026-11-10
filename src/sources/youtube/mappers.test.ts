import { describe, expect, it } from "vitest";
import { mapListItem, mapPanelVideo, mapThumbs, mapTwoRow, textOf } from "./mappers";

const thumbs = [
  { url: "https://lh3.googleusercontent.com/abc=w60-h60-l90-rj", width: 60, height: 60 },
  { url: "https://lh3.googleusercontent.com/abc=w120-h120-l90-rj", width: 120, height: 120 },
];

describe("textOf", () => {
  it("reads Text objects, strings and missing values", () => {
    expect(textOf({ text: "Oi" })).toBe("Oi");
    expect(textOf("Oi")).toBe("Oi");
    expect(textOf(undefined)).toBe("");
  });
});

describe("mapThumbs", () => {
  it("adds an upscaled 544px variant for googleusercontent thumbnails", () => {
    const out = mapThumbs(thumbs);
    expect(out[out.length - 1]).toEqual({
      url: "https://lh3.googleusercontent.com/abc=w544-h544-l90-rj",
      w: 544,
      h: 544,
    });
  });
  it("keeps ytimg video thumbnails as-is and handles empty input", () => {
    expect(
      mapThumbs([{ url: "https://i.ytimg.com/vi/x/hq.jpg", width: 480, height: 360 }]),
    ).toEqual([{ url: "https://i.ytimg.com/vi/x/hq.jpg", w: 480, h: 360 }]);
    expect(mapThumbs(undefined)).toEqual([]);
  });
});

describe("mapListItem", () => {
  it("maps a song row", () => {
    const t = mapListItem({
      item_type: "song",
      id: "vid1",
      title: "Song",
      artists: [{ name: "Art", channel_id: "UC1" }],
      album: { id: "MPRE1", name: "Alb" },
      duration: { text: "3:05", seconds: 185 },
      thumbnails: thumbs,
      badges: [{ type: "MusicInlineBadge", label: "Explicit" }],
    });
    expect(t).toMatchObject({
      kind: "track",
      track: {
        id: "vid1",
        title: "Song",
        artists: [{ id: "UC1", name: "Art" }],
        album: { id: "MPRE1", title: "Alb" },
        durationMs: 185_000,
        explicit: true,
      },
    });
  });
  it("tolerates a video without duration, album or thumbnail", () => {
    const t = mapListItem({
      item_type: "video",
      id: "vid2",
      title: "Clip",
      authors: [{ name: "Uploader" }],
    });
    expect(t).toEqual({
      kind: "track",
      track: {
        id: "vid2",
        title: "Clip",
        artists: [{ id: undefined, name: "Uploader" }],
        album: undefined,
        durationMs: undefined,
        thumbs: [],
        explicit: false,
      },
    });
  });
  it("maps album, artist and playlist rows and drops unknown ones", () => {
    expect(
      mapListItem({
        item_type: "album",
        id: "MPRE2",
        title: "A",
        year: "2020",
        artists: [{ name: "X" }],
      })?.kind,
    ).toBe("album");
    expect(mapListItem({ item_type: "artist", id: "UC2", name: "Y" })).toMatchObject({
      kind: "artist",
      artist: { id: "UC2", name: "Y" },
    });
    expect(
      mapListItem({ item_type: "playlist", id: "VLPL1", title: "P", author: { name: "Z" } }),
    ).toMatchObject({ kind: "playlist", playlist: { id: "VLPL1", author: "Z" } });
    expect(mapListItem({ item_type: "endpoint", title: "Mood" })).toBeUndefined();
    expect(mapListItem({ item_type: "song" })).toBeUndefined();
  });
});

describe("mapTwoRow", () => {
  it("maps album/playlist/artist cards and songs", () => {
    expect(
      mapTwoRow({
        item_type: "album",
        id: "MPRE3",
        title: { text: "Disco" },
        year: "2024",
        artists: [{ name: "B", channel_id: "UC3" }],
        thumbnail: thumbs,
      }),
    ).toMatchObject({
      kind: "album",
      album: { id: "MPRE3", title: "Disco", year: "2024", artists: [{ id: "UC3", name: "B" }] },
    });
    expect(
      mapTwoRow({ item_type: "artist", id: "UC4", title: { text: "Banda" }, thumbnail: thumbs })
        ?.kind,
    ).toBe("artist");
    expect(
      mapTwoRow({
        item_type: "playlist",
        id: "VLx",
        title: { text: "Mix" },
        subtitle: { text: "YouTube Music" },
        thumbnail: [],
      }),
    ).toMatchObject({
      kind: "playlist",
      playlist: { id: "VLx", title: "Mix", author: "YouTube Music" },
    });
    expect(
      mapTwoRow({
        item_type: "song",
        id: "v",
        title: { text: "S" },
        artists: [{ name: "C" }],
        thumbnail: [],
      })?.kind,
    ).toBe("track");
    expect(
      mapTwoRow({ item_type: "album", title: { text: "sem id" }, thumbnail: [] }),
    ).toBeUndefined();
  });
});

describe("mapPanelVideo", () => {
  it("maps an up-next entry", () => {
    expect(
      mapPanelVideo({
        video_id: "v9",
        title: { text: "Next" },
        artists: [{ name: "D" }],
        author: "D",
        duration: { text: "2:00", seconds: 120 },
        thumbnail: [],
        album: { name: "E" },
      }),
    ).toEqual({
      id: "v9",
      title: "Next",
      artists: [{ id: undefined, name: "D" }],
      album: { id: undefined, title: "E" },
      durationMs: 120_000,
      thumbs: [],
      explicit: false,
    });
  });
  it("falls back to author when there are no artists", () => {
    expect(
      mapPanelVideo({ video_id: "v8", title: { text: "X" }, author: "Uploader", thumbnail: [] })
        ?.artists,
    ).toEqual([{ name: "Uploader" }]);
  });
});

describe("bucketItems", () => {
  it("splits mapped items by kind, keeping first occurrence of duplicated ids", async () => {
    const { bucketItems } = await import("./mappers");
    const song = mapListItem({ item_type: "song", id: "s1", title: "S" });
    const dup = mapListItem({ item_type: "song", id: "s1", title: "S (dup)" });
    const alb = mapListItem({ item_type: "album", id: "MPRE1", title: "A" });
    const art = mapListItem({ item_type: "artist", id: "UC1", name: "Ar" });
    const pl = mapListItem({ item_type: "playlist", id: "VL1", title: "P" });
    const b = bucketItems([song, alb, dup, art, pl, undefined]);
    expect(b.songs.map((t) => t.title)).toEqual(["S"]);
    expect(b.albums.map((a) => a.id)).toEqual(["MPRE1"]);
    expect(b.artists.map((a) => a.id)).toEqual(["UC1"]);
    expect(b.playlists.map((p) => p.id)).toEqual(["VL1"]);
  });
});

describe("probeOffset", () => {
  it("probes past the first MiB, where unauthenticated streams get cut off", async () => {
    const { probeOffset } = await import("./mappers");
    expect(probeOffset("https://x.googlevideo.com/videoplayback?clen=4311468&itag=140")).toBe(
      2 * 1024 * 1024,
    );
    expect(probeOffset("https://x.googlevideo.com/videoplayback?clen=1500000")).toBe(
      1500000 - 1024,
    );
  });
  it("falls back to the start for short or unknown sizes", async () => {
    const { probeOffset } = await import("./mappers");
    expect(probeOffset("https://x.googlevideo.com/videoplayback?clen=900")).toBe(0);
    expect(probeOffset("https://x.googlevideo.com/videoplayback?itag=140")).toBe(0);
  });
});
