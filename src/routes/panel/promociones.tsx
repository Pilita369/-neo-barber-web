import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { listServices } from "@/lib/admin.functions";
import { PanelNav } from "@/components/panel-nav";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePanelAuth } from "@/lib/use-panel-auth";
import type { Service } from "@/lib/types";
import logoNeo from "@/assets/logo-neo.png";

export const Route = createFileRoute("/panel/promociones")({
  head: () => ({ meta: [{ title: "Promociones — Neo Barbería" }] }),
  component: PromocionesPage,
});

function PromocionesPage() {
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

  return <Promociones onCerrarSesion={cerrarSesion} />;
}

const MAX_TITULO = 24;
const MAX_FRASE = 40;
const MAX_BENEFICIO = 30;
const MAX_VIGENCIA = 30;
const MAX_CTA = 24;

function Promociones({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const listServicesFn = useServerFn(listServices);
  const servicesQuery = useQuery({
    queryKey: ["servicios"],
    queryFn: () => listServicesFn() as Promise<Service[]>,
  });

  const [titulo, setTitulo] = useState("DOMINGO NEO");
  const [frase, setFrase] = useState("Hoy te toca renovarte");
  const [beneficio, setBeneficio] = useState("Beneficio especial");
  const [vigencia, setVigencia] = useState("Solo hoy");
  const [serviceId, setServiceId] = useState("");
  const [cta, setCta] = useState("Reservá tu turno");

  const servicio = (servicesQuery.data ?? []).find((s) => s.id === serviceId);

  return (
    <>
      <PanelNav onCerrarSesion={onCerrarSesion} />
      <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-6">
        <header>
          <h1 className="font-display text-3xl tracking-wide">Promociones</h1>
          <p className="text-xs text-muted-foreground">
            Armá una imagen para compartir en WhatsApp o redes. Es una pieza pública y genérica: no
            reemplaza los beneficios individuales de la ficha de cada cliente.
          </p>
        </header>

        <div className="mt-4 flex justify-center">
          <PromoCard
            titulo={titulo}
            frase={frase}
            beneficio={beneficio}
            vigencia={vigencia}
            servicioNombre={servicio?.name ?? null}
            cta={cta}
          />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Sacá una captura de pantalla de la tarjeta para subirla a tu estado de WhatsApp o Instagram.
        </p>

        <section className="card-neo mt-6 space-y-4 p-4">
          <h2 className="font-display text-lg tracking-wide text-gold">Contenido</h2>
          <div>
            <Label htmlFor="promo-titulo">Título</Label>
            <Input
              id="promo-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value.slice(0, MAX_TITULO))}
              placeholder="Ej: DOMINGO NEO"
            />
          </div>
          <div>
            <Label htmlFor="promo-frase">Frase secundaria</Label>
            <Input
              id="promo-frase"
              value={frase}
              onChange={(e) => setFrase(e.target.value.slice(0, MAX_FRASE))}
              placeholder="Ej: Hoy te toca renovarte"
            />
          </div>
          <div>
            <Label htmlFor="promo-beneficio">Beneficio / promoción</Label>
            <Input
              id="promo-beneficio"
              value={beneficio}
              onChange={(e) => setBeneficio(e.target.value.slice(0, MAX_BENEFICIO))}
              placeholder='Ej: "20% OFF" o "Traé un amigo"'
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Texto libre: vos elegís si mostrás el número exacto o no.
            </p>
          </div>
          <div>
            <Label htmlFor="promo-vigencia">Vigencia</Label>
            <Input
              id="promo-vigencia"
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value.slice(0, MAX_VIGENCIA))}
              placeholder="Ej: Solo hoy, Todo septiembre"
            />
          </div>
          <div>
            <Label htmlFor="promo-servicio">Servicio (opcional)</Label>
            <select
              id="promo-servicio"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Sin servicio específico</option>
              {(servicesQuery.data ?? [])
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label htmlFor="promo-cta">Llamado a la acción</Label>
            <Input
              id="promo-cta"
              value={cta}
              onChange={(e) => setCta(e.target.value.slice(0, MAX_CTA))}
              placeholder="Ej: Reservá tu turno"
            />
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}

function PromoCard({
  titulo,
  frase,
  beneficio,
  vigencia,
  servicioNombre,
  cta,
}: {
  titulo: string;
  frase: string;
  beneficio: string;
  vigencia: string;
  servicioNombre: string | null;
  cta: string;
}) {
  return (
    <div
      className="relative flex aspect-[9/16] w-full max-w-[320px] flex-col justify-between overflow-hidden rounded-3xl border border-gold/50 bg-card p-6 text-center shadow-2xl"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 0%, oklch(0.62 0.24 350 / 0.28), transparent 55%), radial-gradient(circle at 50% 100%, oklch(0.79 0.13 88 / 0.15), transparent 55%)",
      }}
    >
      <div>
        <img
          src={logoNeo}
          alt="Neo Barbería"
          width={96}
          height={96}
          draggable={false}
          className="mx-auto size-24 object-contain"
        />
        <p className="mt-2 pl-[0.35em] font-display text-xs tracking-[0.35em] text-gold">NEO BARBERÍA</p>
        <h2 className="mt-5 break-words font-display text-4xl leading-none tracking-wide">
          <span className="text-gradient-fucsia">{titulo || "NEO BARBERÍA"}</span>
        </h2>
        {frase ? <p className="mt-3 text-base text-muted-foreground">{frase}</p> : null}
      </div>

      <div className="mx-auto w-full">
        {beneficio ? (
          <p className="break-words font-display text-3xl leading-tight tracking-wide text-gold">
            {beneficio}
          </p>
        ) : null}
        {servicioNombre ? (
          <p className="mt-2 text-sm text-muted-foreground">Válido para: {servicioNombre}</p>
        ) : null}
        {vigencia ? <p className="mt-1 text-xs text-muted-foreground">{vigencia}</p> : null}
        <div className="mx-auto mt-4 h-px w-16 bg-gold/40" />
        <p className="mt-4 font-display text-xl tracking-wide">{cta || "Reservá tu turno"}</p>
      </div>
    </div>
  );
}
