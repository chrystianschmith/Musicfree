import { isTauri } from "../lib/platform";
import type { LibraryRepo } from "./LibraryRepo";
import { MemoryRepo } from "./memoryRepo";

let repo: Promise<LibraryRepo> | undefined;

async function openTauriRepo(): Promise<LibraryRepo> {
  const [{ default: Database }, { SqliteRepo }] = await Promise.all([
    import("@tauri-apps/plugin-sql"),
    import("./sqliteRepo"),
  ]);
  const open = async () => SqliteRepo.open(await Database.load("sqlite:musicfree.db"));
  try {
    return await open();
  } catch (err) {
    // Corrupt DB or failed migration: back it up on the Rust side, recreate, and tell the user.
    console.error("library open failed", err);
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("backup_and_reset_db").catch(() => undefined);
    const { useUI } = await import("../store/ui");
    useUI.getState().toast("Sua biblioteca foi recriada. Um backup foi salvo.");
    return open();
  }
}

/** The library for this runtime: SQLite in the desktop app, localStorage-backed memory in the browser. */
export function getRepo(): Promise<LibraryRepo> {
  repo ??= isTauri() ? openTauriRepo() : Promise.resolve(new MemoryRepo("musicfree-library"));
  return repo;
}

export type { LibraryRepo, PlaylistSummary } from "./LibraryRepo";
