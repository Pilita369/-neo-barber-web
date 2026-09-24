import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Search } from "lucide-react";
import { createBenefit } from "@/lib/benefits.functions";
import { listClients } from "@/lib/clients.functions";
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
import { buildBenefitWhatsAppMessage } from "@/lib/messages";
import {
  BENEFIT_DEFAULT_VALID_DAYS,
  benefitDisplayBig,
  benefitDisplayTitle,
  type BenefitKind,
} from "@/lib/loyalty";
import type { Service } from "@/lib/types";

type ClienteFijo = { id: string; name: string; lastname: string | null; phone_e164: string };

const KIND_OPTIONS: { value: BenefitKind; label: string }[] = [
  { value: "percent_20", label: "20% de descuento" },
  { value: "percent_50", label: "50% de descuento" },
  { value: "free_cut", label: "Corte gratis" },
  { value: "percent_custom", label: "Otro porcentaje…" },
  { value: "amount_off", label: "Monto fijo de descuento" },
  { value: "prepaid_gift", label: "Voucher regalo (servicio ya abonado)" },
];

export function BeneficioDialog({
  open,
  onOpenChange,
  clienteFijo,
  services,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteFijo?: ClienteFijo;
  services: Service[];
  onCreated?: () => void;
}) {
  const createFn = useServerFn(createBenefit);
  const listClientsFn = useServerFn(listClients);
  const today = todayBA();
  const activos = services.filter((s) => s.active);

  const [busqueda, setBusqueda] = useState("");
  const [destName, setDestName] = useState("");
  const [destLastname, setDestLastname] = useState("");
  const [destPhone, setDestPhone] = useState("");
  const [destClientId, setDestClientId] = useState<string | null>(null);
  const [kind, setKind] = useState<BenefitKind>("percent_20");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<{ token: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusqueda("");
    setDestName(clienteFijo?.name ?? "");
    setDestLastname(clienteFijo?.lastname ?? "");
    setDestPhone(clienteFijo?.phone_e164 ?? "");
    setDestClientId(clienteFijo?.id ?? null);
    setKind("percent_20");
    setDiscountPercent("");
    setDiscountAmount("");
    setServiceId("");
    setTitle("");
    setMessage("");
    setValidUntil(addDays(today, BENEFIT_DEFAULT_VALID_DAYS));
    setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset al abrir, no en cada cambio de props
  }, [open]);

  const busquedaQuery = useQuery({
    queryKey: ["beneficio-busqueda", busqueda],
    queryFn: () => listClientsFn({ data: { search: busqueda } }),
    enabled: !clienteFijo && busqueda.trim().length >= 2,
  });

  const servicioElegido = activos.find((s) => s.id === serviceId);
  const big = benefitDisplayBig({
    kind,
    discount_percent: discountPercent ? Number(discountPercent) : null,
    discount_amount: discountAmount ? Number(discountAmount) : null,
  });

  async function crear() {
    if (!destName.trim() || !destPhone.trim()) {
      toast.error("Completá el destinatario");
      return;
    }
    if (!validUntil) {
      toast.error("Elegí una fecha de vencimiento");
      return;
    }
    if (kind === "percent_custom" && !discountPercent) {
      toast.error("Ingresá el porcentaje");
      return;
    }
    if (kind === "amount_off" && !discountAmount) {
      toast.error("Ingresá el monto");
      return;
    }
    if (kind === "prepaid_gift" && !serviceId) {
      toast.error("Elegí el servicio del voucher");
      return;
    }
    setSaving(true);
    try {
      const res = await createFn({
        data: {
          ...(destClientId
            ? { clientId: destClientId }
            : { newClient: { name: destName.trim(), lastname: destLastname.trim() || undefined, phone: destPhone.trim() } }),
          kind,
          discountPercent: kind === "percent_custom" ? Number(discountPercent) : undefined,
          discountAmount: kind === "amount_off" ? Number(discountAmount) : undefined,
          serviceId: serviceId || undefined,
          title: title.trim() || undefined,
          message: message.trim() || undefined,
          validUntil,
        },
      });
      setResultado(res);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el beneficio");
    }
    setSaving(false);
  }

  const link = resultado && typeof window !== "undefined" ? `${window.location.origin}/beneficio/${resultado.token}` : "";
  const mensajeWa = buildBenefitWhatsAppMessage({
    clientName: destName,
    title: title || null,
    big,
    message: message || null,
    link,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resultado ? "Beneficio creado" : "Crear beneficio"}</DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {destName} {destLastname} · {benefitDisplayTitle(
                { kind, discount_percent: discountPercent ? Number(discountPercent) : null, discount_amount: discountAmount ? Number(discountAmount) : null },
                servicioElegido?.name,
              )}
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={waLink(destPhone, mensajeWa)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
              >
                <MessageCircle className="size-4" /> Enviar por WhatsApp
              </a>
              <a
                href={`/beneficio/${resultado.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold-outline flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
              >
                Ver tarjeta
              </a>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full text-center text-xs text-muted-foreground underline"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {!clienteFijo ? (
                <div>
                  <Label htmlFor="benef-buscar">Buscar cliente existente</Label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
                    <Search className="size-4 text-muted-foreground" />
                    <input
                      id="benef-buscar"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Nombre o WhatsApp"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  {busquedaQuery.data && busquedaQuery.data.length > 0 ? (
                    <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                      {busquedaQuery.data.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setDestClientId(c.id);
                              setDestName(c.name);
                              setDestLastname(c.lastname ?? "");
                              setDestPhone(c.phone_e164);
                              setBusqueda("");
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            {c.name} {c.lastname ?? ""} · {c.phone_e164}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="benef-nombre">Nombre</Label>
                      <Input
                        id="benef-nombre"
                        value={destName}
                        onChange={(e) => {
                          setDestClientId(null);
                          setDestName(e.target.value);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="benef-apellido">Apellido</Label>
                      <Input
                        id="benef-apellido"
                        value={destLastname}
                        onChange={(e) => setDestLastname(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label htmlFor="benef-telefono">WhatsApp</Label>
                    <Input
                      id="benef-telefono"
                      value={destPhone}
                      onChange={(e) => {
                        setDestClientId(null);
                        setDestPhone(e.target.value);
                      }}
                      placeholder="299 XXX XXXX"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Para {clienteFijo.name} {clienteFijo.lastname ?? ""} · {clienteFijo.phone_e164}
                </p>
              )}

              <div>
                <Label htmlFor="benef-kind">Beneficio</Label>
                <select
                  id="benef-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as BenefitKind)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              {kind === "percent_custom" ? (
                <div>
                  <Label htmlFor="benef-percent">Porcentaje</Label>
                  <Input
                    id="benef-percent"
                    type="number"
                    min={1}
                    max={99}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="Ej: 30"
                  />
                </div>
              ) : null}
              {kind === "amount_off" ? (
                <div>
                  <Label htmlFor="benef-amount">Monto ($)</Label>
                  <Input
                    id="benef-amount"
                    type="number"
                    min={1}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                  />
                </div>
              ) : null}

              <div>
                <Label htmlFor="benef-service">
                  Servicio {kind === "prepaid_gift" ? "" : "(opcional)"}
                </Label>
                <select
                  id="benef-service"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">{kind === "prepaid_gift" ? "Elegí un servicio" : "Cualquiera"}</option>
                  {activos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="benef-title">Título (opcional)</Label>
                <Input
                  id="benef-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Feliz cumple"
                  maxLength={60}
                />
              </div>
              <div>
                <Label htmlFor="benef-message">Mensaje (opcional)</Label>
                <textarea
                  id="benef-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <Label htmlFor="benef-valid">Válido hasta</Label>
                <Input
                  id="benef-valid"
                  type="date"
                  min={today}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
