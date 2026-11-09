import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Track } from "../../sources/types";
import { fetchLyrics } from "../../lib/lyrics";
import { activeLine } from "../../lib/lrc";
import { usePlayer } from "../../store/player";
import s from "./Lyrics.module.css";

export function useLyrics(t: Track | undefined) {
  return useQuery({
    queryKey: ["lyrics", t?.id],
    queryFn: () => fetchLyrics(t!),
    enabled: !!t,
    staleTime: Infinity,
    retry: 0,
  });
}

/** Synced lyrics: current line bright, sung lines dimmed, click a line to seek. */
export function Lyrics({ track, size = "lg" }: { track: Track; size?: "sm" | "lg" }) {
  const q = useLyrics(track);
  const position = usePlayer((p) => p.position);
  const seek = usePlayer((p) => p.seek);
  const box = useRef<HTMLDivElement>(null);
  const synced = q.data?.synced;
  const idx = synced ? activeLine(synced, position + 0.25) : -1;

  useEffect(() => {
    // Scroll only the lyrics' own scroll container; scrollIntoView would also move the window.
    const sc = box.current?.parentElement;
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    if (!sc || !el) return;
    const a = el.getBoundingClientRect();
    const b = sc.getBoundingClientRect();
    sc.scrollBy({ top: a.top - b.top - sc.clientHeight / 2 + a.height / 2, behavior: "smooth" });
  }, [idx]);

  if (q.isPending) return <p className={s.info}>Carregando letra…</p>;
  if (q.isError) return <p className={s.info}>Não foi possível carregar a letra.</p>;
  if (!q.data) return <p className={s.info}>Letra indisponível para esta música.</p>;
  if (!synced) return <pre className={[s.plain, s[size]].join(" ")}>{q.data.plain}</pre>;

  return (
    <div ref={box} className={[s.lyrics, s[size]].join(" ")}>
      {synced.map((l, i) => (
        <p
          key={i}
          data-i={i}
          className={[s.line, i < idx && s.past, i === idx && s.now].filter(Boolean).join(" ")}
          onClick={() => seek(l.t)}
        >
          {l.line || "♪"}
        </p>
      ))}
    </div>
  );
}
