import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../sources/types";
import { usePlayer } from "../store/player";

const invoke = vi.fn();
const listeners = new Map<string, (e: { payload: unknown }) => void>();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, cb: (e: { payload: unknown }) => void) => {
    listeners.set(name, cb);
    return () => listeners.delete(name);
  }),
  emitTo: (...a: unknown[]) => emitTo(...(a as [])),
}));
const emitTo = vi.fn(async () => undefined);

import { handleMediaCommand, initDesktop, platformClass } from "./desktop";

const t = (n: number): Track => ({
  id: `t${n}`,
  title: `T${n}`,
  artists: [{ name: "A" }],
  thumbs: [],
});
const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/157.0 Edg/157.0";

beforeEach(() => {
  usePlayer.getState().reset();
  invoke.mockReset();
  listeners.clear();
  document.documentElement.className = "";
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("platformClass", () => {
  it("recognises Windows, macOS and Linux", () => {
    expect(platformClass(WIN)).toBe("win");
    expect(platformClass("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("mac");
    expect(platformClass("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
  });
});

describe("handleMediaCommand", () => {
  it("drives the player from the tray, the taskbar buttons and the mini player", () => {
    usePlayer.getState().playTracks([t(1), t(2), t(3)], 0);
    handleMediaCommand("toggle");
    expect(usePlayer.getState().playing).toBe(false);
    handleMediaCommand("toggle");
    expect(usePlayer.getState().playing).toBe(true);
    handleMediaCommand("next");
    expect(usePlayer.getState().current()?.id).toBe("t2");
    handleMediaCommand("prev");
    expect(usePlayer.getState().current()?.id).toBe("t1");
    expect(() => handleMediaCommand("bogus")).not.toThrow();
  });
});

describe("initDesktop", () => {
  it("marks the platform and turns on the Mica styles when the window has the backdrop", async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    invoke.mockImplementation(async (cmd: string) =>
      cmd === "desktop_backdrop" ? "mica" : undefined,
    );
    await initDesktop(WIN);
    const html = document.documentElement.classList;
    expect(html.contains("win")).toBe(true);
    expect(html.contains("mica")).toBe(true);
  });

  it("answers tray and taskbar clicks and reports what is playing", async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue("none");
    await initDesktop(WIN);
    usePlayer.getState().playTracks([t(1), t(2)], 0);
    expect(invoke).toHaveBeenCalledWith("set_now_playing", { title: "T1 — A", playing: true });
    listeners.get("media:command")!({ payload: "next" });
    expect(usePlayer.getState().current()?.id).toBe("t2");
    expect(document.documentElement.classList.contains("mica")).toBe(false);
  });

  it("sends the mini player its state only while it is open", async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    invoke.mockResolvedValue("none");
    await initDesktop(WIN);
    emitTo.mockClear();
    usePlayer.getState().playTracks([t(1)], 0);
    expect(emitTo).not.toHaveBeenCalled();
    listeners.get("mini:hello")!({ payload: null });
    usePlayer.getState().setPosition(12);
    expect(emitTo).toHaveBeenLastCalledWith(
      "mini",
      "mini:state",
      expect.objectContaining({ position: 12 }),
    );
    listeners.get("mini:bye")!({ payload: null });
    emitTo.mockClear();
    usePlayer.getState().setPosition(13);
    expect(emitTo).not.toHaveBeenCalled();
  });

  it("only adds the platform class in a plain browser", async () => {
    await initDesktop(WIN);
    expect(invoke).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains("win")).toBe(true);
  });
});
