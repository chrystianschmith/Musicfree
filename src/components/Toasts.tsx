import { useUI } from "../store/ui";

export function Toasts() {
  const toasts = useUI((u) => u.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "calc(var(--bar-h) + 12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "var(--text)",
            color: "var(--bg)",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
