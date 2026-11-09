import { create } from "zustand";

export type Toast = { id: number; text: string };
export type NowPlayingTab = "lyrics" | "queue" | "related";

type UI = {
  panelOpen: boolean;
  nowPlayingOpen: boolean;
  nowPlayingTab: NowPlayingTab;
  toasts: Toast[];
  togglePanel(): void;
  openNowPlaying(tab?: NowPlayingTab): void;
  closeNowPlaying(): void;
  toast(text: string): void;
};

let seq = 0;

export const useUI = create<UI>()((set, get) => ({
  panelOpen: true,
  nowPlayingOpen: false,
  nowPlayingTab: "lyrics",
  toasts: [],
  togglePanel: () => set({ panelOpen: !get().panelOpen }),
  openNowPlaying: (tab) =>
    set((s) => ({
      nowPlayingOpen: tab && s.nowPlayingOpen && s.nowPlayingTab === tab ? false : true,
      nowPlayingTab: tab ?? s.nowPlayingTab,
    })),
  closeNowPlaying: () => set({ nowPlayingOpen: false }),
  toast(text) {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4000);
  },
}));
