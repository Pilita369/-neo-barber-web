import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Gift, MessageCircle } from "lucide-react";
import { createBenefit, markBenefitSent } from "@/lib/benefits.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, todayBA, waLink } from "@/lib/datetime";
import {
  BENEFIT_DEFAULT_VALID_DAYS,
  BENEFIT_KINDS,
  BENEFIT_LABEL,
  BENEFIT_STATUS_LABEL,
  effectiveBenefitStatus,
  type BenefitKind,
} from "@/lib/loyalty";
import type { ClientBenefit } from "@/lib/types";

function fechaCorta(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ClientBenefits({
  clientId,
  clientName,
  phone,
  benefits,
  visitasMes,
  canCreate,
  onChanged,
}: {
  clientId: string;
  clientName: string;
  phone: string;
  benefits: ClientBenefit[];
  visitasMes: number;
  canCreate: boolean;
  onChanged: () => void;
}) {
  const createFn = useServerFn(createBenefit);
  const sentFn = useServerFn(markBenefitSent);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<BenefitKind>("percent_20");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const today = todayBA();

  function abrir() {
    setKind("percent_20");
    setValidUntil(addDays(today, BENEFIT_DEFAULT_VALID_DAYS));
    setOpen(true);
  }

  async function crear() {
    if (!validUntil) {
      toast.error("Elegí una fecha de vencimiento");
      return;
    }
    setSaving(true);
    try {
      await createFn({ data: { clientId, kind, validUntil } });
      toast.success("Beneficio creado");
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el beneficio");
    }
    setSaving(false);
  }

  async function enviar(b: ClientBenefit) {
    const link = `${window.location.origin}/beneficio/${b.token}`;
    const nombre = clientName.trim().split(/\s+/)[0];
    const msg = `¡Hola, ${nombre}! 💈 Gracias por elegir Neo Barbería. Ya sumaste ${visitasMes} visitas este mes y David tiene un beneficio para vos: ${BENEFIT_LABEL[b.kind].big} en tu próximo corte. Podés verlo y reservar acá: ${link}`;
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
        {canCreate ? (
          <button
            onClick={abrir}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Gift className="size-3.5" /> Crear beneficio
          </button>
        ) : null}
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
                  <p className="font-semibold">{BENEFIT_LABEL[b.kind].title}</p>
                  <span
                    className={`text-xs ${estado === "activo" ? "text-gold" : "text-muted-foreground"}`}
                  >
                    {BENEFIT_STATUS_LABEL[estado]}
                  </span>
                </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear beneficio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {BENEFIT_KINDS.map((k) => (
                <label
                  key={k}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                    kind === k ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="benefit-kind"
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  {BENEFIT_LABEL[k].title}
                </label>
              ))}
            </div>
            <div>
              <Label htmlFor="benefit-valid">Válido hasta</Label>
              <Input
                id="benefit-valid"
                type="date"
                min={today}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Por defecto {BENEFIT_DEFAULT_VALID_DAYS} días desde hoy.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={crear}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Crear
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
