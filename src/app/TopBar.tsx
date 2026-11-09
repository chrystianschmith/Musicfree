import { useNavigate } from "react-router-dom";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { IconButton } from "../components/IconButton";

/** Back/forward + a search affordance that jumps to the search page. */
export function TopBar({ children }: { children?: React.ReactNode }) {
  const nav = useNavigate();
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, minHeight: 32 }}
    >
      <IconButton icon={IconChevronLeft} label="Voltar" size={22} onClick={() => nav(-1)} />
      <IconButton icon={IconChevronRight} label="Avançar" size={22} onClick={() => nav(1)} />
      {children ?? (
        <button
          onClick={() => nav("/search")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--text-2)",
            marginLeft: 8,
            fontSize: 14,
          }}
        >
          <IconSearch size={18} stroke={1.6} aria-hidden /> O que você quer ouvir?
        </button>
      )}
    </div>
  );
}
