# Musicfree v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop music player (Tauri 2 + React) que toca YouTube Music com UX estilo Spotify e gera instaladores para Windows/Linux/macOS via GitHub Actions.

**Architecture:** UI React fala só com a interface `MusicSource` (YouTube real ou Mock) e com `LibraryRepo` (SQLite no Tauri, memória no navegador). O áudio toca num `<audio>` alimentado pelo protocolo `mf-stream://` do Rust, que faz proxy com Range e re-resolve URLs expiradas. Build web com Mock roda no Playwright para testes e capturas.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Vite, Zustand, TanStack Query, youtubei.js, tauri-plugin-http/sql/log, Vitest, Playwright, Tabler Icons.

**Spec:** `docs/superpowers/specs/2026-11-09-musicfree-design.md`

## Global Constraints

- Fundo único `#111114`; destaque `#9F97F0`; texto `#ECEBF5`; secundário `#7E7D8C`; trilha `#2C2B33`. Sem caixas/cards/bordas/pílulas.
- Controles só ícones (Tabler outline), sem fundo/contorno; cinza → branco hover → violeta ativo.
- Nenhum tipo do youtubei.js fora de `src/sources/youtube/`.
- Nada abre navegador/janela externa.
- Formato de stream preferido AAC/M4A (itag 140), fallback Opus.
- Re-resolve de stream: no máximo 1 vez por falha; depois pula faixa + aviso "Não foi possível tocar {título}".
- Pré-resolve da próxima faixa aos 75% da atual.
- Histórico limitado a 5.000 entradas.
- Licença MIT; README com aviso de termos de uso do YouTube.
- Texto de UI em pt-BR, sentence case.

## Review Focus

- Faixa sem duração/miniatura (ex.: vídeo enviado por usuário) → UI mostra "—" e ícone padrão, sem quebrar. Teste em `mappers.test.ts`.
- Fila vazia + "próxima"/"anterior"/atalho espaço → nada acontece, sem erro. Teste em `player.test.ts`.
- "Anterior" após >3 s de reprodução → volta ao início da faixa atual (comportamento Spotify). Teste em `player.test.ts`.
- Aleatório ligado/desligado no meio da fila → faixa atual permanece; ordem original restaurada ao desligar. Teste em `player.test.ts`.
- LRC com timestamps fora de ordem, linhas vazias e tags `[ar:]`/`[length:]` → ignora metadados, ordena por tempo. Teste em `lrc.test.ts`.

---

### Task 1: Scaffold, tokens, tooling

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/styles/tokens.css`, `src/styles/globals.css`, `src-tauri/**` (via `create-tauri-app` template react-ts), `.gitignore`, `LICENSE` (MIT, Chrystian Schmith), `eslint.config.js`, `.prettierrc`, `src/lib/platform.ts`.

**Interfaces — Produces:** `isTauri(): boolean` (checa `__TAURI_INTERNALS__`); CSS vars `--bg --accent --text --text-2 --track`.

- [ ] Scaffold Tauri 2 react-ts; app id `dev.chrystianschmith.musicfree`, productName `Musicfree`, janela 1280×800, min 960×600, `decorations: true`.
- [ ] Adicionar deps (zustand, @tanstack/react-query, react-router-dom, @tabler/icons-react, youtubei.js, @tauri-apps/plugin-http, -sql, -log) e dev (vitest, @testing-library/react, jsdom, @playwright/test, eslint, prettier).
- [ ] Scripts: `dev`, `build`, `test` (vitest run), `e2e`, `lint`, `tauri`.
- [ ] Verificar: `pnpm build` e `cargo check --manifest-path src-tauri/Cargo.toml` passam.
- [ ] Commit `chore: scaffold tauri + react app`.

### Task 2: Domínio + MusicSource + Mock

**Files:** Create `src/sources/types.ts`, `src/sources/mock/fixtures.ts`, `src/sources/mock/MockMusicSource.ts`, `src/sources/index.ts`; Test `src/sources/mock/MockMusicSource.test.ts`.

**Interfaces — Produces:**

```ts
type Thumb = { url: string; w: number; h: number }
type ArtistRef = { id?: string; name: string }
type Track = { id: string; title: string; artists: ArtistRef[]; album?: { id?: string; title: string }; durationMs?: number; thumbs: Thumb[]; explicit?: boolean }
type Album = { id: string; title: string; artists: ArtistRef[]; year?: string; thumbs: Thumb[]; tracks: Track[] }
type Artist = { id: string; name: string; thumbs: Thumb[]; topTracks: Track[]; albums: Album[]; singles: Album[]; related: Artist[] }
type Playlist = { id: string; title: string; author?: string; thumbs: Thumb[]; tracks: Track[] }
type ShelfItem = { kind: 'track'; track: Track } | { kind: 'album'; album: Album } | { kind: 'playlist'; playlist: Playlist } | { kind: 'artist'; artist: Artist }
type Shelf = { title: string; items: ShelfItem[] }
type SearchFilter = 'all' | 'songs' | 'albums' | 'artists' | 'playlists'
type SearchResult = { top?: ShelfItem; songs: Track[]; albums: Album[]; artists: Artist[]; playlists: Playlist[] }
type StreamInfo = { url: string; mime: string; expiresAt: number }
interface MusicSource {
  home(mood?: string): Promise<{ moods: string[]; shelves: Shelf[] }>
  search(q: string, filter?: SearchFilter): Promise<SearchResult>
  suggestions(q: string): Promise<string[]>
  artist(id: string): Promise<Artist>; album(id: string): Promise<Album>; playlist(id: string): Promise<Playlist>
  radio(videoId: string): Promise<Track[]>; related(videoId: string): Promise<Track[]>
  explore(): Promise<Shelf[]>
  resolveStream(videoId: string): Promise<StreamInfo>
}
getSource(): MusicSource  // Mock no navegador ou se VITE_SOURCE=mock; YouTube no Tauri
```

- [ ] Teste: `search('noite')` retorna `songs.length > 0`; `home()` retorna ≥3 shelves e moods incluindo `'Relax'`; `artist(id)` do fixture tem `topTracks` ≥5.
- [ ] Implementar fixtures (≥8 artistas fictícios, ≥30 faixas, capas = data-URI SVG gerado por cor) e Mock com latência 150 ms.
- [ ] `pnpm test` PASS; commit `feat: domain model and mock source`.

### Task 3: PlayerStore

**Files:** Create `src/store/player.ts`; Test `src/store/player.test.ts`.

**Interfaces — Produces:**

```ts
type Repeat = 'off' | 'all' | 'one'
usePlayer: { queue: Track[]; order: number[]; index: number; shuffle: boolean; repeat: Repeat; playing: boolean; volume: number; muted: boolean; position: number; duration: number;
  playTracks(tracks: Track[], start?: number): void; playNext(t: Track): void; addToQueue(t: Track): void; removeAt(orderPos: number): void; move(from: number, to: number): void;
  next(): void; prev(): void; toggle(): void; setShuffle(v: boolean): void; cycleRepeat(): void; seek(sec: number): void; setVolume(v: number): void; current(): Track | undefined; upcoming(): Track[] }
```

- [ ] Testes: next/prev em fila vazia não lança; repeat `one` mantém índice no `next()` automático (`onEnded`); repeat `all` volta ao 0; prev com position>3 → seek(0); shuffle mantém atual em `order[index]` e desligar restaura ordem original; `playNext` insere logo após atual.
- [ ] Implementar (store puro, sem DOM; `onEnded()` separado de `next()`).
- [ ] PASS; commit `feat: player store`.

### Task 4: Shell (layout, logo, player bar, áudio)

**Files:** Create `src/app/App.tsx`, `src/app/Layout.tsx`, `src/app/Sidebar.tsx`, `src/app/Logo.tsx`, `src/features/player/PlayerBar.tsx`, `src/features/player/AudioEngine.tsx`, `src/features/player/ProgressBar.tsx`, `src/components/IconButton.tsx`, `src/components/Cover.tsx`, `src/lib/format.ts` (+ test).

**Interfaces — Produces:** `IconButton({icon, label, active?, size?, onClick})`; `Cover({thumbs, size, radius?})` (escolhe thumb ≥ size, fallback ícone); `formatTime(sec): string` ("1:05", "—" se inválido); `streamUrl(id): string` (`mf-stream://localhost/{id}` no Tauri, URL de `resolveStream` no navegador); `AudioEngine` sincroniza `usePlayer` ↔ `<audio>` e Media Session API (metadados, play/pause/next/prev).

- [ ] Teste `formatTime(65)`→`"1:05"`, `formatTime(NaN)`→`"—"`.
- [ ] Layout 3 colunas (sidebar 220px, main flex, painel direito 280px recolhível) + player bar 88px, conforme mockup v3; logo SVG (ponto + haste curva).
- [ ] Verificar visual: `pnpm dev` + screenshot Playwright `docs/screenshots/shell.png`.
- [ ] Commit `feat: app shell and player bar`.

### Task 5: Início e Explorar

**Files:** Create `src/features/home/HomePage.tsx`, `src/features/home/QuickPicks.tsx`, `src/features/shelf/ShelfRow.tsx`, `src/features/shelf/ShelfItemView.tsx`, `src/features/explore/ExplorePage.tsx`.

- [ ] Saudação por hora (`Bom dia` <12h, `Boa tarde` <18h, `Boa noite`), abas de mood com sublinhado, quick picks ícone+texto, shelves horizontais; clique em faixa = `playTracks(shelfTracks, i)`; álbum/playlist/artista navegam.
- [ ] Estados: skeleton suave, erro "Esta seção não carregou" + "Tentar de novo".
- [ ] Screenshot `docs/screenshots/home.png`; commit `feat: home and explore`.

### Task 6: Buscar

**Files:** Create `src/features/search/SearchPage.tsx`, `src/features/search/SearchBox.tsx`, `src/features/tracks/TrackList.tsx`.

**Interfaces — Produces:** `TrackList({tracks, onPlay(i), showAlbum?, numbered?})` (linha: nº/▶ hover, capa, título, artista, álbum, duração, coração; botão direito → menu de contexto da Task 9).

- [ ] Sugestões com debounce 200 ms; abas Tudo/Músicas/Álbuns/Artistas/Playlists; recentes (últimas 10) em `settings`.
- [ ] Atalho Ctrl+K ou `/` foca busca. Screenshot `search.png`; commit `feat: search`.

### Task 7: Artista, álbum, playlist

**Files:** Create `src/features/artist/ArtistPage.tsx`, `src/features/collection/CollectionPage.tsx` (álbum e playlist remota/local).

- [ ] Cabeçalho (capa grande, título, meta), ações ícone: tocar, aleatório, salvar/curtir, iniciar rádio; artista: populares (5, "mostrar mais" → 10), álbuns, singles, relacionados.
- [ ] Screenshots `artist.png`, `album.png`; commit `feat: artist and collection pages`.

### Task 8: Biblioteca (LibraryRepo)

**Files:** Create `src/db/LibraryRepo.ts` (interface), `src/db/memoryRepo.ts`, `src/db/sqliteRepo.ts`, `src/db/migrations.ts`, `src/db/index.ts`, `src/features/library/*`; Test `src/db/memoryRepo.test.ts`; Modify `src-tauri/src/lib.rs` (plugin sql), `src-tauri/capabilities/default.json`.

**Interfaces — Produces:**

```ts
interface LibraryRepo {
  isLiked(id): Promise<boolean>; toggleLike(t: Track): Promise<boolean>; liked(): Promise<Track[]>
  playlists(): Promise<{id:string;name:string;count:number}[]>; createPlaylist(name: string): Promise<string>; renamePlaylist(id, name); deletePlaylist(id)
  playlistTracks(id): Promise<Track[]>; addToPlaylist(id, t: Track); removeFromPlaylist(id, pos: number); movePlaylistTrack(id, from, to)
  saveAlbum(a)/unsaveAlbum(id)/savedAlbums(); saveArtist(a)/unsaveArtist(id)/savedArtists()
  pushHistory(t: Track): Promise<void>; history(limit?: number): Promise<Track[]>
  getSetting<T>(k: string): Promise<T | undefined>; setSetting(k: string, v: unknown): Promise<void>
}
useLibrary() // hooks TanStack Query com invalidação
```

- [ ] Testes (memoryRepo, mesma suíte reutilizável p/ sqlite): toggleLike idempotente, ordem de playlist após move, histórico corta em 5.000.
- [ ] SQLite com schema da spec §3; sidebar lista playlists reais; "Nova playlist" cria "Minha playlist nº N".
- [ ] PASS; commit `feat: local library`.

### Task 9: Tocando agora, letras, fila, menu de contexto, atalhos

**Files:** Create `src/lib/lrc.ts` (+ test), `src/lib/lyrics.ts`, `src/features/nowplaying/NowPlaying.tsx`, `src/features/nowplaying/Lyrics.tsx`, `src/features/nowplaying/RightPanel.tsx`, `src/features/queue/QueueView.tsx`, `src/components/ContextMenu.tsx`, `src/app/shortcuts.ts`.

**Interfaces — Produces:** `parseLrc(text): {t: number; line: string}[]` (ordenado, ignora metadados); `activeLine(lines, sec): number`; `fetchLyrics(t: Track): Promise<{synced?: Line[]; plain?: string} | null>` (LRCLIB `/api/get?track_name&artist_name&duration`, fallback `/api/search`, cache em settings/lyrics_cache).

- [ ] Testes lrc (inclui Review Focus) e `activeLine`.
- [ ] Overlay sobe 350 ms `cubic-bezier(.2,.8,.2,1)`, respeita `prefers-reduced-motion`; clicar verso → seek; abas Letra/A seguir/Relacionadas.
- [ ] Atalhos: espaço, Ctrl+→/←, Ctrl+↑/↓, Ctrl+L, Ctrl+K, `/`, Esc fecha overlay. Retomada da fila (pausado) via settings `lastSession`.
- [ ] Screenshot `nowplaying.png`; commit `feat: now playing, lyrics, queue, shortcuts`.

### Task 10: YouTubeMusicSource

**Files:** Create `src/sources/youtube/client.ts`, `src/sources/youtube/mappers.ts`, `src/sources/youtube/YouTubeMusicSource.ts`; Test `src/sources/youtube/mappers.test.ts` com fixtures JSON reduzidas em `src/sources/youtube/__fixtures__/`.

**Interfaces — Consumes:** `MusicSource` (Task 2). **Produces:** `createInnertube()` usando `Innertube.create({ fetch: tauriFetch, generate_session_locally: true, retrieve_player: true })` e evaluator JS embutido para deciphering.

- [ ] Mapeadores youtubei.js → domínio; teste com faixa sem duração/miniatura (Review Focus) → `durationMs` undefined, `thumbs` [].
- [ ] `resolveStream`: `music.getInfo(id)` → `chooseFormat({type:'audio', quality:'best', format:'mp4'})` → `decipher`; fallback `webm`; `expiresAt` do parâmetro `expire`.
- [ ] Erros de parse viram `SourceError('parse')`; rede → `SourceError('network')`.
- [ ] PASS; commit `feat: youtube music source`.

### Task 11: Stream proxy (Rust)

**Files:** Create `src-tauri/src/stream.rs`; Modify `src-tauri/src/lib.rs`; Test inline `#[cfg(test)]` em `stream.rs`.

**Interfaces — Produces:** protocolo assíncrono `mf-stream` (`register_asynchronous_uri_scheme_protocol`); comando `stream_set_url(video_id, url, expires_at)`; evento `stream:need-url {videoId}` emitido ao front quando não há URL válida (front responde com `stream_set_url`); `parse_range(h: &str) -> Option<(u64, Option<u64>)>`.

- [ ] Testes: `parse_range("bytes=0-")`, `"bytes=100-199"`, inválido → None; proxy contra servidor mock (`httpmock`): 206 repassado com `Content-Range`; 403 → pede URL nova uma vez e repete; segunda 403 → 502.
- [ ] Headers para googlevideo: `User-Agent` do cliente usado, `Range` repassado; streaming em chunks (sem bufferizar a faixa inteira).
- [ ] `cargo test` PASS; commit `feat: rust stream proxy`.

### Task 12: E2E, CI/CD, README

**Files:** Create `e2e/app.spec.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`, `README.md`, `CONTRIBUTING.md`, `src-tauri/icons/*` (gerados do logo via `tauri icon`).

- [ ] E2E (build web + Mock): buscar "noite" → tocar 1º resultado → player mostra título → abrir Tocando agora → curtir → aparece em Curtidas → criar playlist. Gera capturas em `docs/screenshots/`.
- [ ] `ci.yml`: pnpm install, lint, test, build, e2e, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` (ubuntu com deps webkit).
- [ ] `release.yml`: on tag `v*`, matriz windows-latest / ubuntu-22.04 / macos-latest (`--target universal-apple-darwin`), `tauri-apps/tauri-action@v0`, `releaseDraft: false`, `prerelease: true` para `v0.*`.
- [ ] README (inglês, apresentável): logo, capturas, features, download (Releases), avisos SmartScreen/Gatekeeper, build local, arquitetura (diagrama), stack, disclaimer YouTube, licença.
- [ ] Commit `ci: pipelines and docs`; push; verificar CI verde.

### Task 13: Release v0.1.0

- [ ] Bump versão 0.1.0 em `package.json` e `tauri.conf.json`; tag `v0.1.0`; push; acompanhar `release.yml` até os 3 instaladores aparecerem no Release.
- [ ] Verificação final: review do branch inteiro por revisor fresco.

## Deviation from spec

- Controles de mídia do SO: usar **Media Session API** do webview (Task 4) em vez de `souvlaki`; reavaliar se o WebKitGTK não expuser MPRIS.
