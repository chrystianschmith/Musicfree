import { Link } from "react-router-dom";
import { IconChevronDown } from "@tabler/icons-react";
import { usePlayer } from "../../store/player";
import { useUI, type NowPlayingTab } from "../../store/ui";
import { Cover } from "../../components/Cover";
import { IconButton } from "../../components/IconButton";
import { Lyrics } from "./Lyrics";
import { QueueView } from "../queue/QueueView";
import { useRelated } from "../../sources/queries";
import { TrackList } from "../tracks/TrackList";
import s from "./NowPlaying.module.css";

const TABS: [NowPlayingTab, string][] = [
  ["lyrics", "Letra"],
  ["queue", "A seguir"],
  ["related", "Relacionadas"],
];

export function NowPlaying() {
  const ui = useUI();
  const cur = usePlayer((p) => p.current());
  const playTracks = usePlayer((p) => p.playTracks);
  const related = useRelated(
    ui.nowPlayingOpen && ui.nowPlayingTab === "related" ? cur?.id : undefined,
  );

  return (
    <section
      className={[s.overlay, ui.nowPlayingOpen && s.open].filter(Boolean).join(" ")}
      aria-hidden={!ui.nowPlayingOpen}
      aria-label="Tocando agora"
    >
      {cur && (
        <div className={s.inner}>
          <div className={s.left}>
            <IconButton
              icon={IconChevronDown}
              label="Fechar"
              size={26}
              onClick={ui.closeNowPlaying}
              className={s.close}
            />
            <Cover thumbs={cur.thumbs} size={340} radius={16} />
            <div className={s.title}>{cur.title}</div>
            <div className={s.artist}>
              {cur.artists.map((a, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  {a.id ? (
                    <Link to={`/artist/${a.id}`} onClick={ui.closeNowPlaying}>
                      {a.name}
                    </Link>
                  ) : (
                    a.name
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className={s.right}>
            <div className={s.tabs} role="tablist">
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={ui.nowPlayingTab === k}
                  className={[s.tab, ui.nowPlayingTab === k && s.tabOn].filter(Boolean).join(" ")}
                  onClick={() => useUI.setState({ nowPlayingTab: k })}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={s.content}>
              {ui.nowPlayingTab === "lyrics" && <Lyrics key={cur.id} track={cur} size="lg" />}
              {ui.nowPlayingTab === "queue" && <QueueView />}
              {ui.nowPlayingTab === "related" &&
                (related.data ? (
                  <TrackList
                    tracks={related.data}
                    onPlay={(i) => playTracks(related.data!, i)}
                    header={false}
                    showAlbum={false}
                  />
                ) : (
                  <p style={{ color: "var(--text-2)" }}>
                    {related.isError ? "Não foi possível carregar." : "Carregando…"}
                  </p>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
