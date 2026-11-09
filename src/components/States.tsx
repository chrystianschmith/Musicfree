import { IconRefresh } from "@tabler/icons-react";

export function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        padding: "32px 0",
        color: "var(--text-2)",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span>Esta seção não carregou.</span>
      <button
        onClick={onRetry}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text)" }}
      >
        <IconRefresh size={16} stroke={1.6} aria-hidden /> Tentar de novo
      </button>
    </div>
  );
}

export function Skeleton({ w, h, round }: { w: number | string; h: number; round?: boolean }) {
  return (
    <span
      style={{
        display: "block",
        width: w,
        height: h,
        borderRadius: round ? "50%" : 10,
        background: "#18181c",
        animation: "mf-pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}
