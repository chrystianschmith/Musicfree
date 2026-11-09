import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../store/player";
import { useUI } from "../store/ui";

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** Global keyboard shortcuts (spec §4.13). */
export function useShortcuts() {
  const nav = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = usePlayer.getState();
      const ui = useUI.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.closeNowPlaying();
        nav("/search");
        setTimeout(() => document.getElementById("search-input")?.focus(), 50);
        return;
      }
      if (typing(e.target)) return;
      if (e.key === "/" && !mod) {
        e.preventDefault();
        ui.closeNowPlaying();
        nav("/search");
        setTimeout(() => document.getElementById("search-input")?.focus(), 50);
      } else if (e.key === " " && !mod) {
        e.preventDefault();
        p.toggle();
      } else if (mod && e.key === "ArrowRight") {
        e.preventDefault();
        p.next();
      } else if (mod && e.key === "ArrowLeft") {
        e.preventDefault();
        p.prev();
      } else if (mod && e.key === "ArrowUp") {
        e.preventDefault();
        p.setVolume(p.volume + 0.1);
      } else if (mod && e.key === "ArrowDown") {
        e.preventDefault();
        p.setVolume(p.volume - 0.1);
      } else if (mod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        ui.openNowPlaying("lyrics");
      } else if (e.key === "Escape" && ui.nowPlayingOpen) {
        ui.closeNowPlaying();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);
}
