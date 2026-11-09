import { Link } from "react-router-dom";
import { usePlayer } from "../../store/player";
import { useUI } from "../../store/ui";
import { Cover } from "../../components/Cover";
import { Lyrics } from "./Lyrics";
import s from "./RightPanel.module.css";

export function RightPanel() {
  const cur = usePlayer((p) => p.current());
  const open = useUI((u) => u.openNowPlaying);
  const next = usePlayer((p) => p.upcoming()[0]);
  if (!cur) {
    return (
      <aside className={s.panel}>
        <p className={s.empty}>Escolha uma música para começar.</p>
      </aside>
    );
  }
  return (
    <aside className={s.panel} aria-label="Painel tocando agora">
      <button className={s.coverBtn} onClick={() => open()} aria-label="Abrir tocando agora">
        <Cover thumbs={cur.thumbs} size={252} radius={12} />
      </button>
      <div className={s.title}>{cur.title}</div>
      <div className={s.artist}>
        {cur.artists.map((a, i) => (
          <span key={i}>
            {i > 0 && ", "}
            {a.id ? <Link to={`/artist/${a.id}`}>{a.name}</Link> : a.name}
          </span>
        ))}
      </div>
      <div className={s.lyrics}>
        <Lyrics key={cur.id} track={cur} size="sm" />
      </div>
      {next && (
        <div className={s.next}>
          <div className={s.label}>A seguir</div>
          <div>
            {next.title}{" "}
            <span className={s.muted}>· {next.artists.map((a) => a.name).join(", ")}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
