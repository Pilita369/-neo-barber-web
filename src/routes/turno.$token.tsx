import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPin, MessageCircle } from "lucide-react";
import { cancelAppointmentByToken, getAppointmentByToken } from "@/lib/public.functions";
import { fechaLarga, waLink } from "@/lib/datetime";
import { ESTADOS } from "@/lib/types";

export const Route = createFileRoute("/turno/$token")({
  head: () => ({
    meta: [
      { title: "Tu turno — Neo Barbería" },
      {
        name: "description",
        content: "Consultá el detalle de tu turno en Neo Barbería y cancelalo si no podés asistir.",
      },
      { property: "og:title", content: "Tu turno — Neo Barbería" },
      { property: "og:description", content: "Detalle y cancelación de tu turno en Neo Barbería." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TurnoPage,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-muted-foreground">No pudimos abrir tu turno. Probá recargar la página.</p>
    </main>
  ),
});

function TurnoPage() {
  const { token } = Route.useParams();
  const cancelar = useServerFn(cancelAppointmentByToken);
  const [cancelando, setCancelando] = useState(false);

  const q = useQuery({
    queryKey: ["turno", token],
    queryFn: () => getAppointmentByToken({ data: { token } }),
  });

  if (q.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const appointment = q.data?.appointment;
  const settings = q.data?.settings;
  if (!appointment || !settings) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">No encontramos este turno.</p>
        <Link to="/" className="text-primary underline">
          Ir al inicio
        </Link>
      </main>
    );
  }

  const activo = appointment.status === "pendiente" || appointment.status === "confirmado";
  const pendienteAutorizacion = activo && appointment.needs_approval;
  const cancelado = appointment.status === "cancelado";

  async function onCancelar() {
    setCancelando(true);
    try {
      await cancelar({ data: { token } });
      toast.success("Turno cancelado");
      await q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cancelar el turno");
    }
    setCancelando(false);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-16 pt-8">
      {activo ? (
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-12 text-primary" />
          <h1 className="mt-3 font-display text-4xl tracking-wide">Turno reservado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Código {appointment.code} · {ESTADOS[appointment.status]}
          </p>
        </div>
      ) : (
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-wide">
            Turno {ESTADOS[appointment.status].toLowerCase()}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Código {appointment.code}</p>
        </div>
      )}

      {pendienteAutorizacion ? (
        <div className="mt-5 rounded-xl border border-gold/40 bg-accent p-4 text-sm">
          <p className="font-semibold text-gold">Pendiente de autorización</p>
          <p className="mt-1 text-muted-foreground">
            Ya tenías otro turno activo, así que este necesita que {appointment.professional_name}{" "}
            lo confirme. Te avisamos por WhatsApp apenas se confirme, o podés cancelar tu turno
            anterior para agilizarlo.
          </p>
        </div>
      ) : null}

      <div className="card-neo mt-6 space-y-2 p-5">
        <p className="font-display text-2xl tracking-wide text-gold">{appointment.service_name}</p>
        <p className="text-sm">{fechaLarga(appointment.date)}</p>
        <p className="font-display text-3xl">{appointment.start_time} h</p>
        <p className="text-sm text-muted-foreground">
          {appointment.client_name} {appointment.client_lastname} · con{" "}
          {appointment.professional_name}
        </p>
        {appointment.notes ? (
          <p className="text-sm text-muted-foreground">Nota: {appointment.notes}</p>
        ) : null}
        <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
          <MapPin className="size-4 text-gold" /> {settings.address}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <a
          href={waLink(
            settings.whatsapp,
            cancelado
              ? `Hola, soy ${appointment.client_name} ${appointment.client_lastname}. Te aviso que cancelé mi turno del ${fechaLarga(appointment.date)} a las ${appointment.start_time} (código ${appointment.code}).`
              : `Hola, soy ${appointment.client_name} ${appointment.client_lastname}. Tengo turno el ${fechaLarga(appointment.date)} a las ${appointment.start_time} (código ${appointment.code}).`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold-outline flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium"
        >
          <MessageCircle className="size-4" />{" "}
          {cancelado ? "Avisar de la cancelación" : "Avisar por WhatsApp"}
        </a>

        {activo && q.data!.canModify ? (
          <button
            onClick={onCancelar}
            disabled={cancelando}
            className="w-full rounded-lg border border-destructive px-4 py-3 font-medium text-destructive disabled:opacity-60"
          >
            {cancelando ? "Cancelando…" : "Cancelar turno"}
          </button>
        ) : activo ? (
          <p className="text-center text-xs text-muted-foreground">
            Para cambios a menos de {settings.cancel_hours_limit} h del turno, escribinos por
            WhatsApp.
          </p>
        ) : null}

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
