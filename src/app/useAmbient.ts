import { useEffect } from "react";
import { usePlayer } from "../store/player";
import { pickThumb } from "../lib/format";
import { ambientOf, toCss } from "../lib/color";

const IDLE = "#1b1a22";

/** Tints the whole app with the colour of the current cover (see --ambient in globals.css). */
export function useAmbient() {
  const cur = usePlayer((p) => p.current());
  const url = cur ? pickThumb(cur.thumbs, 120) : undefined;
  useEffect(() => {
    const root = document.documentElement;
    if (!url) {
      root.style.setProperty("--ambient", IDLE);
      return;
    }
    let alive = true;
    void ambientOf(url).then(
      (c) => alive && root.style.setProperty("--ambient", c ? toCss(c) : IDLE),
    );
    return () => {
      alive = false;
    };
  }, [url]);
}
