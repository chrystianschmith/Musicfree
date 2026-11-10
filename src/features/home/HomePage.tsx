import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconBroadcast,
  IconHeart,
  IconHistory,
  IconPlaylist,
  type Icon,
} from "@tabler/icons-react";
import { useHome } from "../../sources/queries";
import { greeting } from "../../lib/format";
import { ShelfRow } from "../shelf/ShelfRow";
import { SectionError, Skeleton } from "../../components/States";
import { usePlaylists } from "../library/usePlaylists";
import { usePlayer } from "../../store/player";
import { startRadio } from "../../components/ContextMenu";
import { TopBar } from "../../app/TopBar";
import { usePersonalShelves } from "../recs/usePersonalShelves";
import s from "./Home.module.css";

function Quick({ icon: I, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button className={s.quick} onClick={onClick}>
      <I size={20} stroke={1.6} className={s.quickIcon} aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export function HomePage() {
  const [mood, setMood] = useState<string | undefined>();
  const home = useHome(mood);
  const nav = useNavigate();
  const { data: playlists = [] } = usePlaylists();
  const last = usePlayer((p) => p.current());
  const moods = home.data?.moods ?? [];
  const personal = usePersonalShelves();

  return (
    <div>
      <TopBar />
      <div className={s.tabs} role="tablist">
        {[undefined, ...moods].map((m) => (
          <button
            key={m ?? "all"}
            role="tab"
            aria-selected={mood === m}
            className={[s.tab, mood === m && s.tabOn].filter(Boolean).join(" ")}
            onClick={() => setMood(m)}
          >
            {m ?? "Tudo"}
          </button>
        ))}
      </div>

      <h1 className={s.hello}>{greeting(new Date().getHours())}</h1>
      <div className={s.quickGrid}>
        <Quick icon={IconHeart} label="Curtidas" onClick={() => nav("/library/liked")} />
        <Quick icon={IconHistory} label="Histórico" onClick={() => nav("/library/history")} />
        {last && (
          <Quick
            icon={IconBroadcast}
            label={`Rádio: ${last.title}`}
            onClick={() => void startRadio(last)}
          />
        )}
        {playlists.slice(0, last ? 3 : 4).map((p) => (
          <Quick
            key={p.id}
            icon={IconPlaylist}
            label={p.name}
            onClick={() => nav(`/library/playlist/${p.id}`)}
          />
        ))}
      </div>

      {home.isPending && (
        <div style={{ display: "flex", gap: 22 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} w={168} h={168} />
          ))}
        </div>
      )}
      {home.isError && <SectionError onRetry={() => home.refetch()} />}
      {!mood && personal.data?.map((shelf) => <ShelfRow key={`me-${shelf.title}`} shelf={shelf} />)}
      {home.data?.shelves.map((shelf, i) => (
        <ShelfRow key={`${mood}-${i}`} shelf={shelf} />
      ))}
    </div>
  );
}
