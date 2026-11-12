import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../../sources/types";
import { usePlayer } from "../../store/player";

const pending = new Map<string, (url: string) => void>();
const prefetch = vi.fn();
vi.mock("../../lib/stream", () => ({
  playableUrl: (id: string) => new Promise<string>((res) => pending.set(id, res)),
  prefetch: (id: string) => prefetch(id),
}));
vi.mock("../recs/autoplay", () => ({ extendQueueIfNeeded: vi.fn() }));
vi.mock("../recs/store", () => ({ recordListen: vi.fn() }));
vi.mock("../../db", () => ({ getRepo: vi.fn(() => new Promise(() => undefined)) }));

import { AudioEngine } from "./AudioEngine";

const t = (n: number): Track => ({ id: `t${n}`, title: `T${n}`, artists: [{ name: "A" }], thumbs: [] });

function mount() {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <AudioEngine />
    </QueryClientProvider>,
  );
  return container.querySelector("audio")!;
}

beforeEach(() => {
  pending.clear();
  prefetch.mockClear();
  usePlayer.getState().reset();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

describe("AudioEngine track switching", () => {
  it("silences the previous track as soon as the next one is chosen", async () => {
    usePlayer.getState().playTracks([t(1), t(2)], 0);
    const audio = mount();
    await act(async () => pending.get("t1")!("mf-stream://t1"));
    expect(audio.getAttribute("src")).toBe("mf-stream://t1");

    act(() => usePlayer.getState().next());

    // The new URL is still resolving, but the old song must not keep playing meanwhile.
    expect(audio.getAttribute("src")).toBeNull();
  });

  it("keeps playing the new track when the old one's pause event arrives late", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockReturnValue(false);
    usePlayer.getState().playTracks([t(1), t(2)], 0);
    const audio = mount();
    await act(async () => pending.get("t1")!("mf-stream://t1"));

    act(() => usePlayer.getState().next());
    // Browsers fire "pause" as a later task, after the switch has finished.
    act(() => {
      audio.dispatchEvent(new Event("pause"));
    });

    expect(usePlayer.getState().playing).toBe(true);
  });

  it("warms the next track as soon as the current one starts, not near its end", async () => {
    usePlayer.getState().playTracks([t(1), t(2)], 0);
    const audio = mount();
    await act(async () => pending.get("t1")!("mf-stream://t1"));
    act(() => {
      audio.dispatchEvent(new Event("playing"));
    });
    expect(prefetch).toHaveBeenCalledWith("t2");
  });
});
