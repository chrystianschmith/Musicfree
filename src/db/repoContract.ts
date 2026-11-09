import { beforeEach, describe, expect, it } from "vitest";
import type { Track } from "../sources/types";
import type { LibraryRepo } from "./LibraryRepo";

const tr = (n: number): Track => ({
  id: `t${n}`,
  title: `T${n}`,
  artists: [{ id: "a", name: "A" }],
  thumbs: [],
  durationMs: 1000 * n,
});

/** Shared behavioral suite run against every LibraryRepo implementation. */
export function repoContract(name: string, make: () => Promise<LibraryRepo>) {
  describe(`LibraryRepo contract: ${name}`, () => {
    let r: LibraryRepo;
    beforeEach(async () => {
      r = await make();
    });

    it("toggles likes and lists newest first", async () => {
      expect(await r.toggleLike(tr(1))).toBe(true);
      expect(await r.toggleLike(tr(2))).toBe(true);
      expect(await r.isLiked("t1")).toBe(true);
      expect((await r.liked()).map((t) => t.id)).toEqual(["t2", "t1"]);
      expect(await r.toggleLike(tr(1))).toBe(false);
      expect(await r.isLiked("t1")).toBe(false);
      expect((await r.likedIds()).sort()).toEqual(["t2"]);
    });

    it("keeps the full track data", async () => {
      await r.toggleLike(tr(3));
      expect((await r.liked())[0]).toEqual(tr(3));
    });

    it("creates, renames, lists and deletes playlists", async () => {
      const id = await r.createPlaylist("Rock");
      await r.renamePlaylist(id, "Rock 2");
      expect(await r.playlists()).toEqual([{ id, name: "Rock 2", count: 0 }]);
      await r.deletePlaylist(id);
      expect(await r.playlists()).toEqual([]);
    });

    it("adds, moves and removes playlist tracks by position", async () => {
      const id = await r.createPlaylist("P");
      for (const n of [1, 2, 3]) await r.addToPlaylist(id, tr(n));
      await r.movePlaylistTrack(id, 2, 0);
      expect((await r.playlistTracks(id)).map((t) => t.id)).toEqual(["t3", "t1", "t2"]);
      await r.removeFromPlaylist(id, 1);
      expect((await r.playlistTracks(id)).map((t) => t.id)).toEqual(["t3", "t2"]);
      expect((await r.playlists())[0].count).toBe(2);
    });

    it("allows the same track twice in a playlist", async () => {
      const id = await r.createPlaylist("P");
      await r.addToPlaylist(id, tr(1));
      await r.addToPlaylist(id, tr(1));
      expect((await r.playlistTracks(id)).length).toBe(2);
    });

    it("saves and unsaves albums and artists", async () => {
      const album = { id: "al", title: "Al", artists: [], thumbs: [], tracks: [] };
      await r.saveAlbum(album);
      expect((await r.savedAlbums()).map((a) => a.id)).toEqual(["al"]);
      expect(await r.isAlbumSaved("al")).toBe(true);
      await r.unsaveAlbum("al");
      expect(await r.savedAlbums()).toEqual([]);
      const artist = {
        id: "ar",
        name: "Ar",
        thumbs: [],
        topTracks: [],
        albums: [],
        singles: [],
        related: [],
      };
      await r.saveArtist(artist);
      expect(await r.isArtistSaved("ar")).toBe(true);
      await r.unsaveArtist("ar");
      expect(await r.savedArtists()).toEqual([]);
    });

    it("records history newest first and caps it", async () => {
      await r.pushHistory(tr(1));
      await r.pushHistory(tr(2));
      expect((await r.history()).map((t) => t.id)).toEqual(["t2", "t1"]);
      for (let i = 0; i < 5005; i++) await r.pushHistory(tr(i % 7));
      expect((await r.history(10_000)).length).toBe(5000);
    });

    it("stores settings as JSON", async () => {
      expect(await r.getSetting("x")).toBeUndefined();
      await r.setSetting("x", { a: [1, 2] });
      expect(await r.getSetting("x")).toEqual({ a: [1, 2] });
    });
  });
}
