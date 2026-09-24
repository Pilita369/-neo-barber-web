import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Scissors } from "lucide-react";
import { getBenefitPublic } from "@/lib/benefits.functions";
import { BENEFIT_STATUS_LABEL, benefitDisplayBig } from "@/lib/loyalty";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/beneficio/$token")({
  head: () => ({
    meta: [
      { title: "Tu beneficio — Neo Barbería" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BeneficioPage,
});

function fechaCorta(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function BeneficioPage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["beneficio", token],
    queryFn: () => getBenefitPublic({ data: { token } }),
    retry: false,
  });

  if (q.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const b = q.data?.benefit;
  if (!b) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">No encontramos este beneficio.</p>
        <Link to="/" className="text-primary underline">
          Ir al inicio
        </Link>
      </main>
    );
  }

  const activo = b.status === "activo";
  const subtitulo = b.kind === "prepaid_gift" ? "Voucher regalo" : "Beneficio exclusivo";

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-8">
      <div
        className={`overflow-hidden rounded-3xl border border-gold/50 bg-card p-7 text-center shadow-2xl ${
          activo ? "" : "opacity-60"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, oklch(0.62 0.24 350 / 0.25), transparent 60%)",
        }}
      >
        <p className="font-display text-sm tracking-[0.35em] text-gold">NEO BARBERÍA</p>
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {b.title || subtitulo}
        </p>
        {b.first_name ? (
          <p className="mt-4 font-display text-4xl tracking-wide">{b.first_name}</p>
        ) : null}
        <p className="mt-4 font-display text-5xl leading-none tracking-wide">
          <span className="text-gradient-fucsia">{benefitDisplayBig(b)}</span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {b.service_name ? `Válido para: ${b.service_name}` : "En tu próximo corte"}
        </p>
        {b.message ? <p className="mt-3 text-sm">{b.message}</p> : null}
        <div className="mx-auto mt-6 h-px w-24 bg-gold/40" />
        <p className="mt-4 text-sm">
          Válido hasta{" "}
          <span className="font-semibold text-gold">{fechaCorta(b.valid_until)}</span>
        </p>
        {!activo ? (
          <p className="mt-3 inline-block rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
            {BENEFIT_STATUS_LABEL[b.status]}
          </p>
        ) : null}
      </div>

      {activo ? (
        <>
          <Link
            to="/reservar"
            search={{ beneficio: token }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display text-2xl tracking-wide text-primary-foreground shadow-lg transition active:scale-[0.98]"
          >
            <Scissors className="size-5" /> Reservar turno
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Al reservar, usá el mismo WhatsApp al que te llegó este beneficio. Es de un solo uso.
          </p>
        </>
      ) : (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Este beneficio ya no se puede usar.
        </p>
      )}

      <SiteFooter />
    </main>
  );
}
