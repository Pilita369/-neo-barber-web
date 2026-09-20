import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MessageCircle } from "lucide-react";
import type { DayButton } from "react-day-picker";
import {
  approveAppointment,
  getAgendaMonth,
  getPanelData,
  rejectAppointment,
  setAppointmentStatus,
} from "@/lib/admin.functions";
import { PanelNav } from "@/components/panel-nav";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDays, fechaCorta, fechaLarga, todayBA, waLink } from "@/lib/datetime";
import { ESTADOS, type Appointment, type AppointmentStatus } from "@/lib/types";
import { usePanelAuth } from "@/lib/use-panel-auth";

export const Route = createFileRoute("/panel/")({
  head: () => ({ meta: [{ title: "Panel — Neo Barbería" }] }),
  component: PanelPage,
});

function PanelPage() {
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

  return <Agenda onCerrarSesion={cerrarSesion} />;
}

const ACCIONES: Record<AppointmentStatus, { next: AppointmentStatus; label: string }[]> = {
  pendiente: [
    { next: "confirmado", label: "Confirmar" },
    { next: "cancelado", label: "Cancelar" },
  ],
  confirmado: [
    { next: "atendido", label: "Atendido" },
    { next: "no_asistio", label: "No asistió" },
    { next: "cancelado", label: "Cancelar" },
  ],
  atendido: [],
  cancelado: [],
  no_asistio: [],
};

function isoOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function TurnoCard({
  appt,
  savingId,
  onCambiarEstado,
  onAprobar,
  onRechazar,
}: {
  appt: Appointment;
  savingId: string | null;
  onCambiarEstado: (appt: Appointment, next: AppointmentStatus) => void;
  onAprobar: (appt: Appointment) => void;
  onRechazar: (appt: Appointment) => void;
}) {
  const necesitaAutorizacion = appt.needs_approval && appt.status === "pendiente";
  return (
    <div className={cn("card-neo p-4", necesitaAutorizacion && "border-gold/40 bg-accent")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xl tracking-wide">{appt.start_time} h</p>
        <span className="text-xs text-muted-foreground">{ESTADOS[appt.status]}</span>
      </div>
      <p className="mt-1 text-sm">
        {appt.client_name} {appt.client_lastname} · {appt.service_name}
      </p>
      <p className="text-xs text-muted-foreground">{appt.client_phone}</p>
      {appt.notes ? <p className="mt-1 text-xs text-muted-foreground">Nota: {appt.notes}</p> : null}
      {necesitaAutorizacion ? (
        <p className="mt-1 text-xs text-muted-foreground">Este cliente ya tiene otro turno activo.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {necesitaAutorizacion ? (
          <>
            <button
              onClick={() => onAprobar(appt)}
              disabled={savingId === appt.id}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              Aprobar
            </button>
            <button
              onClick={() => onRechazar(appt)}
              disabled={savingId === appt.id}
              className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-60"
            >
              Rechazar
            </button>
          </>
        ) : (
          ACCIONES[appt.status].map((a) => (
            <button
              key={a.next}
              onClick={() => onCambiarEstado(appt, a.next)}
              disabled={savingId === appt.id}
              className="btn-gold-outline rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            >
              {a.label}
            </button>
          ))
        )}
        <a
          href={waLink(appt.client_phone, `Hola ${appt.client_name}, te escribimos de Neo Barbería.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
        >
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

function Agenda({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const queryClient = useQueryClient();
  const getPanelDataFn = useServerFn(getPanelData);
  const getAgendaMonthFn = useServerFn(getAgendaMonth);
  const setStatusFn = useServerFn(setAppointmentStatus);
  const approveFn = useServerFn(approveAppointment);
  const rejectFn = useServerFn(rejectAppointment);
  const [savingId, setSavingId] = useState<string | null>(null);

  const from = todayBA();
  const to = addDays(from, 6);

  const q = useQuery({
    queryKey: ["panel-data", from, to],
    queryFn: () => getPanelDataFn({ data: { from, to } }),
  });

  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthQuery = useQuery({
    queryKey: ["agenda-month", viewedMonth.year, viewedMonth.month],
    queryFn: () => getAgendaMonthFn({ data: { year: viewedMonth.year, month: viewedMonth.month } }),
  });

  async function invalidarTodo() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["panel-data"] }),
      queryClient.invalidateQueries({ queryKey: ["agenda-month"] }),
    ]);
  }

  async function cambiarEstado(appt: Appointment, next: AppointmentStatus) {
    setSavingId(appt.id);
    try {
      await setStatusFn({ data: { id: appt.id, status: next } });
      if (next === "cancelado") {
        const msg = `Hola ${appt.client_name}, te escribimos de Neo Barbería: tu turno del ${fechaLarga(appt.date)} a las ${appt.start_time} fue cancelado. Cualquier consulta, respondé este mensaje.`;
        window.open(waLink(appt.client_phone, msg), "_blank", "noopener,noreferrer");
      }
      await invalidarTodo();
      toast.success("Turno actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el turno");
    }
    setSavingId(null);
  }

  async function aprobar(appt: Appointment) {
    setSavingId(appt.id);
    try {
      await approveFn({ data: { id: appt.id } });
      await invalidarTodo();
      toast.success("Turno confirmado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo confirmar el turno");
    }
    setSavingId(null);
  }

  async function rechazar(appt: Appointment) {
    setSavingId(appt.id);
    try {
      await rejectFn({ data: { id: appt.id } });
      const msg = `Hola ${appt.client_name}, te escribimos de Neo Barbería: no pudimos confirmar tu turno del ${fechaLarga(appt.date)} a las ${appt.start_time} porque ya tenías otro turno activo. Escribinos si querés reprogramarlo.`;
      window.open(waLink(appt.client_phone, msg), "_blank", "noopener,noreferrer");
      await invalidarTodo();
      toast.success("Turno rechazado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo rechazar el turno");
    }
    setSavingId(null);
  }

  const todos = (q.data?.appointments ?? []) as Appointment[];
  const pendientesAutorizacion = todos.filter((a) => a.needs_approval && a.status === "pendiente");

  const monthAppts = (monthQuery.data?.appointments ?? []) as Appointment[];
  const countsByDate = new Map<string, number>();
  for (const a of monthAppts) countsByDate.set(a.date, (countsByDate.get(a.date) ?? 0) + 1);
  const selectedDayAppts = selectedDay ? monthAppts.filter((a) => a.date === selectedDay) : [];

  function AgendaDayButton({ className, day, modifiers, ...props }: ComponentProps<typeof DayButton>) {
    const iso = isoOf(day.date);
    const count = countsByDate.get(iso) ?? 0;
    const isSelected = iso === selectedDay;
    return (
      <Button
        variant="ghost"
        size="icon"
        data-today={modifiers["today"] || undefined}
        data-selected={isSelected || undefined}
        className={cn(
          "flex aspect-square h-auto w-full min-w-(--cell-size) flex-col items-center justify-center gap-0.5 font-normal leading-none",
          "data-[today=true]:ring-1 data-[today=true]:ring-gold",
          "data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:ring-0",
          count > 0 && !isSelected && "bg-accent",
          className,
        )}
        {...props}
      >
        <span>{day.date.getDate()}</span>
        {count > 0 ? (
          <span
            className={cn(
              "flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
              isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-gold text-gold-foreground",
            )}
          >
            {count}
            <span className="hidden md:inline">{count === 1 ? " turno" : " turnos"}</span>
          </span>
        ) : null}
      </Button>
    );
  }

  return (
    <>
      <PanelNav onCerrarSesion={onCerrarSesion} />
      <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-6">
        <header>
          <h1 className="font-display text-3xl tracking-wide">Agenda</h1>
          <p className="text-xs text-muted-foreground">Calendario mensual de turnos</p>
        </header>

        {q.isPending ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : pendientesAutorizacion.length > 0 ? (
          <div className="mt-6 space-y-3">
            <h2 className="flex items-center gap-1.5 font-display text-xl tracking-wide text-gold">
              <AlertTriangle className="size-4" /> Requieren tu autorización
            </h2>
            {pendientesAutorizacion.map((appt) => (
              <div key={appt.id} className="rounded-xl border border-gold/40 bg-accent p-4">
                <p className="font-display text-xl tracking-wide">
                  {fechaLarga(appt.date)} · {appt.start_time} h
                </p>
                <p className="mt-1 text-sm">
                  {appt.client_name} {appt.client_lastname} · {appt.service_name}
                </p>
                <p className="text-xs text-muted-foreground">{appt.client_phone}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Este cliente ya tiene otro turno activo.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => aprobar(appt)}
                    disabled={savingId === appt.id}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => rechazar(appt)}
                    disabled={savingId === appt.id}
                    className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-60"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-8">
          <h2 className="font-display text-xl tracking-wide text-gold">Calendario</h2>
          <div className="card-neo mt-3 p-2 md:p-2.5">
            {monthQuery.isPending ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : (
              <Calendar
                month={new Date(viewedMonth.year, viewedMonth.month - 1, 1)}
                onMonthChange={(date) => {
                  setViewedMonth({ year: date.getFullYear(), month: date.getMonth() + 1 });
                  setSelectedDay(null);
                }}
                onDayClick={(date) => {
                  const iso = isoOf(date);
                  if (!countsByDate.get(iso)) return;
                  setSelectedDay(iso === selectedDay ? null : iso);
                }}
                components={{ DayButton: AgendaDayButton }}
                className="mx-auto w-full max-w-full [--cell-size:2.75rem] md:[--cell-size:2.5rem]"
                classNames={{
                  month: "flex w-full flex-col gap-2 md:gap-1.5",
                  week: "mt-1.5 flex w-full md:mt-1",
                }}
              />
            )}
          </div>

          {selectedDay ? (
            <div className="mt-4 space-y-3">
              <h3 className="font-display text-lg uppercase tracking-wide">
                {fechaCorta(selectedDay)} · {selectedDayAppts.length} turno
                {selectedDayAppts.length === 1 ? "" : "s"}
              </h3>
              {selectedDayAppts.map((appt) => (
                <TurnoCard
                  key={appt.id}
                  appt={appt}
                  savingId={savingId}
                  onCambiarEstado={cambiarEstado}
                  onAprobar={aprobar}
                  onRechazar={rechazar}
                />
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
