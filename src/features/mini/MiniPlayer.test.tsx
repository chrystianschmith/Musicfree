import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const emitTo = vi.fn(async () => undefined);
const handlers = new Map<string, (e: { payload: unknown }) => void>();
vi.mock("@tauri-apps/api/event", () => ({
  emitTo: (...a: unknown[]) => emitTo(...(a as [])),
  listen: vi.fn(async (name: string, cb: (e: { payload: unknown }) => void) => {
    handlers.set(name, cb);
    return () => handlers.delete(name);
  }),
}));
const created: { label: string; opts: Record<string, unknown> }[] = [];
const existing = { show: vi.fn(), unminimize: vi.fn(), setFocus: vi.fn() };
let miniExists = false;
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: class {
    constructor(label: string, opts: Record<string, unknown>) {
      created.push({ label, opts });
    }
    static async getByLabel(label: string) {
      return label === "mini" && miniExists ? existing : label === "main" ? existing : null;
    }
  },
  getCurrentWebviewWindow: () => ({ close: vi.fn(), minimize: vi.fn() }),
}));

import { MiniPlayer } from "./MiniPlayer";
import { openMiniPlayer } from "./openMini";

afterEach(cleanup);
beforeEach(() => {
  emitTo.mockClear();
  handlers.clear();
  created.length = 0;
  miniExists = false;
});

describe("MiniPlayer", () => {
  it("asks the main window for the current state and shows it", async () => {
    render(<MiniPlayer />);
    await act(async () => undefined);
    expect(emitTo).toHaveBeenCalledWith("main", "mini:hello", null);
    act(() =>
      handlers.get("mini:state")!({
        payload: {
          title: "Clocks",
          artist: "Coldplay",
          playing: true,
          position: 30,
          duration: 300,
        },
      }),
    );
    expect(screen.getByText("Clocks")).toBeTruthy();
    expect(screen.getByText("Coldplay")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pausar" })).toBeTruthy();
  });

  it("sends the controls to the main window", async () => {
    render(<MiniPlayer />);
    await act(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Tocar" }));
    await act(async () => undefined);
    const sent = emitTo.mock.calls.filter((c) => (c as unknown[])[1] === "media:command");
    expect(sent.map((c) => (c as unknown[])[2])).toEqual(["next", "prev", "toggle"]);
  });
});

describe("openMiniPlayer", () => {
  it("opens a small always-on-top window", async () => {
    await openMiniPlayer();
    expect(created).toHaveLength(1);
    expect(created[0].label).toBe("mini");
    expect(created[0].opts).toMatchObject({
      alwaysOnTop: true,
      decorations: false,
      resizable: false,
    });
    expect(String(created[0].opts.url)).toContain("#/mini");
  });

  it("brings an already open mini player to the front instead of opening another", async () => {
    miniExists = true;
    await openMiniPlayer();
    expect(created).toHaveLength(0);
    expect(existing.show).toHaveBeenCalled();
  });
});
