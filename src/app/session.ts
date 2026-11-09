import { useEffect } from "react";
import { getRepo } from "../db";
import { usePlayer } from "../store/player";
import type { Track } from "../sources/types";

type Snapshot = {
  queue: Track[];
  index: number;
  position: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
};
const KEY = "lastSession";

/** Restores the last queue (paused) on start and saves it as playback changes. */
export function useSessionPersistence() {
  useEffect(() => {
    let alive = true;
    void (async () => {
      const snap = await (await getRepo()).getSetting<Snapshot>(KEY);
      if (!alive || !snap || usePlayer.getState().queue.length) return;
      const p = usePlayer.getState();
      p.setVolume(snap.volume ?? p.volume);
      usePlayer.setState({ repeat: snap.repeat ?? "off" });
      p.restore({ queue: snap.queue ?? [], index: snap.index ?? 0, position: snap.position ?? 0 });
    })();

    let last = 0;
    const save = () => {
      const s = usePlayer.getState();
      if (!s.queue.length) return;
      const cur = s.order[s.index];
      const snap: Snapshot = {
        // Save in playback order so a restore without shuffle keeps "up next" intact.
        queue: s.order.map((i) => s.queue[i]).slice(0, 500),
        index: Math.max(0, s.order.indexOf(cur)),
        position: s.position,
        volume: s.volume,
        shuffle: s.shuffle,
        repeat: s.repeat,
      };
      void getRepo().then((r) => r.setSetting(KEY, snap));
    };
    const unsub = usePlayer.subscribe((s, prev) => {
      const structural =
        s.queue !== prev.queue ||
        s.order !== prev.order ||
        s.index !== prev.index ||
        s.volume !== prev.volume ||
        s.repeat !== prev.repeat;
      if (structural || Date.now() - last > 5000) {
        last = Date.now();
        save();
      }
    });
    window.addEventListener("beforeunload", save);
    return () => {
      alive = false;
      unsub();
      window.removeEventListener("beforeunload", save);
    };
  }, []);
}
