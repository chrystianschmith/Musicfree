import { describe, expect, it, vi } from "vitest";
import { fetchLrclib } from "./lyrics";
import type { Track } from "../sources/types";

const track: Track = {
  id: "x",
  title: "Luzes",
  artists: [{ name: "Noite Clara" }],
  album: { title: "Neon" },
  durationMs: 150_000,
  thumbs: [],
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("fetchLrclib", () => {
  it("uses /api/get with title, artist, album and duration", async () => {
    const f = vi.fn(async () => json(200, { syncedLyrics: "[00:01.00]Oi", plainLyrics: "Oi" }));
    const r = await fetchLrclib(track, f);
    const url = new URL(String((f.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/api/get");
    expect(url.searchParams.get("track_name")).toBe("Luzes");
    expect(url.searchParams.get("artist_name")).toBe("Noite Clara");
    expect(url.searchParams.get("duration")).toBe("150");
    expect(r?.synced).toEqual([{ t: 1, line: "Oi" }]);
  });

  it("falls back to /api/search when /api/get misses", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(200, [{ syncedLyrics: null, plainLyrics: "Só texto" }]));
    const r = await fetchLrclib(track, f);
    expect(new URL(String(f.mock.calls[1][0])).pathname).toBe("/api/search");
    expect(r).toEqual({ synced: undefined, plain: "Só texto" });
  });

  it("returns null when nothing is found or instrumental", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(404, {})).mockResolvedValueOnce(json(200, []));
    expect(await fetchLrclib(track, f)).toBeNull();
    const g = vi.fn(async () =>
      json(200, { instrumental: true, syncedLyrics: null, plainLyrics: null }),
    );
    expect(await fetchLrclib(track, g)).toBeNull();
  });
});
