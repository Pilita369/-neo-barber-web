import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { getClientProfile, getClientMonth } from "@/lib/clients.functions";
import { usePanelAuth } from "@/lib/use-panel-auth";
import { PanelNav } from "@/components/panel-nav";
import { SiteFooter } from "@/components/site-footer";
import { Calendar } from "@/components/ui/calendar";
import type { ClientMonthAppointment } from "@/lib/types";
import { fechaLarga, waLink } from "@/lib/datetime";

export const Route = createFileRoute("/panel/clientes/$id")({
  head: () => ({ meta: [{ title: "Ficha de cliente — Neo Barbería" }] }),
  component: ClientProfilePage,
});

function ClientProfilePage() {
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

  return <ClientProfile onCerrarSesion={cerrarSesion} />;
}

function ClientProfile({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const { id } = Route.useParams();
  const getClientProfileFn = useServerFn(getClientProfile);

  const q = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => getClientProfileFn({ data: { clientId: id } }),
    retry: 1,
  });

  const getClientMonthFn = useServerFn(getClientMonth);
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthQuery = useQuery({
    queryKey: ["cliente-mes", id, viewedMonth.year, viewedMonth.month],
    queryFn: () =>
      getClientMonthFn({ data: { clientId: id, year: viewedMonth.year, month: viewedMonth.month } }),
  });

  const appts = monthQuery.data ?? [];
  const completadosDelMes = appts.length;
  const highlightedDates = [...new Set(appts.map((a) => a.date))].map(
    (d) => new Date(d + "T12:00:00Z"),
  );
  const selectedDayAppts: ClientMonthAppointment[] = selectedDay
    ? appts.filter((a) => a.date === selectedDay)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16">
      <PanelNav onCerrarSesion={onCerrarSesion} />

      <div className="mt-5">
        <Link to="/panel/clientes" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Clientes
        </Link>
      </div>

      {q.isPending ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : !q.data ? (
        <p className="card-neo mt-4 p-4 text-sm text-muted-foreground">No encontramos este cliente.</p>
      ) : (
        <>
          <h1 className="mt-3 font-display text-3xl tracking-wide">
            {q.data.client.name} {q.data.client.lastname ?? ""}
          </h1>

          <section className="card-neo mt-4 space-y-2 p-4">
            <h2 className="font-display text-lg tracking-wide text-gold">Datos</h2>
            <a
              href={waLink(q.data.client.phone_e164, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm underline"
            >
              <MessageCircle className="size-4 text-gold" /> {q.data.client.phone_e164}
            </a>
            <p className="text-xs text-muted-foreground">
              Cliente desde {fechaLarga(q.data.client.created_at.slice(0, 10))}
            </p>
          </section>

          <section className="card-neo mt-4 space-y-2 p-4">
            <h2 className="font-display text-lg tracking-wide text-gold">Resumen</h2>
            <p className="text-sm">
              Próximo turno:{" "}
              {q.data.next_appointment
                ? `${fechaLarga(q.data.next_appointment.date)} · ${q.data.next_appointment.start_time} h · ${q.data.next_appointment.service_name}`
                : "Sin turnos próximos"}
            </p>
            <p className="text-sm">
              Última visita: {q.data.last_visit ? fechaLarga(q.data.last_visit) : "—"}
            </p>
            <p className="text-sm">Cortes completados (histórico): {q.data.total_completados}</p>
          </section>

          <section className="card-neo mt-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg tracking-wide text-gold">Calendario</h2>
              <p className="text-sm text-muted-foreground">Completados este mes: {completadosDelMes}</p>
            </div>
            <div className="mt-3">
              <Calendar
                month={new Date(viewedMonth.year, viewedMonth.month - 1, 1)}
                onMonthChange={(date) => {
                  setViewedMonth({ year: date.getFullYear(), month: date.getMonth() + 1 });
                  setSelectedDay(null);
                }}
                modifiers={{ atendido: highlightedDates }}
                modifiersClassNames={{ atendido: "bg-gold text-gold-foreground rounded-md" }}
                classNames={{ root: "w-full" }}
                className="w-full max-w-full [--cell-size:2.25rem] md:[--cell-size:3rem]"
                onDayClick={(date, modifiers) => {
                  if (!modifiers["atendido"]) return;
                  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  setSelectedDay(iso === selectedDay ? null : iso);
                }}
              />
            </div>
            {selectedDay && selectedDayAppts.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {selectedDayAppts.map((a) => (
                  <p key={a.id} className="text-sm">
                    {a.start_time} h · {a.service_name}
                  </p>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}

      <SiteFooter />
    </main>
  );
}
