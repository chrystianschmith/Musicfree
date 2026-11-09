import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconSearch, IconX, IconClock } from "@tabler/icons-react";
import type { SearchFilter, ShelfItem } from "../../sources/types";
import { useSearch, useSuggestions } from "../../sources/queries";
import { TopBar } from "../../app/TopBar";
import { TrackList } from "../tracks/TrackList";
import { ShelfItemView, itemInfo } from "../shelf/ShelfItemView";
import { playItem } from "../shelf/ShelfRow";
import { usePlayer } from "../../store/player";
import { Cover } from "../../components/Cover";
import { SectionError } from "../../components/States";
import { useRecentSearches } from "../library/usePlaylists";
import s from "./Search.module.css";

const FILTERS: [SearchFilter, string][] = [
  ["all", "Tudo"],
  ["songs", "Músicas"],
  ["albums", "Álbuns"],
  ["artists", "Artistas"],
  ["playlists", "Playlists"],
];

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const filter = (params.get("f") as SearchFilter) ?? "all";
  const [text, setText] = useState(q);
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(text, 200);
  const sugg = useSuggestions(focus && debounced !== q ? debounced : "");
  const res = useSearch(q, filter);
  const recent = useRecentSearches();
  const nav = useNavigate();
  const playTracks = usePlayer((p) => p.playTracks);

  useEffect(() => {
    if (!q) input.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (value: string) => {
    const v = value.trim();
    setText(v);
    setFocus(false);
    input.current?.blur();
    if (!v) return;
    recent.add(v);
    setParams({ q: v, f: filter });
  };
  const setFilter = (f: SearchFilter) => setParams({ q, f });

  const data = res.data;
  const top = data?.top;

  return (
    <div>
      <TopBar>
        <div className={s.box}>
          <IconSearch size={18} stroke={1.6} className={s.icon} aria-hidden />
          <input
            ref={input}
            id="search-input"
            className={s.input}
            placeholder="O que você quer ouvir?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => e.key === "Enter" && submit(text)}
            aria-label="Buscar"
            autoComplete="off"
            spellCheck={false}
          />
          {text && (
            <button className={s.clear} aria-label="Limpar" onClick={() => setText("")}>
              <IconX size={16} stroke={1.6} />
            </button>
          )}
          {focus && text !== q && (sugg.data?.length || (!text && recent.list.length)) ? (
            <div className={s.sugg} role="listbox">
              {(text ? (sugg.data ?? []) : recent.list).map((x) => (
                <button key={x} className={s.suggItem} role="option" onMouseDown={() => submit(x)}>
                  {text ? (
                    <IconSearch size={15} stroke={1.6} />
                  ) : (
                    <IconClock size={15} stroke={1.6} />
                  )}{" "}
                  {x}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </TopBar>

      {!q && (
        <div className={s.empty}>
          <h1>Buscar</h1>
          <p>Encontre músicas, artistas, álbuns e playlists.</p>
          {recent.list.length > 0 && (
            <div className={s.recentList}>
              {recent.list.map((r) => (
                <button key={r} onClick={() => submit(r)}>
                  <IconClock size={16} stroke={1.6} /> {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {q && (
        <>
          <div className={s.tabs} role="tablist">
            {FILTERS.map(([f, label]) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={[s.tab, filter === f && s.tabOn].filter(Boolean).join(" ")}
                onClick={() => setFilter(f)}
              >
                {label}
              </button>
            ))}
          </div>
          {res.isError && <SectionError onRetry={() => res.refetch()} />}
          {data && (
            <>
              {filter === "all" && (
                <div className={s.topGrid}>
                  {top && (
                    <TopResult
                      item={top}
                      onPlay={() => void playItem(top, data.songs)}
                      onOpen={(to) => nav(to)}
                    />
                  )}
                  <section>
                    <h2 className={s.h2}>Músicas</h2>
                    <TrackList
                      tracks={data.songs.slice(0, 4)}
                      onPlay={(i) => playTracks(data.songs, i)}
                      showAlbum={false}
                      numbered={false}
                      header={false}
                    />
                  </section>
                </div>
              )}
              {filter === "songs" && (
                <TrackList tracks={data.songs} onPlay={(i) => playTracks(data.songs, i)} />
              )}
              {(filter === "all" || filter === "artists") && (
                <Grid
                  title="Artistas"
                  items={data.artists.map((a) => ({ kind: "artist", artist: a }))}
                />
              )}
              {(filter === "all" || filter === "albums") && (
                <Grid
                  title="Álbuns"
                  items={data.albums.map((a) => ({ kind: "album", album: a }))}
                />
              )}
              {(filter === "all" || filter === "playlists") && (
                <Grid
                  title="Playlists"
                  items={data.playlists.map((p) => ({ kind: "playlist", playlist: p }))}
                />
              )}
              {!data.songs.length &&
                !data.artists.length &&
                !data.albums.length &&
                !data.playlists.length && (
                  <p className={s.none}>Nada encontrado para “{q}”. Tente outras palavras.</p>
                )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function TopResult({
  item,
  onPlay,
  onOpen,
}: {
  item: ShelfItem;
  onPlay(): void;
  onOpen(to: string): void;
}) {
  const info = itemInfo(item);
  return (
    <section>
      <h2 className={s.h2}>Melhor resultado</h2>
      <div className={s.top}>
        <button className={s.topCover} onClick={() => (info.to ? onOpen(info.to) : onPlay())}>
          <Cover thumbs={info.thumbs} size={112} round={item.kind === "artist"} />
        </button>
        <div className={s.topTitle}>{info.title}</div>
        <div className={s.topSub}>{info.sub}</div>
        <button className={s.topPlay} onClick={onPlay}>
          Tocar
        </button>
      </div>
    </section>
  );
}

function Grid({ title, items }: { title: string; items: ShelfItem[] }) {
  if (!items.length) return null;
  return (
    <section className={s.section}>
      <h2 className={s.h2}>{title}</h2>
      <div className={s.grid}>
        {items.map((it, i) => (
          <ShelfItemView key={i} item={it} size={150} onPlay={() => void playItem(it, [])} />
        ))}
      </div>
    </section>
  );
}
