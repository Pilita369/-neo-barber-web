import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

export function PanelNav({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-5">
      <nav className="flex gap-2">
        <Link
          to="/panel"
          activeOptions={{ exact: true }}
          className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
        >
          Agenda
        </Link>
        <Link
          // @ts-expect-error /panel/clientes route not created yet (Task 7); remove this once it exists
          to="/panel/clientes"
          className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
        >
          Clientes
        </Link>
      </nav>
      <button
        onClick={onCerrarSesion}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
      >
        <LogOut className="size-3.5" /> Salir
      </button>
    </div>
  );
}
