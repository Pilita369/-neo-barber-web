import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageCircle, Search } from "lucide-react";
import { createManualAppointment } from "@/lib/admin.functions";
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
import { fechaLarga, waLink } from "@/lib/datetime";
import { formatARS } from "@/lib/format";
import { buildTurnoConfirmationMessage } from "@/lib/messages";
import type { Service } from "@/lib/types";

type ClienteInicial = { name: string; lastname: string | null; phone_e164: string } | null;

export function NuevoTurnoDialog({
  open,
  onOpenChange,
  services,
  clienteInicial,
  paymentAlias,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  clienteInicial?: ClienteInicial;
  paymentAlias?: string | null | undefined;
  onCreated?: () => void;
}) {
  const activos = services.filter((s) => s.active);
  const createFn = useServerFn(createManualAppointment);
  const listClientsFn = useServerFn(listClients);

  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<{ token: string; price_at_booking: number | null } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setName(clienteInicial?.name ?? "");
    setLastname(clienteInicial?.lastname ?? "");
    setPhone(clienteInicial?.phone_e164 ?? "");
    setServiceId(activos[0]?.id ?? "");
    setDate("");
    setTime("");
    setBusqueda("");
    setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset al abrir, no en cada cambio de props
  }, [open]);

  const busquedaQuery = useQuery({
    queryKey: ["nuevo-turno-busqueda", busqueda],
    queryFn: () => listClientsFn({ data: { search: busqueda } }),
    enabled: !clienteInicial && busqueda.trim().length >= 2,
  });

  const servicioElegido = activos.find((s) => s.id === serviceId);

  async function crear() {
    if (!name.trim() || !phone.trim() || !serviceId || !date || !time) {
      toast.error("Completá cliente, servicio, fecha y horario");
      return;
    }
    setSaving(true);
    try {
      const res = await createFn({
        data: {
          serviceId,
          date,
          time,
          name: name.trim(),
          lastname: lastname.trim() || "-",
          phone: phone.trim(),
        },
      });
      setResultado(res);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el turno");
    }
    setSaving(false);
  }

  const linkTurno =
    resultado && typeof window !== "undefined"
      ? `${window.location.origin}/turno/${resultado.token}`
      : "";
  const mensajeWa = buildTurnoConfirmationMessage({
    clientName: name,
    serviceName: servicioElegido?.name ?? "",
    date,
    time,
    price: resultado?.price_at_booking ?? null,
    paymentAlias,
    link: linkTurno,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resultado ? "Turno creado" : "Nuevo turno"}</DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {name} {lastname} · {servicioElegido?.name} · {fechaLarga(date)} a las {time} h.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={waLink(phone, mensajeWa)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
              >
                <MessageCircle className="size-4" /> Enviar turno por WhatsApp
              </a>
              <a
                href={`/turno/${resultado.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold-outline flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
              >
                Ver turno
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
              {!clienteInicial ? (
                <div>
                  <Label htmlFor="turno-buscar">Buscar cliente existente</Label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
                    <Search className="size-4 text-muted-foreground" />
                    <input
                      id="turno-buscar"
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
                              setName(c.name);
                              setLastname(c.lastname ?? "");
                              setPhone(c.phone_e164);
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
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="turno-name">Nombre</Label>
                  <Input id="turno-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="turno-lastname">Apellido</Label>
                  <Input
                    id="turno-lastname"
                    value={lastname}
                    onChange={(e) => setLastname(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="turno-phone">WhatsApp</Label>
                <Input
                  id="turno-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="299 XXX XXXX"
                />
              </div>
              <div>
                <Label htmlFor="turno-service">Servicio</Label>
                <select
                  id="turno-service"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {activos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.price !== null ? ` · ${formatARS(s.price)}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="turno-date">Fecha</Label>
                  <Input
                    id="turno-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="turno-time">Horario</Label>
                  <Input
                    id="turno-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={crear}
                disabled={saving || activos.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Crear turno
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
