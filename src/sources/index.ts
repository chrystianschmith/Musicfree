import { MockMusicSource } from "./mock/MockMusicSource";
import type { MusicSource } from "./types";

let instance: MusicSource | undefined;

/** The active music source. Replaced by the YouTube source inside Tauri (see Task 10). */
export function getSource(): MusicSource {
  instance ??= new MockMusicSource();
  return instance;
}

export * from "./types";
