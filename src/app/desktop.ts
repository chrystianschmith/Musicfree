/**
 * Desktop integration: platform styles, the Windows 11 Mica backdrop, and the bridge between
 * the player and the native controls (tray menu, taskbar buttons, mini player window).
 */
import { isTauri } from "../lib/platform";
import { artistNames } from "../sources/types";
import { usePlayer } from "../store/player";
import { pickThumb } from "../lib/format";

export type Platform = "win" | "mac" | "linux";

export function platformClass(ua: string): Platform {
  if (/Windows/i.test(ua)) return "win";
  if (/Mac OS X|Macintosh/i.test(ua)) return "mac";
  return "linux";
}

/** Commands sent by the tray menu, the taskbar thumbnail buttons and the mini player. */
export function handleMediaCommand(action: unknown) {
  const p = usePlayer.getState();
  switch (action) {
    case "toggle":
      return p.toggle();
    case "next":
      return p.next();
    case "prev":
      return p.prev();
    case "play":
      return p.setPlaying(true);
    case "pause":
      return p.setPlaying(false);
  }
}

/** What the mini player shows. */
export type MiniState = {
  title?: string;
  artist?: string;
  cover?: string;
  playing: boolean;
  position: number;
  duration: number;
};

export function miniState(): MiniState {
  const s = usePlayer.getState();
  const cur = s.current();
  return {
    title: cur?.title,
    artist: cur ? artistNames(cur) : undefined,
    cover: cur ? pickThumb(cur.thumbs, 240) : undefined,
    playing: s.playing,
    position: s.position,
    duration: s.duration,
  };
}

/** Call once at start-up (main.tsx). */
export async function initDesktop(ua = navigator.userAgent) {
  document.documentElement.classList.add(platformClass(ua));
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen, emitTo } = await import("@tauri-apps/api/event");

  const backdrop = await invoke<string>("desktop_backdrop").catch(() => "none");
  if (backdrop === "mica") document.documentElement.classList.add("mica");

  await listen("media:command", (e) => handleMediaCommand(e.payload));
  // The mini player says hello when it opens and bye when it closes; only then is it fed.
  let miniOpen = false;
  await listen("mini:hello", () => {
    miniOpen = true;
    void emitTo("mini", "mini:state", miniState());
  });
  await listen("mini:bye", () => (miniOpen = false));

  // Keep the tray tooltip / taskbar play button and the mini player in step with the player.
  let last = "";
  usePlayer.subscribe(() => {
    const s = usePlayer.getState();
    const cur = s.current();
    const title = cur ? `${cur.title} — ${artistNames(cur)}` : null;
    const key = `${title}|${s.playing}`;
    if (key !== last) {
      last = key;
      void invoke("set_now_playing", { title, playing: s.playing }).catch(() => undefined);
    }
    if (miniOpen) void emitTo("mini", "mini:state", miniState()).catch(() => undefined);
  });
}
