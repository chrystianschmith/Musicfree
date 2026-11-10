# Contributing

Thanks for your interest in Musicfree.

## Setup

```bash
pnpm install
pnpm dev          # UI in the browser with demo data
pnpm tauri dev    # desktop app with real YouTube Music
```

## Before opening a pull request

```bash
pnpm lint && pnpm test && pnpm e2e
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

CI runs the same checks on every pull request.

## Where things live

- **YouTube changed something and a screen broke?** Everything YouTube-specific is in `src/sources/youtube/`. The mappers in `mappers.ts` are pure functions with unit tests; reproduce the new response shape in `mappers.test.ts` first, then fix the mapper. `pnpm smoke` runs a live check against the real API.
- **Playback issues** are usually in `src/sources/youtube/YouTubeMusicSource.ts` (`resolveStream`) or the Rust proxy in `src-tauri/src/stream.rs`.
- **UI** follows the design spec in `docs/design/specs/`: one background color, no boxes or cards, icon-only controls, violet `#9F97F0` for active states.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `ci:`, `chore:`.
