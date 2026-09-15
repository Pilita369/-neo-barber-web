import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import {
  getAvailability,
  getAvailableDays,
  getBookingData,
  createAppointment,
} from "@/lib/public.functions";
import { diaCorto, diaNumero, fechaLarga } from "@/lib/datetime";
import type { Service } from "@/lib/types";

const bookingDataQuery = queryOptions({
  queryKey: ["booking-data"],
  queryFn: () => getBookingData(),
});

export const Route = createFileRoute("/reservar")({
  head: () => ({
    meta: [
      { title: "Reservar turno — Neo Barbería" },
      {
        name: "description",
        content:
          "Elegí servicio, día y horario y confirmá tu turno con David en Neo Barbería, Neuquén Capital.",
      },
      { property: "og:title", content: "Reservar turno — Neo Barbería" },
      {
        property: "og:description",
        content: "Elegí servicio, día y horario y confirmá tu turno con David.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bookingDataQuery),
  component: Reservar,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-muted-foreground">No pudimos abrir la agenda. Probá recargar la página.</p>
    </main>
  ),
});

const PASOS = ["Servicio", "Día", "Horario", "Tus datos"];

function Reservar() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(bookingDataQuery);
  const { services, settings, professional } = data;

  const [step, setStep] = useState(0);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", lastname: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const crear = useServerFn(createAppointment);

  const diasQuery = useQuery({
    queryKey: ["dias", service?.id],
    queryFn: () => getAvailableDays({ data: { serviceId: service!.id } }),
    enabled: Boolean(service),
  });

  const horariosQuery = useQuery({
    queryKey: ["horarios", service?.id, date],
    queryFn: () => getAvailability({ data: { serviceId: service!.id, date: date! } }),
    enabled: Boolean(service && date),
  });

  function volver() {
    if (step === 0) navigate({ to: "/" });
    else setStep(step - 1);
  }

  async function confirmar() {
    if (!service || !date || !time) return;
    if (form.name.trim().length < 2 || form.lastname.trim().length < 2) {
      toast.error("Completá tu nombre y apellido");
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 8) {
      toast.error("Ingresá un número de WhatsApp válido");
      return;
    }
    setSaving(true);
    try {
      const res = await crear({
        data: {
          serviceId: service.id,
          date,
          time,
          name: form.name.trim(),
          lastname: form.lastname.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || undefined,
        },
      });
      if (res.needsApproval) {
        toast.info(
          "Ya tenés un turno activo. Este pedido queda pendiente de que David lo confirme.",
        );
      } else {
        toast.success("¡Turno reservado!");
      }
      navigate({ to: "/turno/$token", params: { token: res.token } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reservar el turno");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-24 pt-5">
      <header className="flex items-center gap-3">
        <button
          onClick={volver}
          aria-label="Volver"
          className="rounded-full border border-border p-2"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="font-display text-3xl leading-none tracking-wide">Reservar turno</h1>
          <p className="text-xs text-muted-foreground">
            Con {professional.name} · {settings.address}
          </p>
        </div>
      </header>

      <ol className="mt-5 flex gap-1.5" aria-label="Progreso">
        {PASOS.map((p, i) => (
          <li key={p} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />
            <span
              className={`mt-1.5 block text-[11px] ${i === step ? "text-foreground" : "text-muted-foreground"}`}
            >
              {p}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="font-display text-2xl tracking-wide">Elegí el servicio</h2>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setService(s);
                setDate(null);
                setTime(null);
                setStep(1);
              }}
              className="card-neo block w-full p-4 text-left transition active:scale-[0.99]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{s.name}</span>
                {s.show_price && s.price !== null ? (
                  <span className="font-display text-lg text-gold">
                    ${Number(s.price).toLocaleString("es-AR")}
                  </span>
                ) : null}
              </div>
              {s.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">{s.duration_min} minutos</p>
            </button>
          ))}
        </section>
      )}

      {step === 1 && (
        <section className="mt-6">
          <h2 className="font-display text-2xl tracking-wide">Elegí el día</h2>
          {diasQuery.isPending ? (
            <Cargando />
          ) : (diasQuery.data?.days.length ?? 0) === 0 ? (
            <Vacio texto="Por ahora no hay días con horarios libres. Escribinos por WhatsApp." />
          ) : (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {diasQuery.data!.days.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDate(d);
                    setTime(null);
                    setStep(2);
                  }}
                  className={`card-neo px-2 py-3 text-center ${date === d ? "ring-2 ring-primary" : ""}`}
                >
                  <span className="block text-[11px] text-muted-foreground">{diaCorto(d)}</span>
                  <span className="font-display text-2xl leading-none">{diaNumero(d)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 2 && date && (
        <section className="mt-6">
          <h2 className="font-display text-2xl tracking-wide">Elegí el horario</h2>
          <p className="mt-1 text-sm text-muted-foreground">{fechaLarga(date)}</p>
          {horariosQuery.isPending ? (
            <Cargando />
          ) : (horariosQuery.data?.slots.length ?? 0) === 0 ? (
            <Vacio texto="Ese día se completó. Elegí otro día." />
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {horariosQuery.data!.slots.map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    setTime(h);
                    setStep(3);
                  }}
                  className={`card-neo py-3 font-display text-xl ${time === h ? "ring-2 ring-primary" : ""}`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 3 && service && date && time && (
        <section className="mt-6 space-y-4">
          <h2 className="font-display text-2xl tracking-wide">Tus datos</h2>
          <div className="card-neo p-4 text-sm">
            <p className="font-semibold">{service.name}</p>
            <p className="text-muted-foreground">
              {fechaLarga(date)} a las {time} h
            </p>
          </div>

          <Campo
            label="Nombre"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            maxLength={60}
            autoComplete="given-name"
          />
          <Campo
            label="Apellido"
            value={form.lastname}
            onChange={(v) => setForm({ ...form, lastname: v })}
            maxLength={60}
            autoComplete="family-name"
          />
          <Campo
            label="WhatsApp"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            maxLength={20}
            inputMode="tel"
            autoComplete="tel"
            placeholder="299 621 3688"
          />
          <label className="block">
            <span className="text-sm text-muted-foreground">Comentario (opcional)</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={300}
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <button
            onClick={confirmar}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display text-2xl tracking-wide text-primary-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
            Confirmar turno
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Podés cancelar online hasta {settings.cancel_hours_limit} h antes del turno.
          </p>
        </section>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm text-muted-foreground underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

function Campo(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  inputMode?: "tel" | "text";
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{props.label}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        maxLength={props.maxLength}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function Cargando() {
  return (
    <div className="mt-6 flex justify-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="card-neo mt-4 p-4 text-sm text-muted-foreground">{texto}</p>;
}
