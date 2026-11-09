# Musicfree — design (v1)

Data: 2026-11-09 · Status: aguardando revisão

## 1. Objetivo

Player de música para desktop, de uso pessoal e projeto de portfólio no GitHub. A experiência é inspirada no Spotify, a fonte das músicas é o YouTube Music e o produto entregue é um **instalador** para Windows, Linux e macOS.

### Critérios de sucesso

1. Instalar pelo instalador da aba Releases e, sem configurar nada, buscar uma música e ouvi-la em até ~3 s após o clique.
2. Todas as telas da seção 4 funcionando com dados reais do YouTube Music.
3. Tudo roda dentro do app: nenhum navegador ou janela externa é aberto para tocar, buscar ou mostrar a letra.
4. Pipeline do GitHub Actions gera e publica os três instaladores a partir de uma tag `v*`.
5. App leve: instalador de ~10–20 MB e consumo de RAM baixo em uso normal.

### O que o usuário pediu × o que é premissa

- **Pedido:** só YouTube Music; funções parecidas com as do Spotify (home com recomendações, biblioteca, playlists); stack escolhida pelo critério de app mais rápido; instaladores para os três sistemas; design fluido sem caixas; logo minimalista próprio; "Tocando agora" dentro do app.
- **Premissas:** sem login no YouTube na v1 (a biblioteca fica salva localmente); código escrito do zero, com o SimpMusic apenas como referência; licença MIT.

## 2. Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Shell desktop | **Tauri 2** (Rust) | Usa o webview nativo do sistema; instalador pequeno e pouca RAM |
| UI | **React 19 + TypeScript + Vite** | Ecossistema maduro e build rápido |
| Estilo | CSS Modules + variáveis CSS (tokens) | Controle fino do visual; sem dependência pesada |
| Estado | Zustand (player, fila, UI) + TanStack Query (dados remotos com cache) | Simples e com cache automático |
| YouTube Music | **YouTube.js (`youtubei.js`)**, MIT, mantido ativamente | Cliente InnerTube mais completo e atualizado |
| HTTP | `tauri-plugin-http` | Requisições saem pelo Rust, sem bloqueio de CORS |
| Banco local | SQLite via `tauri-plugin-sql` | Biblioteca, playlists, histórico e configurações |
| Letras | LRCLIB (API pública, sem chave) | Letras sincronizadas (LRC) |
| Controles de mídia do SO | crate `souvlaki` | Teclas de mídia, painel de mídia do Windows/macOS e MPRIS no Linux |

## 3. Arquitetura

```
┌──────────────────────────── Webview (React) ─────────────────────────────┐
│ Telas ── hooks (TanStack Query) ── MusicSource (interface)               │
│   │                                   ├─ YouTubeMusicSource (youtubei.js)│
│   │                                   └─ MockMusicSource (fixtures)      │
│   ├─ PlayerStore (Zustand) ── <audio> ◄── mf-stream://{videoId}          │
│   └─ LibraryRepo ── SQLite                                               │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ IPC / custom protocol
┌──────────────────────────── Rust (Tauri) ────────────────────────────────┐
│ http plugin (fetch InnerTube) · stream proxy (Range, re-resolve)         │
│ sql plugin · media controls (souvlaki) · janela/estado                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Unidades e responsabilidades

- **`MusicSource`** (`src/sources/`): interface única para tudo o que vem do YouTube Music. Funções: `home()`, `search(q, filtro)`, `suggestions(q)`, `artist(id)`, `album(id)`, `playlist(id)`, `radio(videoId)`, `upNext(videoId)`, `resolveStream(videoId)` (retorna URL, mime, expiração), `related(videoId)`. Os modelos de domínio são próprios (`Track`, `Album`, `Artist`, `Playlist`, `Shelf`); nenhum tipo do youtubei.js vaza para fora de `sources/`. Quando o YouTube mudar algo, o conserto fica todo neste diretório.
- **`MockMusicSource`**: fixtures estáticas, usadas no desenvolvimento, nos testes e nas capturas de tela.
- **Stream proxy (Rust)**: protocolo customizado `mf-stream://{videoId}`, que o `<audio>` consome como uma URL qualquer.
  - Na primeira requisição, pede a URL ao front (`resolveStream`) e guarda em cache com a expiração.
  - Repassa o cabeçalho `Range` para o googlevideo, o que permite pular para qualquer ponto da música.
  - Se receber 403 ou a URL expirar, resolve de novo **uma vez** e repete a requisição.
  - Formato preferido: AAC/M4A (itag 140), que funciona nos webviews dos três sistemas. Opus/WebM fica como alternativa onde houver suporte.
- **`PlayerStore`**: guarda a fila (ordem original e ordem embaralhada), o índice atual, aleatório, repetir (desligado/todas/uma), volume e posição. Controla o elemento `<audio>` e pré-resolve a próxima música aos 75% da atual, para não haver espera na troca.
- **`LibraryRepo`**: CRUD no SQLite. É a única camada que fala com o banco.
- **`LyricsService`**: busca no LRCLIB por título, artista e duração; faz o parse do LRC e guarda em cache no SQLite.

### Modelo de dados (SQLite)

- `tracks(id PK, title, artists_json, album_id, album_title, duration_ms, thumb_url, explicit)`: cache de metadados.
- `liked_tracks(track_id PK, liked_at)`
- `playlists(id PK, name, description, created_at, updated_at)` e `playlist_tracks(playlist_id, track_id, position)`
- `saved_albums(album_id PK, title, artist, thumb_url, saved_at)` e `saved_artists(artist_id PK, name, thumb_url, saved_at)`
- `history(id PK, track_id, played_at)`: limitado às últimas 5.000 entradas.
- `lyrics_cache(track_id PK, lrc, plain, fetched_at)`
- `settings(key PK, value)`: volume, última fila e posição, preferências.

## 4. Telas e funções (v1)

1. **Início:** saudação conforme o horário, atalhos rápidos (curtidas, rádios, playlists recentes), filtros por clima (Tudo, Relax, Animado, Foco…) e as prateleiras de recomendação do YouTube Music ("Feito para você", lançamentos etc.).
2. **Buscar:** campo com sugestões enquanto você digita, resultado principal em destaque e abas para músicas, álbuns, artistas e playlists. Guarda as buscas recentes.
3. **Explorar:** gêneros e climas, paradas e lançamentos.
4. **Artista:** cabeçalho com foto, botões tocar, aleatório e salvar, mais populares, álbuns, singles e artistas parecidos.
5. **Álbum e playlist:** cabeçalho, tocar/aleatório, lista de faixas e "salvar na biblioteca".
6. **Biblioteca (barra lateral):** curtidas, suas playlists (criar, renomear, excluir, adicionar e remover faixas, reordenar arrastando), álbuns e artistas salvos e histórico.
7. **Painel lateral direito:** capa, título, artista, letra sincronizada compacta e "a seguir". Pode ser fechado.
8. **Tocando agora (dentro do app):** sobe por cima do conteúdo ao clicar na música atual, na capa ou no ícone de letra. Mostra a capa grande e as abas Letra, A seguir e Relacionadas. A seta fecha. Dá para clicar num verso da letra para pular até aquele trecho.
9. **Player fixo embaixo:** capa, título e artista (clicar abre o Tocando agora), curtir, aleatório, anterior, play/pause, próxima, repetir, barra de progresso arrastável, letra, fila, volume e mudo.
10. **Fila:** a atual, a seguir (arrastar para reordenar, remover) e "tocar a seguir" ou "adicionar à fila" no menu de contexto de qualquer faixa.
11. **Rádio:** "Iniciar rádio" em qualquer faixa ou artista, usando o `radio` do YouTube Music.
12. **Menu de contexto (botão direito) nas faixas:** tocar a seguir, adicionar à fila, adicionar à playlist, curtir, ir para o artista, ir para o álbum, iniciar rádio.
13. **Atalhos de teclado:** espaço (play/pause), Ctrl+→/← (próxima/anterior), Ctrl+↑/↓ (volume), Ctrl+L (letra), Ctrl+K ou / (busca). Também funcionam as teclas de mídia do teclado e os controles de mídia do sistema.
14. **Retomada:** ao abrir, o app restaura a última fila e a posição, pausado.

**Fora da v1:** login no YouTube e importação da conta, downloads offline, equalizador, crossfade, Discord, Last.fm, vídeo e mini-player.

## 5. Design visual

- **Princípio:** fluido e minimalista. Fundo único `#111114` em todo o app, **sem caixas, cards, bordas ou pílulas**. A hierarquia vem só de tipografia, cor e espaço.
- **Cor de destaque:** violeta `#9F97F0`, usado no estado ativo, no progresso e nos ícones ativos. Texto `#ECEBF5`, texto secundário `#7E7D8C`, trilhas `#2C2B33`.
- **Controles:** apenas ícones (Tabler Icons outline), sem fundo nem contorno. Cinza em repouso, branco no hover e violeta quando ativo. O play/pause é um ícone grande solto.
- **Navegação:** o item ativo fica com o texto em branco. Abas e filtros usam um sublinhado fino violeta.
- **Capas:** cantos arredondados de 10 px, sem moldura. Sobem 2 px no hover.
- **Letra:** versos soltos. A linha atual fica branca e maior, as já cantadas mais apagadas, com rolagem suave.
- **Movimento:** o Tocando agora sobe em 350 ms com `cubic-bezier(.2,.8,.2,1)`. Toda animação respeita `prefers-reduced-motion`.
- **Logo:** nota minimalista, formada por um ponto violeta (a cabeça) e uma haste que termina num traço curvo, entre a bandeirola e uma onda sonora. Ao lado, o nome "musicfree" em minúsculas. Versão SVG para o ícone do app.
- **Referência:** mockup v3 aprovado na conversa de 2026-11-09.

## 6. Tratamento de erros

| Situação | Comportamento |
|---|---|
| Falha ao resolver o stream ou 403 | Tenta resolver de novo uma vez. Se falhar, pula para a próxima e mostra o aviso "Não foi possível tocar X" |
| YouTube mudou a resposta (falha de parse) | O erro é capturado em `sources/`. A tela mostra "Esta seção não carregou" com o botão "Tentar de novo"; o resto do app segue funcionando |
| Sem internet | Faixa discreta "Sem conexão". Biblioteca e playlists continuam navegáveis (os metadados estão em cache) |
| Letra não encontrada | Mostra "Letra indisponível para esta música" |
| Banco corrompido ou migração falhou | Faz backup do arquivo, recria o banco e avisa |

Todos os erros são registrados em um log local (`tauri-plugin-log`), que pode ser acessado em Configurações → "Abrir pasta de logs".

## 7. Testes

- **Unitários (Vitest):** PlayerStore (fila, aleatório, repetir, anterior/próxima), parse de LRC, mapeadores do youtubei.js para o domínio (com fixtures JSON salvas) e LibraryRepo (SQLite em memória).
- **Rust (`cargo test`):** parse e repasse do `Range` e lógica de re-resolve do proxy, com servidor HTTP mock.
- **UI (Playwright no build web com `MockMusicSource`):** fluxos principais (buscar → tocar → abrir Tocando agora → curtir → criar playlist) e geração das capturas de tela do README.
- **Smoke real (CI, opcional, permitido falhar):** uma busca e uma resolução de stream contra o YouTube real, para detectar quebras cedo.

## 8. CI/CD (GitHub Actions)

- `ci.yml` (a cada push e PR): lint (ESLint e `cargo clippy`), formatação (Prettier e `cargo fmt --check`), testes, build web e Playwright.
- `release.yml` (tag `v*`): matriz windows-latest, ubuntu-22.04 e macos-latest (universal), com `tauri-apps/tauri-action`. Gera NSIS `.exe` (Windows), `.AppImage` e `.deb` (Linux) e `.dmg` (macOS), e publica um GitHub Release com changelog.
- Dependabot para npm, cargo e actions.
- Os instaladores **não são assinados** na v1. O README explica o aviso do SmartScreen e do Gatekeeper.

## 9. Estrutura do repositório

```
musicfree/
├─ src/                 # React
│  ├─ app/              # layout, rotas, atalhos
│  ├─ features/         # home, search, artist, album, playlist, library, nowplaying, queue, player
│  ├─ sources/          # MusicSource + YouTube + Mock
│  ├─ store/            # Zustand
│  ├─ db/               # LibraryRepo + migrações
│  ├─ lib/              # lyrics, format, hooks utilitários
│  └─ styles/           # tokens.css, globals
├─ src-tauri/           # Rust: proxy de stream, comandos, plugins
├─ e2e/                 # Playwright
├─ docs/                # specs, planos, capturas
└─ .github/workflows/   # ci.yml, release.yml
```

## 10. Riscos e limitações

- **Termos de uso:** o acesso via InnerTube viola os termos do YouTube. O projeto é para uso pessoal e estudo, e o README traz um aviso. Não publicar em lojas nem monetizar.
- **Quebras do YouTube:** mudanças na cifra ou exigências de PoToken podem quebrar a reprodução. A mitigação é isolar tudo em `sources/`, manter o youtubei.js atualizado (Dependabot) e rodar o smoke test no CI. O plano B é um sidecar com yt-dlp.
- **Ambiente de desenvolvimento:** o sandbox onde o app é construído não acessa o YouTube. O desenvolvimento e as capturas usam o `MockMusicSource`, e a validação com dados reais acontece na máquina do usuário e no smoke test do CI.
- **macOS e Linux:** os codecs do webview variam. A preferência por AAC/M4A reduz esse risco.
