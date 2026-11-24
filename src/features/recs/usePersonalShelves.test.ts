import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../../sources/types";

const tr = (id: string, artist: string): Track => ({
  id,
  title: id,
  artists: [{ id: `ar-${artist}`, name: artist }],
  thumbs: [],
});
const radio = vi.fn(async (id: string) => [
  tr(id, "seed"),
  { ...tr(`${id}-live`, "Outro"), title: `${id} (Ao Vivo)` },
  ...[1, 2, 3, 4, 5].map((n) => tr(`${id}-r${n}`, `R${n}`)),
]);
// The Related tab of a song also brings other uploads of it ("a (Ao Vivo)" by someone else).
const related = vi.fn(async (id: string) => [
  { ...tr(`${id}-live`, "Outro"), title: `${id} (Ao Vivo)` },
  ...[1, 2, 3].map((n) => tr(`${id}-rel${n}`, `Rel${id}${n}`)),
]);
const artist = vi.fn(async (id: string) => ({
  id,
  name: id,
  thumbs: [],
  topTracks: [1, 2].map((n) => tr(`${id}-top${n}`, id.slice(3))),
  albums: [],
  singles: [],
  related: [],
}));

vi.mock("../../sources", () => ({
  getSource: () => ({ radio, related, artist, album: vi.fn() }),
}));
const settings = new Map<string, unknown>();
vi.mock("../../db", () => ({
  getRepo: async () => ({
    getSetting: async (k: string) => settings.get(k),
    setSetting: async (k: string, v: unknown) => void settings.set(k, v),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  settings.clear();
  radio.mockClear();
  related.mockClear();
});

describe("buildPersonalShelves", () => {
  it("returns nothing before there is listening history", async () => {
    const { buildPersonalShelves } = await import("./usePersonalShelves");
    expect(await buildPersonalShelves()).toEqual([]);
    expect(related).not.toHaveBeenCalled();
    expect(radio).not.toHaveBeenCalled();
  });

  it("builds mix, replay, because-you-listened and artists from what was played", async () => {
    const { recordListen } = await import("./store");
    await recordListen(tr("a", "Ana"), 1);
    await recordListen(tr("a", "Ana"), 1);
    await recordListen(tr("b", "Bia"), 1);
    const { buildPersonalShelves } = await import("./usePersonalShelves");
    const shelves = await buildPersonalShelves();
    expect(shelves.map((s) => s.title)).toEqual([
      "Seu mix de hoje",
      "Voltar a ouvir",
      "Porque você ouviu a",
      "Seus artistas mais tocados",
    ]);
    const ids = (i: number) =>
      shelves[i].items.map((x) =>
        x.kind === "track" ? x.track.id : x.kind === "artist" ? x.artist.id : "",
      );
    expect(ids(0)).not.toContain("a"); // the mix only suggests tracks not heard yet
    expect(ids(0)).not.toContain("a-live"); // nor other versions of them
    expect(ids(1).slice(0, 2)).toEqual(["a", "b"]);
    expect(ids(2)).not.toContain("a");
    expect(ids(2)).not.toContain("a-live");
    expect(ids(3)).toEqual(["ar-Ana", "ar-Bia"]);
  });

  it("skipped tracks do not seed recommendations", async () => {
    const { recordListen } = await import("./store");
    await recordListen(tr("a", "Ana"), 1);
    await recordListen(tr("b", "Bia"), 1);
    await recordListen(tr("z", "Zed"), 0.02);
    const { buildPersonalShelves } = await import("./usePersonalShelves");
    await buildPersonalShelves();
    expect(related.mock.calls.map((c) => c[0])).not.toContain("z");
  });
});
