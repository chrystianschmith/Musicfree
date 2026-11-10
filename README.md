<div align="center">
  <img src="assets/logo.svg" width="72" alt="" />
  <h1>Musicfree</h1>
  <p><b>A fast, minimal desktop music player for YouTube Music.</b><br/>Spotify-style experience · lightweight native app · Windows, macOS and Linux</p>

[![CI](https://github.com/chrystianschmith/Musicfree/actions/workflows/ci.yml/badge.svg)](https://github.com/chrystianschmith/Musicfree/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/chrystianschmith/Musicfree?label=download)](https://github.com/chrystianschmith/Musicfree/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-9F97F0)](LICENSE)

[Leia em português](README.pt-BR.md)

<img src="docs/screenshots/home.png" alt="Musicfree home screen" width="860" />
</div>

## Features

- **Recommendations from what you actually listen to**: a daily mix, "Because you listened to…", replay and top-artist shelves, built from a listening profile that never leaves your computer (finishing a song counts, skipping it right away counts against)
- **Endless queue**: when the queue runs out, similar tracks keep the music going
- **Home**: mood filters, mixes, new releases and artists from YouTube Music
- **Fluid, ambient design**: the whole app is tinted with the colour of the current cover, with smooth page and list transitions and a collapsible sidebar
- **Search** with live suggestions and tabs for songs, albums, artists and playlists
- **Artist, album and playlist pages** with play, shuffle and start radio
- **Now Playing** view inside the app: big cover art, **synced lyrics** (click a line to jump), queue and related tracks
- **Your library**, stored locally: liked songs, playlists (create, rename, reorder by dragging), saved albums and artists, history
- **Queue**: play next, add to queue, reorder, shuffle, repeat one/all
- **Keyboard and OS media keys**: `Space`, `Ctrl+←/→`, `Ctrl+↑/↓`, `Ctrl+L` (lyrics), `Ctrl+K` or `/` (search), plus media keys and the system media panel
- **Resumes where you left off**: the last queue and position are restored when the app opens (paused)
- Everything runs **inside the app**: no browser windows, no accounts, no ads

| Search                                 | Artist                                 | Now Playing                                     |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| ![Search](docs/screenshots/search.png) | ![Artist](docs/screenshots/artist.png) | ![Now Playing](docs/screenshots/nowplaying.png) |

> Screenshots use the built-in demo data (fictional artists). The installed app shows real YouTube Music content.

## Download

Get the installer for your system from the **[latest release](https://github.com/chrystianschmith/Musicfree/releases/latest)**:

| System                          | File                             | Size   |
| ------------------------------- | -------------------------------- | ------ |
| Windows 10/11                   | `Musicfree_x.y.z_x64-setup.exe`  | ~4 MB  |
| macOS (Intel and Apple Silicon) | `Musicfree_x.y.z_universal.dmg`  | ~10 MB |
| Linux (Debian/Ubuntu)           | `Musicfree_x.y.z_amd64.deb`      | ~5 MB  |
| Linux (any distro)              | `Musicfree_x.y.z_amd64.AppImage` | ~80 MB |

The AppImage is larger because it bundles WebKit; the other installers use the system webview. To update, install the new version over the old one: your library and settings are kept.

The installers are **not code-signed** (certificates cost money), so the first launch needs one extra click:

- **Windows**: SmartScreen shows "Windows protected your PC" → **More info** → **Run anyway**.
- **macOS**: right-click the app → **Open** → **Open**. If macOS says the app is damaged, run `xattr -cr /Applications/Musicfree.app`.
- **Linux (AppImage)**: `chmod +x Musicfree_*.AppImage` and run it.

## Architecture

```mermaid
flowchart LR
  subgraph Webview["Webview (React + TypeScript)"]
    UI[Screens] --> Q[TanStack Query]
    Q --> MS{{MusicSource}}
    MS --> YT[YouTubeMusicSource<br/>youtubei.js]
    MS --> MK[MockMusicSource<br/>demo data]
    UI --> PS[PlayerStore<br/>Zustand] --> AU["&lt;audio&gt;"]
    UI --> LR[LibraryRepo]
  end
    YT --> PO[PO tokens<br/>BotGuard]
    UI --> RC[Recommendations<br/>local taste profile]
  end
  subgraph Rust["Rust (Tauri 2)"]
    HTTP[HTTP plugin<br/>no CORS]
    PX[mf-stream proxy<br/>Range + re-resolve]
    DB[(SQLite)]
  end
  YT --> HTTP --> InnerTube[(YouTube Music)]
  AU -- mf-stream://id --> PX --> GV[(googlevideo)]
  LR --> DB
  RC --> DB
```

- **`MusicSource`** is the only door to YouTube Music. Nothing from `youtubei.js` leaks outside `src/sources/youtube/`, so when YouTube changes something, the fix lives in one folder. A mock source with fictional data powers development, tests and these screenshots.
- **Playable streams**: for each track the app asks several YouTube clients for an audio URL and keeps the first one the media server really serves, checked past the first MiB, which is where unverified streams get cut off. To pass YouTube's bot checks it runs BotGuard, the same attestation script youtube.com runs, inside the webview via [bgutils-js](https://github.com/LuanRT/BgUtils), and attaches the resulting proof-of-origin (PO) tokens. API requests leave the app with the `Origin` and `User-Agent` a browser would send.
- **Stream proxy (Rust)**: the `<audio>` element loads `mf-stream://<videoId>`. The proxy forwards `Range` requests in 1 MiB chunks with the right client headers, tries every network route (and remembers the one that works), and when a URL expires or is rejected it asks the front end for a fresh one **once** before skipping the track.
- **Recommendations** come from a listening profile stored in the local database: finished tracks and likes raise a track's score, early skips lower it, and old listens fade with a 30-day half-life. The strongest tracks seed YouTube Music radios, which feed the personal Home shelves and the endless queue.
- **Library** lives in SQLite (`tauri-plugin-sql`). The same contract test suite runs against the SQLite repo (via sql.js) and the in-memory repo.
- **Lyrics** come from [LRCLIB](https://lrclib.net) (free, no key) and are cached locally.

## Tech stack

| Layer          | Tools                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| Desktop shell  | Tauri 2 (Rust), system webview                                                               |
| UI             | React 19, TypeScript, Vite, CSS Modules, Tabler Icons                                        |
| State and data | Zustand, TanStack Query                                                                      |
| YouTube Music  | [YouTube.js](https://github.com/LuanRT/YouTube.js) (InnerTube client)                        |
| Bot checks     | [bgutils-js](https://github.com/LuanRT/BgUtils) (BotGuard / PO tokens)                       |
| Storage        | SQLite via tauri-plugin-sql                                                                  |
| Tests          | Vitest, Testing Library, Playwright, cargo test + httpmock                                   |
| CI/CD          | GitHub Actions: lint, tests, e2e, live API smoke test, cross-platform installers, Dependabot |

## Run from source

Requirements: Node 22+, pnpm 10+, Rust (stable) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
git clone https://github.com/chrystianschmith/Musicfree.git
cd Musicfree
pnpm install

pnpm tauri dev      # desktop app with real YouTube Music
pnpm dev            # browser-only UI with demo data (http://localhost:1420)
pnpm tauri build    # build the installer for your OS
```

| Command                      | What it does                                                   |
| ---------------------------- | -------------------------------------------------------------- |
| `pnpm test`                  | Unit tests (player, library, mappers, lyrics, recommendations) |
| `pnpm e2e`                   | Playwright end-to-end tests against the demo build             |
| `pnpm smoke`                 | Live test against the real YouTube Music API                   |
| `pnpm lint`                  | ESLint and Prettier                                            |
| `pnpm screenshots`           | Regenerates the images in `docs/screenshots`                   |
| `cd src-tauri && cargo test` | Rust proxy tests                                               |

### Releasing

The **Release** workflow builds the Windows, macOS and Linux installers on GitHub Actions and publishes them as the latest release. It runs when you:

- push to the `release` branch (`git push origin main:release`), tagging it with the version in `package.json`;
- push a tag such as `v0.3.0`;
- or start it from the Actions tab and type the version.

Bump the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` first.

## Project layout

```
src/
  app/          layout, sidebar, shortcuts, session restore, ambient colour
  features/     home, search, artist, collection, library, nowplaying, queue, player, recs
  sources/      MusicSource interface, youtube/ (youtubei.js, PO tokens), mock/ (demo data)
  db/           LibraryRepo, SQLite + memory implementations, migrations
  lib/          taste profile, lyrics (LRCLIB), LRC parser, colour, HTTP and stream helpers
src-tauri/      Rust: stream proxy, plugins, commands
smoke/          live tests against the real YouTube API
e2e/            Playwright tests and screenshot generator
docs/           design spec, implementation plan, screenshots
```

## Troubleshooting

**A track doesn't play, stops after about a minute, or the app skips to the next one.** YouTube changes its bot checks often, and playback depends on getting past them. The app writes what happened with each track to a log file:

| System  | Log folder                                           |
| ------- | ---------------------------------------------------- |
| Windows | `%LOCALAPPDATA%\dev.chrystianschmith.musicfree\logs` |
| macOS   | `~/Library/Logs/dev.chrystianschmith.musicfree`      |
| Linux   | `~/.local/share/dev.chrystianschmith.musicfree/logs` |

Lines starting with `[stream]` and `[potoken]` show which YouTube client was tried and how the media server answered. Please attach that part of the log when you [open an issue](https://github.com/chrystianschmith/Musicfree/issues).

**Home or search is empty.** Check your internet connection. Corporate proxies and antivirus software that inspect HTTPS traffic can block YouTube's API.

**Your library is stored only on your computer**, in `musicfree.db`: `%APPDATA%\dev.chrystianschmith.musicfree` on Windows, `~/Library/Application Support/dev.chrystianschmith.musicfree` on macOS and `~/.config/dev.chrystianschmith.musicfree` on Linux. Uninstalling keeps it unless you choose to delete the app data.

## Disclaimer

Musicfree is an unofficial, personal and educational project. It is not affiliated with, endorsed by, or connected to YouTube or Google. It talks to YouTube's internal (InnerTube) API, which YouTube's Terms of Service do not allow for third-party apps, so use it at your own risk, for personal use only. It is not meant to be published on app stores or monetized. All music belongs to its respective owners.

## License

[MIT](LICENSE) © 2026 Chrystian Schmith
