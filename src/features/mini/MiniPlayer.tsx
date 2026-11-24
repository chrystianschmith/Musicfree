import { useEffect, useState } from "react";
import {
  IconArrowsMaximize,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconX,
} from "@tabler/icons-react";
import { IconButton } from "../../components/IconButton";
import type { MiniState } from "../../app/desktop";
import { closeMini, expandFromMini } from "./openMini";
import s from "./MiniPlayer.module.css";

const send = (action: string) =>
  void import("@tauri-apps/api/event").then(({ emitTo }) =>
    emitTo("main", "media:command", action),
  );

/** Small always-on-top window: mirrors the main window's player and sends it commands. */
export function MiniPlayer() {
  const [st, setSt] = useState<MiniState>({ playing: false, position: 0, duration: 0 });

  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    void import("@tauri-apps/api/event").then(async ({ listen, emitTo }) => {
      const un = await listen<MiniState>("mini:state", (e) => setSt(e.payload));
      if (!alive) return un();
      stop = un;
      await emitTo("main", "mini:hello", null);
    });
    const bye = () =>
      void import("@tauri-apps/api/event").then(({ emitTo }) => emitTo("main", "mini:bye", null));
    window.addEventListener("beforeunload", bye);
    return () => {
      alive = false;
      stop?.();
      window.removeEventListener("beforeunload", bye);
    };
  }, []);

  const pct = st.duration > 0 ? Math.min(100, (st.position / st.duration) * 100) : 0;
  return (
    <div className={s.mini} data-tauri-drag-region>
      {st.cover ? (
        <img className={s.cover} src={st.cover} alt="" draggable={false} data-tauri-drag-region />
      ) : (
        <div className={s.cover} data-tauri-drag-region />
      )}
      <div className={s.meta} data-tauri-drag-region>
        <div className={s.title} data-tauri-drag-region>
          {st.title ?? "Nada tocando"}
        </div>
        {st.artist && (
          <div className={s.artist} data-tauri-drag-region>
            {st.artist}
          </div>
        )}
        <div className={s.controls}>
          <IconButton
            icon={IconPlayerSkipBack}
            label="Anterior"
            size={18}
            onClick={() => send("prev")}
          />
          <IconButton
            icon={st.playing ? IconPlayerPauseFilled : IconPlayerPlayFilled}
            label={st.playing ? "Pausar" : "Tocar"}
            size={24}
            strong
            onClick={() => send("toggle")}
          />
          <IconButton
            icon={IconPlayerSkipForward}
            label="Próxima"
            size={18}
            onClick={() => send("next")}
          />
        </div>
      </div>
      <div className={s.window}>
        <IconButton
          icon={IconArrowsMaximize}
          label="Abrir o Musicfree"
          size={15}
          onClick={() => void expandFromMini()}
        />
        <IconButton
          icon={IconX}
          label="Fechar mini player"
          size={15}
          onClick={() => void closeMini()}
        />
      </div>
      <div className={s.progress} aria-hidden>
        <div className={s.fill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
