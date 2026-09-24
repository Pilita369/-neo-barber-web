import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, MessageCircle } from "lucide-react";
import { markBenefitSent } from "@/lib/benefits.functions";
import { todayBA, waLink } from "@/lib/datetime";
import { buildBenefitWhatsAppMessage } from "@/lib/messages";
import {
  BENEFIT_STATUS_LABEL,
  benefitDisplayBig,
  benefitDisplayTitle,
  effectiveBenefitStatus,
} from "@/lib/loyalty";
import { BeneficioDialog } from "@/components/beneficio-dialog";
import type { ClientBenefit, Service } from "@/lib/types";

function fechaCorta(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

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
  const [open, setOpen] = useState(false);
  const today = todayBA();

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
                  {b.used_at ? ` · Usado el ${fechaCorta(b.used_at.slice(0, 10))}` : ""}
                </p>
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
    </section>
  );
}
