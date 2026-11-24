# Recommendations by style + Windows polish — plan

Spec: `docs/design/specs/2026-11-24-recs-and-windows-design.md`. Every step test-first.

1. **Title keys and alternate versions** — `src/features/recs/titles.ts`:
   `titleKey(title)`, `isAltVersion(title)`. Tests in `titles.test.ts`.
2. **Mixer** — `src/features/recs/mix.ts`: `mixBuckets(buckets, { limit, heardKeys })`
   (weights, dedupe, per-artist caps, no 3 in a row). Tests in `mix.test.ts`.
3. **Candidate gathering** — `src/features/recs/engine.ts`:
   `recommendFor(seeds, { limit, heard })` using `MusicSource.album/artist/related/radio`,
   with a session cache. Tests with a fake source.
4. **Wire it in** — personal shelves and `extendQueueIfNeeded` use `recommendFor`.
5. **Window chrome** — dark theme, Mica on Windows 11 (`tauri.windows.conf.json`,
   Rust `apply_backdrop`), CSS `html.mica`.
6. **Tray + close to tray + taskbar buttons** — Rust `tray.rs`, `thumbbar.rs` (Windows only);
   front `src/app/desktop.ts` bridges `media:*` events to the player store; setting in UI store.
7. **Mini player** — route `#/mini`, `src/features/mini/`, window created from the player bar;
   state/commands over Tauri events.
8. **Scale and fonts** — font stack, hit targets, e2e checks at 1.25 and 1.5 device scale.
9. **Release 0.3.0** — README (pt/en), version bump, push `release`.
