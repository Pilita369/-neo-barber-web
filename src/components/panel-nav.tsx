import { Link } from "@tanstack/react-router";
import { Home, LogOut } from "lucide-react";

export function PanelNav({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-between overflow-x-auto px-5 pt-5">
      <nav className="flex gap-2">
        <Link
          to="/panel"
          activeOptions={{ exact: true }}
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
        >
          Agenda
        </Link>
        <Link
          to="/panel/clientes"
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
        >
          Clientes
        </Link>
        <Link
          to="/panel/servicios"
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
        >
          Servicios
        </Link>
        <Link
          to="/panel/promociones"
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
        >
          Promos
        </Link>
        <Link
          to="/panel/configuracion"
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          activeProps={{ className: "bg-primary text-primary-foreground" }}
          inactiveProps={{ className: "text-muted-foreground" }}
        >
          Configuración
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors"
        >
          <Home className="size-3.5" /> Inicio
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
