import { useEffect, useRef } from "react";
import { usePlayer } from "../../store/player";
import { useUI } from "../../store/ui";
import { playableUrl, prefetch } from "../../lib/stream";
import { pickThumb } from "../../lib/format";
import { artistNames, SourceError } from "../../sources/types";
import { getRepo } from "../../db";
import { useQueryClient } from "@tanstack/react-query";
import { libKeys } from "../library/usePlaylists";

/**
 * Bridges the player store and a single hidden <audio> element.
 * Also publishes metadata/actions to the OS through the Media Session API.
 */
export function AudioEngine() {
  const ref = useRef<HTMLAudioElement>(null);
  const loadedId = useRef<string | undefined>(undefined);
  const retried = useRef(false);
  const prefetched = useRef<string | undefined>(undefined);
  /** Track id already written to history for the current load (recorded on first real play). */
  const historyFor = useRef<string | undefined>(undefined);

  const current = usePlayer((s) => s.current());
  const playing = usePlayer((s) => s.playing);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const seekNonce = usePlayer((s) => s.seekNonce);
  const qc = useQueryClient();

  // Load source when the current track changes.
  useEffect(() => {
    const el = ref.current;
    if (!el || !current) return;
    if (loadedId.current === current.id) return;
    loadedId.current = current.id;
    historyFor.current = undefined;
    retried.current = false;
    prefetched.current = undefined;
    let cancelled = false;
    playableUrl(current.id)
      .then((url) => {
        if (cancelled) return;
        el.src = url;
        const { seekRequest, playing: p } = usePlayer.getState();
        if (seekRequest) el.currentTime = seekRequest;
        if (p) void el.play().catch(() => undefined);
      })
      .catch((err) => fail(current.title, err));
    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !el.src) return;
    if (playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [playing]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume * volume; // perceptual curve
  }, [volume]);
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = ref.current;
    const { seekRequest } = usePlayer.getState();
    if (el && seekRequest !== null && el.src && Math.abs(el.currentTime - seekRequest) > 0.25) {
      el.currentTime = seekRequest;
    }
  }, [seekNonce]);

  // Media Session (OS media keys, Windows/macOS media flyout, MPRIS where supported).
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    const art = pickThumb(current.thumbs, 512);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: artistNames(current),
      album: current.album?.title ?? "",
      artwork: art ? [{ src: art, sizes: "512x512" }] : [],
    });
    const p = usePlayer.getState();
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => p.setPlaying(true)],
      ["pause", () => p.setPlaying(false)],
      ["nexttrack", () => usePlayer.getState().next()],
      ["previoustrack", () => usePlayer.getState().prev()],
      ["seekto", (d) => d.seekTime !== undefined && usePlayer.getState().seek(d.seekTime)],
    ];
    handlers.forEach(([a, h]) => {
      try {
        navigator.mediaSession.setActionHandler(a, h);
      } catch {
        /* unsupported action */
      }
    });
  }, [current]);

  useEffect(() => {
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  function fail(title: string, err?: unknown) {
    console.error(`[player] could not play "${title}"`, err);
    const kind = err instanceof SourceError ? err.kind : undefined;
    const why =
      kind === "unplayable"
        ? " (o YouTube recusou o áudio)"
        : kind === "network"
          ? " (sem conexão com o YouTube)"
          : "";
    useUI.getState().toast(`Não foi possível tocar ${title}${why}`);
    loadedId.current = undefined;
    usePlayer.getState().next();
  }

  return (
    <audio
      ref={ref}
      preload="auto"
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        const st = usePlayer.getState();
        st.setPosition(el.currentTime);
        if (el.duration && el.currentTime / el.duration > 0.75) {
          const nextId = st.upcoming()[0]?.id;
          if (nextId && prefetched.current !== nextId) {
            prefetched.current = nextId;
            prefetch(nextId);
          }
        }
      }}
      onLoadedMetadata={(e) => usePlayer.getState().setDuration(e.currentTarget.duration)}
      onEnded={() => usePlayer.getState().onEnded()}
      onPlay={() => {
        usePlayer.getState().setPlaying(true);
        const cur = usePlayer.getState().current();
        if (cur && historyFor.current !== cur.id) {
          historyFor.current = cur.id;
          void getRepo()
            .then((r) => r.pushHistory(cur))
            .then(() => qc.invalidateQueries({ queryKey: libKeys.history }));
        }
      }}
      onPause={(e) => !e.currentTarget.ended && usePlayer.getState().setPlaying(false)}
      onError={(e) => {
        const cur = usePlayer.getState().current();
        if (!cur) return;
        if (!retried.current) {
          // Expired or rejected URL: resolve once more and resume where we were.
          retried.current = true;
          const el = e.currentTarget;
          const at = el.currentTime;
          playableUrl(cur.id, true)
            .then((url) => {
              el.src = url;
              el.currentTime = at;
              if (usePlayer.getState().playing) void el.play().catch(() => undefined);
            })
            .catch((err) => fail(cur.title, err));
        } else fail(cur.title, e.currentTarget.error);
      }}
    />
  );
}
