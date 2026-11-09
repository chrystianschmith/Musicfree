import { IconMusic } from "@tabler/icons-react";
import type { Thumb } from "../sources/types";
import { pickThumb } from "../lib/format";
import s from "./Cover.module.css";

type Props = {
  thumbs: Thumb[];
  size: number;
  round?: boolean;
  radius?: number;
  className?: string;
};

export function Cover({ thumbs, size, round, radius, className }: Props) {
  const url = pickThumb(thumbs, size * 2);
  const style = { width: size, height: size, borderRadius: round ? "50%" : (radius ?? 10) };
  return url ? (
    <img
      className={[s.cover, className].filter(Boolean).join(" ")}
      src={url}
      alt=""
      style={style}
      loading="lazy"
      draggable={false}
    />
  ) : (
    <span className={[s.cover, s.empty, className].filter(Boolean).join(" ")} style={style}>
      <IconMusic size={Math.max(16, size / 3)} stroke={1.4} aria-hidden />
    </span>
  );
}
