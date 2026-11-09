import type { Icon } from "@tabler/icons-react";
import s from "./IconButton.module.css";

type Props = {
  icon: Icon;
  label: string;
  active?: boolean;
  size?: number;
  strong?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
};

/** Icon-only control: no background, no border. Gray → white on hover → accent when active. */
export function IconButton({
  icon: I,
  label,
  active,
  size = 20,
  strong,
  onClick,
  className,
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[s.btn, active && s.active, strong && s.strong, className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      <I size={size} stroke={1.6} aria-hidden />
    </button>
  );
}
