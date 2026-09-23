import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { listServices, upsertService, deleteService, getSettings, saveSettings } from "@/lib/admin.functions";
import { PanelNav } from "@/components/panel-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatARS } from "@/lib/format";
import { usePanelAuth } from "@/lib/use-panel-auth";
import type { Service, Settings } from "@/lib/types";

export const Route = createFileRoute("/panel/servicios")({
  head: () => ({ meta: [{ title: "Servicios — Neo Barbería" }] }),
  component: ServiciosPage,
});

function ServiciosPage() {
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

  return <Servicios onCerrarSesion={cerrarSesion} />;
}

type FormState = {
  id?: string;
  description: string | null;
  buffer_min: number;
  name: string;
  duration_min: string;
  price: string;
  show_price: boolean;
  active: boolean;
};

const emptyForm: FormState = {
  description: null,
  buffer_min: 0,
  name: "",
  duration_min: "30",
  price: "",
  show_price: true,
  active: true,
};

function AliasPagoCard() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getSettings);
  const saveSettingsFn = useServerFn(saveSettings);
  const [alias, setAlias] = useState("");
  const [saving, setSaving] = useState(false);

  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettingsFn() as Promise<Settings> });

  useEffect(() => {
    if (q.data) setAlias(q.data.payment_alias ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar el primer valor
  }, [q.data?.payment_alias]);

  async function guardar() {
    if (!q.data) return;
    setSaving(true);
    try {
      await saveSettingsFn({
        data: {
          business_name: q.data.business_name,
          address: q.data.address,
          whatsapp: q.data.whatsapp,
          welcome_text: q.data.welcome_text,
          share_text: q.data.share_text,
          instagram_url: q.data.instagram_url,
          min_advance_hours: q.data.min_advance_hours,
          max_days_ahead: q.data.max_days_ahead,
          cancel_hours_limit: q.data.cancel_hours_limit,
          payment_alias: alias.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["panel-data"] });
      toast.success("Alias guardado");
    } catch {
      toast.error("No se pudo guardar el alias");
    }
    setSaving(false);
  }

  return (
    <section className="card-neo mt-4 space-y-2 p-4">
      <h2 className="font-display text-lg tracking-wide text-gold">Recordatorio de pago</h2>
      <p className="text-xs text-muted-foreground">
        Si cargás un alias, se incluye junto con el precio en el recordatorio de WhatsApp que se le
        envía al cliente al confirmar su turno.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Alias de transferencia (opcional)"
          disabled={q.isPending}
        />
        <button
          onClick={guardar}
          disabled={saving || q.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </section>
  );
}

function Servicios({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listServices);
  const upsertFn = useServerFn(upsertService);
  const deleteFn = useServerFn(deleteService);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["servicios"], queryFn: () => listFn() as Promise<Service[]> });

  function abrirNuevo() {
    setForm(emptyForm);
    setOpen(true);
  }

  function abrirEditar(s: Service) {
    setForm({
      id: s.id,
      description: s.description,
      buffer_min: s.buffer_min,
      name: s.name,
      duration_min: String(s.duration_min),
      price: s.price !== null ? String(s.price) : "",
      show_price: s.show_price,
      active: s.active,
    });
    setOpen(true);
  }

  async function guardar() {
    const duration = Number(form.duration_min);
    if (!form.name.trim() || !Number.isFinite(duration) || duration <= 0) {
      toast.error("Completá nombre y duración");
      return;
    }
    setSaving(true);
    try {
      await upsertFn({
        data: {
          id: form.id,
          name: form.name.trim(),
          description: form.description ?? undefined,
          duration_min: duration,
          buffer_min: form.buffer_min,
          price: form.price.trim() === "" ? null : Number(form.price),
          show_price: form.show_price,
          active: form.active,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["servicios"] });
      setOpen(false);
      toast.success("Servicio guardado");
    } catch {
      toast.error("No se pudo guardar el servicio");
    }
    setSaving(false);
  }

  async function eliminar(s: Service) {
    setDeletingId(s.id);
    try {
      const res = await deleteFn({ data: { id: s.id } });
      await queryClient.invalidateQueries({ queryKey: ["servicios"] });
      toast.success(
        res.deactivated
          ? "El servicio tiene turnos asociados: se desactivó en vez de eliminarse"
          : "Servicio eliminado",
      );
    } catch {
      toast.error("No se pudo eliminar el servicio");
    }
    setDeletingId(null);
  }

  return (
    <>
      <PanelNav onCerrarSesion={onCerrarSesion} />
      <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl tracking-wide">Servicios</h1>
            <p className="text-xs text-muted-foreground">Nombre, duración, precio y disponibilidad</p>
          </div>
          <button
            onClick={abrirNuevo}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus className="size-3.5" /> Nuevo servicio
          </button>
        </header>

        <AliasPagoCard />

        {q.isPending ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {(q.data ?? []).map((s) => (
              <li key={s.id} className={`card-neo p-4 ${s.active ? "" : "opacity-50"}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold">{s.name}</h3>
                  {!s.active ? (
                    <span className="text-xs text-muted-foreground">Inactivo</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.duration_min} minutos
                  {s.price !== null ? ` · ${formatARS(s.price)}` : " · sin precio"}
                  {s.price !== null && !s.show_price ? " (oculto en la web)" : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => abrirEditar(s)}
                    className="btn-gold-outline rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => eliminar(s)}
                    disabled={deletingId === s.id}
                    className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-60"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <SiteFooter />
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="svc-name">Nombre</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="svc-duration">Duración (minutos)</Label>
              <Input
                id="svc-duration"
                type="number"
                min={5}
                value={form.duration_min}
                onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="svc-price">Precio ($)</Label>
              <Input
                id="svc-price"
                type="number"
                min={0}
                placeholder="Sin precio"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="svc-show-price">Mostrar precio en la web</Label>
              <Switch
                id="svc-show-price"
                checked={form.show_price}
                onCheckedChange={(v) => setForm({ ...form, show_price: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="svc-active">Activo</Label>
              <Switch
                id="svc-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={guardar}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Guardar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
