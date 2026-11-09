import { isTauri } from "../lib/platform";
import { MockMusicSource } from "./mock/MockMusicSource";
import { YouTubeMusicSource } from "./youtube/YouTubeMusicSource";
import type { MusicSource } from "./types";

let instance: MusicSource | undefined;

/**
 * The active music source: YouTube Music inside the desktop app, mock data in the browser build.
 * Override with VITE_SOURCE=mock|youtube.
 */
export function getSource(): MusicSource {
  if (!instance) {
    const forced = import.meta.env.VITE_SOURCE as string | undefined;
    const useYoutube = forced ? forced === "youtube" : isTauri();
    instance = useYoutube ? new YouTubeMusicSource() : new MockMusicSource();
  }
  return instance;
}

export * from "./types";
