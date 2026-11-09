import { useRef, useState } from "react";
import s from "./Slider.module.css";

type Props = {
  value: number; // 0..1
  onChange(v: number): void;
  onCommit?(v: number): void;
  label: string;
  className?: string;
};

/** Thin line slider; thumb appears on hover/drag. Keyboard: arrows ±5%. */
export function Slider({ value, onChange, onCommit, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const v = drag ?? value;

  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  return (
    <div
      ref={ref}
      className={[s.slider, drag !== null && s.dragging, className].filter(Boolean).join(" ")}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      tabIndex={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const x = at(e.clientX);
        setDrag(x);
        onChange(x);
      }}
      onPointerMove={(e) => {
        if (drag === null) return;
        const x = at(e.clientX);
        setDrag(x);
        onChange(x);
      }}
      onPointerUp={(e) => {
        if (drag === null) return;
        const x = at(e.clientX);
        setDrag(null);
        (onCommit ?? onChange)(x);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        e.stopPropagation();
        const x = Math.min(1, Math.max(0, value + (e.key === "ArrowRight" ? 0.05 : -0.05)));
        (onCommit ?? onChange)(x);
      }}
    >
      <div className={s.track}>
        <div className={s.fill} style={{ width: `${v * 100}%` }} />
      </div>
      <div className={s.thumb} style={{ left: `${v * 100}%` }} />
    </div>
  );
}
