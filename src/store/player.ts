import { create } from "zustand";
import type { Track } from "../sources/types";

export type Repeat = "off" | "all" | "one";

type State = {
  /** Tracks in insertion order. */
  queue: Track[];
  /** Playback order: indices into `queue`. */
  order: number[];
  /** Position of the current track within `order` (-1 when empty). */
  index: number;
  shuffle: boolean;
  repeat: Repeat;
  playing: boolean;
  volume: number;
  muted: boolean;
  /** Seconds, reported by the audio engine. */
  position: number;
  duration: number;
  /** Seek target in seconds; `seekNonce` changes on every request so repeats are seen. */
  seekRequest: number | null;
  seekNonce: number;
};

type Actions = {
  reset(): void;
  playTracks(tracks: Track[], start?: number): void;
  playNext(t: Track): void;
  addToQueue(t: Track): void;
  /** Appends tracks not yet in the queue (used by the endless queue). */
  appendTracks(tracks: Track[]): void;
  removeUpcoming(k: number): void;
  moveUpcoming(from: number, to: number): void;
  jumpToUpcoming(k: number): void;
  next(): void;
  prev(): void;
  onEnded(): void;
  toggle(): void;
  setPlaying(v: boolean): void;
  setShuffle(v: boolean): void;
  cycleRepeat(): void;
  seek(sec: number): void;
  setPosition(sec: number): void;
  setDuration(sec: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  current(): Track | undefined;
  upcoming(): Track[];
  restore(snapshot: { queue: Track[]; index: number; position: number }): void;
};

const initial: State = {
  queue: [],
  order: [],
  index: -1,
  shuffle: false,
  repeat: "off",
  playing: false,
  volume: 0.8,
  muted: false,
  position: 0,
  duration: 0,
  seekRequest: null,
  seekNonce: 0,
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function shuffled(xs: number[]): number[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const usePlayer = create<State & Actions>()((set, get) => {
  const goTo = (index: number, playing = true) =>
    set((s) => ({
      index,
      playing,
      position: 0,
      duration: 0,
      seekRequest: 0,
      seekNonce: s.seekNonce + 1,
    }));

  return {
    ...initial,
    reset: () => set({ ...initial, volume: get().volume }),

    playTracks(tracks, start = 0) {
      if (!tracks.length) return;
      const idx = Math.min(Math.max(start, 0), tracks.length - 1);
      const base = range(tracks.length);
      const order = get().shuffle ? [idx, ...shuffled(base.filter((i) => i !== idx))] : base;
      set({ queue: [...tracks], order });
      goTo(get().shuffle ? 0 : idx);
    },

    playNext(t) {
      const s = get();
      if (s.index < 0) return get().playTracks([t]);
      const qi = s.queue.length;
      const order = [...s.order];
      order.splice(s.index + 1, 0, qi);
      set({ queue: [...s.queue, t], order });
    },

    addToQueue(t) {
      const s = get();
      if (s.index < 0) return get().playTracks([t]);
      set({ queue: [...s.queue, t], order: [...s.order, s.queue.length] });
    },

    appendTracks(tracks) {
      const s = get();
      const have = new Set(s.queue.map((t) => t.id));
      const fresh = tracks.filter((t) => !have.has(t.id) && have.add(t.id));
      if (!fresh.length) return;
      if (s.index < 0) return get().playTracks(fresh);
      set({
        queue: [...s.queue, ...fresh],
        order: [...s.order, ...fresh.map((_, i) => s.queue.length + i)],
      });
    },

    removeUpcoming(k) {
      const s = get();
      const pos = s.index + 1 + k;
      if (pos <= s.index || pos >= s.order.length) return;
      const qi = s.order[pos];
      const queue = s.queue.filter((_, i) => i !== qi);
      const order = s.order.filter((_, i) => i !== pos).map((x) => (x > qi ? x - 1 : x));
      set({ queue, order });
    },

    moveUpcoming(from, to) {
      const s = get();
      const up = s.order.slice(s.index + 1);
      if (from < 0 || from >= up.length || to < 0 || to >= up.length) return;
      const [x] = up.splice(from, 1);
      up.splice(to, 0, x);
      set({ order: [...s.order.slice(0, s.index + 1), ...up] });
    },

    jumpToUpcoming(k) {
      const s = get();
      const pos = s.index + 1 + k;
      if (pos < s.order.length) goTo(pos);
    },

    next() {
      const s = get();
      if (s.index < 0) return;
      if (s.index + 1 < s.order.length) goTo(s.index + 1);
      else if (s.repeat === "all") goTo(0);
      else set({ playing: false });
    },

    prev() {
      const s = get();
      if (s.index < 0) return;
      if (s.position > 3 || s.index === 0) get().seek(0);
      else goTo(s.index - 1);
    },

    onEnded() {
      const s = get();
      if (s.index < 0) return;
      if (s.repeat === "one") return get().seek(0);
      if (s.index + 1 < s.order.length) goTo(s.index + 1);
      else if (s.repeat === "all") goTo(0);
      else set({ playing: false });
    },

    toggle() {
      const s = get();
      if (s.index < 0) return;
      set({ playing: !s.playing });
    },
    setPlaying: (v) => set({ playing: get().index >= 0 && v }),

    setShuffle(v) {
      const s = get();
      if (v === s.shuffle) return;
      if (s.index < 0) return set({ shuffle: v });
      const cur = s.order[s.index];
      if (v) {
        const rest = shuffled(range(s.queue.length).filter((i) => i !== cur));
        set({ shuffle: true, order: [cur, ...rest], index: 0 });
      } else {
        set({ shuffle: false, order: range(s.queue.length), index: cur });
      }
    },

    cycleRepeat() {
      const next: Record<Repeat, Repeat> = { off: "all", all: "one", one: "off" };
      set({ repeat: next[get().repeat] });
    },

    seek: (sec) =>
      set((s) => ({
        seekRequest: Math.max(0, sec),
        seekNonce: s.seekNonce + 1,
        position: Math.max(0, sec),
      })),
    setPosition: (sec) => set({ position: sec }),
    setDuration: (sec) => set({ duration: Number.isFinite(sec) ? sec : 0 }),
    setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: false }),
    toggleMute: () => set({ muted: !get().muted }),

    current() {
      const s = get();
      return s.index >= 0 ? s.queue[s.order[s.index]] : undefined;
    },
    upcoming() {
      const s = get();
      return s.index >= 0 ? s.order.slice(s.index + 1).map((i) => s.queue[i]) : [];
    },

    restore({ queue, index, position }) {
      if (!queue.length) return;
      const i = Math.min(Math.max(index, 0), queue.length - 1);
      set((s) => ({
        queue,
        order: range(queue.length),
        index: i,
        playing: false,
        position,
        seekRequest: position,
        seekNonce: s.seekNonce + 1,
      }));
    },
  };
});
