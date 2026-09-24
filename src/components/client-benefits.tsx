import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gift, Loader2, MessageCircle } from "lucide-react";
import { cancelBenefit, markBenefitSent, markBenefitUsed } from "@/lib/benefits.functions";
import { todayBA, waLink } from "@/lib/datetime";
import { buildBenefitWhatsAppMessage } from "@/lib/messages";
import {
  BENEFIT_STATUS_LABEL,
  benefitDisplayBig,
  benefitDisplayTitle,
  effectiveBenefitStatus,
} from "@/lib/loyalty";
import { BeneficioDialog } from "@/components/beneficio-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ClientBenefit, Service } from "@/lib/types";

function fechaCorta(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** timestamptz -> "dd/mm/aaaa hh:mm" en hora de Buenos Aires */
function fechaHora(ts: string) {
  return new Date(ts).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type Accion = { tipo: "usar" | "cancelar"; benefit: ClientBenefit; vencido: boolean };

export function ClientBenefits({
  clientId,
  clientName,
  clientLastname,
  phone,
  benefits,
  services,
  onChanged,
}: {
  clientId: string;
  clientName: string;
  clientLastname: string | null;
  phone: string;
  benefits: ClientBenefit[];
  services: Service[];
  onChanged: () => void;
}) {
  const sentFn = useServerFn(markBenefitSent);
  const usedFn = useServerFn(markBenefitUsed);
  const cancelFn = useServerFn(cancelBenefit);
  const [open, setOpen] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const today = todayBA();

  async function confirmarAccion() {
    if (!accion) return;
    setProcesando(true);
    try {
      if (accion.tipo === "usar") {
        await usedFn({ data: { benefitId: accion.benefit.id } });
        toast.success("Beneficio marcado como utilizado");
      } else {
        await cancelFn({ data: { benefitId: accion.benefit.id } });
        toast.success("Beneficio cancelado");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el beneficio", {
        duration: 10000,
      });
    } finally {
      setProcesando(false);
      setAccion(null);
      onChanged();
    }
  }

  async function enviar(b: ClientBenefit) {
    const link = `${window.location.origin}/beneficio/${b.token}`;
    const msg = buildBenefitWhatsAppMessage({
      clientName,
      title: b.title,
      big: benefitDisplayBig(b),
      message: b.message,
      link,
    });
    window.open(waLink(phone, msg), "_blank", "noopener,noreferrer");
    try {
      await sentFn({ data: { benefitId: b.id } });
      onChanged();
    } catch {
      // el envio ya se abrio; el registro de fecha es secundario
    }
  }

  return (
    <section className="card-neo mt-4 space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg tracking-wide text-gold">Beneficios</h2>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Gift className="size-3.5" /> Crear beneficio
        </button>
      </div>

      {benefits.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no tiene beneficios.</p>
      ) : (
        <ul className="space-y-2">
          {benefits.map((b) => {
            const estado = effectiveBenefitStatus(b.status, b.valid_until, today);
            return (
              <li key={b.id} className="rounded-lg border border-border p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">
                    {b.title ? `${b.title} — ` : ""}
                    {benefitDisplayTitle(b, b.service_name)}
                  </p>
                  <span
                    className={`text-xs ${estado === "activo" ? "text-gold" : "text-muted-foreground"}`}
                  >
                    {BENEFIT_STATUS_LABEL[estado]}
                  </span>
                </div>
                {b.message ? <p className="mt-1 text-xs text-muted-foreground">{b.message}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Vence el {fechaCorta(b.valid_until)}
                  {b.sent_at ? ` · Enviado el ${fechaCorta(b.sent_at.slice(0, 10))}` : ""}
                </p>
                {estado === "usado" && b.used_at ? (
                  <p className="mt-1 text-xs">Utilizado el {fechaHora(b.used_at)}</p>
                ) : null}
                {estado === "cancelado" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cancelado{b.cancelled_at ? ` el ${fechaHora(b.cancelled_at)}` : ""} · sin posibilidad de
                    canje
                  </p>
                ) : null}
                {estado === "vencido" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Vencido · sin posibilidad de canje</p>
                ) : null}
                {estado === "activo" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => enviar(b)}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >
                      <MessageCircle className="size-3.5" /> Enviar beneficio por WhatsApp
                    </button>
                    <a
                      href={`/beneficio/${b.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold-outline rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      Ver tarjeta
                    </a>
                    <button
                      onClick={() => setAccion({ tipo: "usar", benefit: b, vencido: false })}
                      className="btn-gold-outline rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      Marcar como utilizado
                    </button>
                    <button
                      onClick={() => setAccion({ tipo: "cancelar", benefit: b, vencido: false })}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                    >
                      Cancelar beneficio
                    </button>
                  </div>
                ) : null}
                {estado === "vencido" ? (
                  <div className="mt-2">
                    <button
                      onClick={() => setAccion({ tipo: "cancelar", benefit: b, vencido: true })}
                      className="rounded-lg py-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                    >
                      Cancelar beneficio
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <BeneficioDialog
        open={open}
        onOpenChange={setOpen}
        clienteFijo={{ id: clientId, name: clientName, lastname: clientLastname, phone_e164: phone }}
        services={services}
        onCreated={onChanged}
      />

      <AlertDialog open={accion !== null} onOpenChange={(v) => !v && !procesando && setAccion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accion?.tipo === "usar" ? "Marcar como utilizado" : "Cancelar beneficio"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accion?.tipo === "usar"
                ? "Confirmá que el cliente ya recibió este beneficio. Quedará como usado en su historial y no se podrá volver a canjear."
                : accion?.vencido
                  ? "El beneficio ya venció y nunca se usó. Se marcará como cancelado para ordenar el historial."
                  : "El beneficio dejará de ser válido de inmediato y su enlace ya no servirá para reservar. No cuenta como utilizado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={procesando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarAccion();
              }}
            >
              {procesando ? <Loader2 className="size-4 animate-spin" /> : null}
              {accion?.tipo === "usar" ? "Marcar como utilizado" : "Cancelar beneficio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
