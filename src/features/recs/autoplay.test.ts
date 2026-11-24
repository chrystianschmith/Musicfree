import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../../sources/types";
import { usePlayer } from "../../store/player";

const recommendFor = vi.fn();
vi.mock("./engine", () => ({ recommender: () => ({ recommendFor }) }));

import { extendQueueIfNeeded } from "./autoplay";

const t = (n: number): Track => ({
  id: `t${n}`,
  title: `T${n}`,
  artists: [{ id: "a", name: "A" }],
  thumbs: [],
});

beforeEach(() => {
  usePlayer.getState().reset();
  recommendFor.mockReset();
});

describe("extendQueueIfNeeded", () => {
  it("continues with style recommendations seeded by the current track, avoiding the queue", async () => {
    recommendFor.mockResolvedValue([t(10), t(11)]);
    usePlayer.getState().playTracks([t(1), t(2)], 1);
    await extendQueueIfNeeded();
    const [seeds, opts] = recommendFor.mock.calls[0];
    expect(seeds.map((s: Track) => s.id)).toEqual(["t2"]);
    expect(opts.heard.map((s: Track) => s.id)).toEqual(["t1", "t2"]);
    expect(
      usePlayer
        .getState()
        .upcoming()
        .map((x) => x.id),
    ).toEqual(["t10", "t11"]);
  });
});
