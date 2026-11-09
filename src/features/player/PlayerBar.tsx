import { useState } from "react";
import {
  IconArrowsShuffle,
  IconHeart,
  IconHeartFilled,
  IconList,
  IconMicrophone2,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconRepeat,
  IconRepeatOnce,
  IconVolume,
  IconVolume2,
  IconVolume3,
  IconLayoutSidebarRight,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { usePlayer } from "../../store/player";
import { useUI } from "../../store/ui";
import { IconButton } from "../../components/IconButton";
import { Cover } from "../../components/Cover";
import { formatTime } from "../../lib/format";
import { Slider } from "./Slider";
import { useLike } from "../library/useLibrary";
import s from "./PlayerBar.module.css";

export function PlayerBar() {
  const p = usePlayer();
  const ui = useUI();
  const cur = p.current();
  const [scrub, setScrub] = useState<number | null>(null);
  const { liked, toggle: toggleLike } = useLike(cur);
  const pos = scrub ?? p.position;
  const dur = p.duration || (cur?.durationMs ?? 0) / 1000;
  const VolIcon =
    p.muted || p.volume === 0 ? IconVolume3 : p.volume < 0.5 ? IconVolume2 : IconVolume;

  return (
    <footer className={s.bar}>
      <div className={s.left}>
        {cur && (
          <>
            <button
              className={s.coverBtn}
              onClick={() => ui.openNowPlaying()}
              aria-label="Abrir tocando agora"
            >
              <Cover thumbs={cur.thumbs} size={52} radius={8} />
            </button>
            <div className={s.meta}>
              <button className={s.title} onClick={() => ui.openNowPlaying()}>
                {cur.title}
              </button>
              <div className={s.artists}>
                {cur.artists.map((a, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    {a.id ? <Link to={`/artist/${a.id}`}>{a.name}</Link> : a.name}
                  </span>
                ))}
              </div>
            </div>
            <IconButton
              icon={liked ? IconHeartFilled : IconHeart}
              label={liked ? "Remover das curtidas" : "Curtir"}
              active={liked}
              size={18}
              onClick={toggleLike}
            />
          </>
        )}
      </div>

      <div className={s.center}>
        <div className={s.controls}>
          <IconButton
            icon={IconArrowsShuffle}
            label="Aleatório"
            active={p.shuffle}
            size={18}
            onClick={() => p.setShuffle(!p.shuffle)}
          />
          <IconButton icon={IconPlayerSkipBack} label="Anterior" size={20} onClick={p.prev} />
          <IconButton
            icon={p.playing ? IconPlayerPauseFilled : IconPlayerPlayFilled}
            label={p.playing ? "Pausar" : "Tocar"}
            size={34}
            strong
            onClick={p.toggle}
            className={s.play}
          />
          <IconButton icon={IconPlayerSkipForward} label="Próxima" size={20} onClick={p.next} />
          <IconButton
            icon={p.repeat === "one" ? IconRepeatOnce : IconRepeat}
            label={
              p.repeat === "off"
                ? "Repetir"
                : p.repeat === "all"
                  ? "Repetir uma"
                  : "Desativar repetição"
            }
            active={p.repeat !== "off"}
            size={18}
            onClick={p.cycleRepeat}
          />
        </div>
        <div className={s.progress}>
          <span className={s.time}>{formatTime(cur ? pos : undefined)}</span>
          <Slider
            label="Progresso"
            value={dur ? Math.min(1, pos / dur) : 0}
            onChange={(v) => setScrub(v * dur)}
            onCommit={(v) => {
              setScrub(null);
              p.seek(v * dur);
            }}
          />
          <span className={s.time}>{formatTime(cur ? dur : undefined)}</span>
        </div>
      </div>

      <div className={s.right}>
        <IconButton
          icon={IconMicrophone2}
          label="Letra"
          size={18}
          active={ui.nowPlayingOpen && ui.nowPlayingTab === "lyrics"}
          onClick={() => ui.openNowPlaying("lyrics")}
        />
        <IconButton
          icon={IconList}
          label="Fila"
          size={18}
          active={ui.nowPlayingOpen && ui.nowPlayingTab === "queue"}
          onClick={() => ui.openNowPlaying("queue")}
        />
        <IconButton
          icon={IconLayoutSidebarRight}
          label="Painel lateral"
          size={18}
          active={ui.panelOpen}
          onClick={ui.togglePanel}
        />
        <IconButton
          icon={VolIcon}
          label={p.muted ? "Ativar som" : "Mudo"}
          size={18}
          onClick={p.toggleMute}
        />
        <Slider
          label="Volume"
          className={s.volume}
          value={p.muted ? 0 : p.volume}
          onChange={p.setVolume}
        />
      </div>
    </footer>
  );
}
