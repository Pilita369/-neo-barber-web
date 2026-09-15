import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, LogOut, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  approveAppointment,
  getIsAdmin,
  getPanelData,
  rejectAppointment,
  setAppointmentStatus,
} from "@/lib/admin.functions";
import { addDays, fechaLarga, todayBA, waLink } from "@/lib/datetime";
import { ESTADOS, type Appointment, type AppointmentStatus } from "@/lib/types";

export const Route = createFileRoute("/panel/")({
  head: () => ({ meta: [{ title: "Panel — Neo Barbería" }] }),
  component: PanelPage,
});

type AuthState = "checking" | "signed-out" | "forbidden" | "ok";

function PanelPage() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const getIsAdminFn = useServerFn(getIsAdmin);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setAuthState("signed-out");
        return;
      }
      try {
        const res = await getIsAdminFn();
        if (active) setAuthState(res.isAdmin ? "ok" : "forbidden");
      } catch {
        if (active) setAuthState("forbidden");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (authState === "signed-out") navigate({ to: "/auth" });
  }, [authState, navigate]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

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

function Agenda({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const queryClient = useQueryClient();
  const getPanelDataFn = useServerFn(getPanelData);
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

  async function cambiarEstado(appt: Appointment, next: AppointmentStatus) {
    setSavingId(appt.id);
    try {
      await setStatusFn({ data: { id: appt.id, status: next } });
      if (next === "cancelado") {
        const msg = `Hola ${appt.client_name}, te escribimos de Neo Barbería: tu turno del ${fechaLarga(appt.date)} a las ${appt.start_time} fue cancelado. Cualquier consulta, respondé este mensaje.`;
        window.open(waLink(appt.client_phone, msg), "_blank", "noopener,noreferrer");
      }
      await queryClient.invalidateQueries({ queryKey: ["panel-data"] });
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
      await queryClient.invalidateQueries({ queryKey: ["panel-data"] });
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
      await queryClient.invalidateQueries({ queryKey: ["panel-data"] });
      toast.success("Turno rechazado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo rechazar el turno");
    }
    setSavingId(null);
  }

  const todos = (q.data?.appointments ?? []) as Appointment[];
  const pendientesAutorizacion = todos.filter((a) => a.needs_approval && a.status === "pendiente");
  const resto = todos.filter((a) => !(a.needs_approval && a.status === "pendiente"));

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Agenda</h1>
          <p className="text-xs text-muted-foreground">Próximos 7 días</p>
        </div>
        <button
          onClick={onCerrarSesion}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
        >
          <LogOut className="size-3.5" /> Salir
        </button>
      </header>

      {q.isPending ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {pendientesAutorizacion.length > 0 ? (
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

          <div className="mt-6 space-y-3">
            {resto.length === 0 ? (
              <p className="card-neo p-4 text-sm text-muted-foreground">
                No hay turnos en los próximos 7 días.
              </p>
            ) : (
              resto.map((appt) => (
                <div key={appt.id} className="card-neo p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-xl tracking-wide">
                      {fechaLarga(appt.date)} · {appt.start_time} h
                    </p>
                    <span className="text-xs text-muted-foreground">{ESTADOS[appt.status]}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    {appt.client_name} {appt.client_lastname} · {appt.service_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{appt.client_phone}</p>
                  {appt.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">Nota: {appt.notes}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ACCIONES[appt.status].map((a) => (
                      <button
                        key={a.next}
                        onClick={() => cambiarEstado(appt, a.next)}
                        disabled={savingId === appt.id}
                        className="btn-gold-outline rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                      >
                        {a.label}
                      </button>
                    ))}
                    <a
                      href={waLink(
                        appt.client_phone,
                        `Hola ${appt.client_name}, te escribimos de Neo Barbería.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      <MessageCircle className="size-3.5" /> WhatsApp
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
