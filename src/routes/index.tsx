import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, Instagram, Lock, MapPin, Scissors, MessageCircle } from "lucide-react";
import { getBookingData } from "@/lib/public.functions";
import { waLink } from "@/lib/datetime";
import { SiteFooter } from "@/components/site-footer";
import portada from "@/assets/portada-david.png";

const bookingDataQuery = queryOptions({
  queryKey: ["booking-data"],
  queryFn: () => getBookingData(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neo Barbería — Reservá tu turno con David" },
      {
        name: "description",
        content:
          "Neo Barbería en Belgrano 3233, Neuquén Capital. Elegí servicio, día y horario y reservá tu turno con David en un minuto.",
      },
      { property: "og:title", content: "Neo Barbería — Reservá tu turno con David" },
      {
        property: "og:description",
        content: "Turnos online con David en Neo Barbería, Belgrano 3233, Neuquén Capital.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bookingDataQuery),
  component: Portada,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-muted-foreground">
        No pudimos cargar la información de la barbería. Probá recargar la página.
      </p>
    </main>
  ),
});

function Portada() {
  const { data } = useSuspenseQuery(bookingDataQuery);
  const { settings, services, professional } = data;

  return (
    <main className="mx-auto min-h-screen max-w-md pb-16">
      <section className="relative">
        <img
          src={portada}
          alt="David atendiendo en Neo Barbería"
          className="h-[62vh] w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7">
          <p className="font-display text-sm tracking-[0.35em] text-gold uppercase">
            {settings.address}
          </p>
          <h1 className="font-display text-5xl leading-none tracking-wide">
            <span className="text-gradient-fucsia">{settings.business_name}</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{settings.welcome_text}</p>
        </div>
      </section>

      <section className="px-6">
        <Link
          to="/reservar"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display text-2xl tracking-wide text-primary-foreground shadow-lg transition active:scale-[0.98]"
        >
          <Scissors className="size-5" /> Reservar turno
        </Link>

        <div className="card-neo mt-4 flex items-start gap-3 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-gold" />
          <p className="text-sm text-muted-foreground">
            Los turnos se atienden únicamente con <span className="text-foreground">{professional.name}</span>.
            Reservá con al menos {settings.min_advance_hours} h de anticipación.
          </p>
        </div>

        <h2 className="mt-8 font-display text-3xl tracking-wide">Servicios</h2>
        <ul className="mt-3 space-y-3">
          {services.map((s) => (
            <li key={s.id} className="card-neo p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{s.name}</h3>
                {s.show_price && s.price !== null ? (
                  <span className="font-display text-xl text-gold">
                    ${Number(s.price).toLocaleString("es-AR")}
                  </span>
                ) : null}
              </div>
              {s.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">{s.duration_min} minutos</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 font-display text-3xl tracking-wide">Dónde estamos</h2>
        <div className="card-neo mt-3 space-y-3 p-4 text-sm">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-gold" /> {settings.address}
          </p>
          <a
            href={waLink(settings.whatsapp, `Hola ${professional.name}, quería consultar por un turno.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold-outline flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium"
          >
            <MessageCircle className="size-4" /> Escribir por WhatsApp
          </a>
          {settings.instagram_url ? (
            <a
              href={settings.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-medium"
            >
              <Instagram className="size-4" /> Instagram
            </a>
          ) : null}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            to="/auth"
            aria-label="Acceso administrador"
            className="p-2 text-muted-foreground/40 transition-colors hover:text-muted-foreground"
          >
            <Lock className="size-4" />
          </Link>
        </div>

        <SiteFooter />
      </section>
    </main>
  );
}
