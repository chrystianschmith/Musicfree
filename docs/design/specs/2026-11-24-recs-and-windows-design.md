# Recommendations by style + Windows polish (0.3.0)

Approved in chat on 2026-11-24.

## Problem

"Seu mix de hoje" and "Porque você ouviu X" are built from YouTube's automix radio, unfiltered.
When the seed is not an official album track the radio returns covers, live versions and
re-uploads of the same song by other channels: "the same songs by different artists".

## Recommendations

YouTube Music exposes no per-track genre, so style is inferred from the artist neighbourhood
(YouTube's "fans also like" artists) and the song's "Related" tab.

Candidate buckets for a seed track, in priority order:

1. **album** — other tracks of the seed's album.
2. **artist** — the seed artist's top tracks.
3. **similar** — top tracks of 2–3 related artists (the style).
4. **related** — the song's Related tab.
5. **radio** — only when everything above yields too little.

Filters:

- Title key: lowercase, accents stripped, parenthesised/bracketed parts and suffixes after
  " - " removed, "feat./ft." removed, punctuation collapsed. A candidate whose key matches a
  seed, a heard track or an earlier candidate is dropped.
- Alternate versions dropped: cover, karaoke, lyrics/letra, slowed, sped up, reverb,
  8d, nightcore, instrumental, "tribute", "in the style of".
- Tracks without any artist are dropped.

Mixing: round-robin across buckets with weights album 2, artist 2, similar 4, related 2;
never more than 2 consecutive tracks by the same main artist, at most 3 per artist per list.

Applies to "Seu mix de hoje", "Porque você ouviu X" and the endless queue.
Artist/album lookups are cached for the session.

## Windows

- Native title bar kept (Snap Layouts), dark theme; Mica backdrop on Windows 11 (solid on 10).
- Tray icon: click toggles the window; menu Tocar/Pausar, Próxima, Anterior, Mostrar, Sair.
  Closing the window hides it to the tray (setting, on by default).
- Taskbar thumbnail buttons: anterior, tocar/pausar, próxima.
- Mini player: small always-on-top window (cover, title, controls, progress), opened from the
  player bar; synced with the main window through events.
- Segoe UI Variable font on Windows; 32 px minimum hit targets; checked at 125 % and 150 %.
