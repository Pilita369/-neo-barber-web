import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { listClients } from "@/lib/clients.functions";
import { usePanelAuth } from "@/lib/use-panel-auth";
import { PanelNav } from "@/components/panel-nav";
import { fechaLarga } from "@/lib/datetime";

export const Route = createFileRoute("/panel/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Neo Barbería" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const { authState, cerrarSesion } = usePanelAuth();

  if (authState === "checking" || authState === "signed-out") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (authState === "forbidden") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground">Esta cuenta no tiene permisos de administrador.</p>
        <button onClick={cerrarSesion} className="text-sm text-primary underline">
          Cerrar sesión
        </button>
      </main>
    );
  }

  return <ClientList onCerrarSesion={cerrarSesion} />;
}

function ClientList({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const listClientsFn = useServerFn(listClients);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(inputValue.trim()), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  const q = useQuery({
    queryKey: ["clientes", search],
    queryFn: () => listClientsFn({ data: { search: search || undefined } }),
  });

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16">
      <PanelNav onCerrarSesion={onCerrarSesion} />
      <h1 className="mt-5 font-display text-3xl tracking-wide">Clientes</h1>

      <label className="mt-4 block">
        <span className="sr-only">Buscar cliente</span>
        <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Nombre o WhatsApp"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>
      </label>

      {q.isPending ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="card-neo mt-4 p-4 text-sm text-muted-foreground">
          No hay clientes que coincidan con la búsqueda.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {q.data!.map((c) => (
            <li key={c.id}>
              <Link
                // @ts-expect-error /panel/clientes/$id route not created yet (Task 8); remove this once it exists
                to="/panel/clientes/$id"
                // @ts-expect-error /panel/clientes/$id route not created yet (Task 8); remove this once it exists
                params={{ id: c.id }}
                className="card-neo block p-4 transition active:scale-[0.99]"
              >
                <p className="font-semibold">
                  {c.name} {c.lastname ?? ""}
                </p>
                <p className="mt-1 text-sm text-gold">
                  {c.total_completados === 0
                    ? "Sin visitas completadas"
                    : `${c.total_completados} corte${c.total_completados === 1 ? "" : "s"} · Última visita: ${fechaLarga(c.last_visit!)}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{c.phone_e164}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
