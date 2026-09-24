import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  getSettings,
  saveSettings,
  getScheduleConfig,
  saveHours,
  addException,
  deleteException,
} from "@/lib/admin.functions";
import { PanelNav } from "@/components/panel-nav";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePanelAuth } from "@/lib/use-panel-auth";
import { LOYALTY_BENEFIT_KINDS, BENEFIT_LABEL } from "@/lib/loyalty";
import { fechaCorta, nombreDiaSemana, todayBA } from "@/lib/datetime";
import type { AvailabilityException, BusinessHour, Settings } from "@/lib/types";

export const Route = createFileRoute("/panel/configuracion")({
  head: () => ({ meta: [{ title: "Configuración — Neo Barbería" }] }),
  component: ConfiguracionPage,
});

function ConfiguracionPage() {
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

  return <Configuracion onCerrarSesion={cerrarSesion} />;
}

function Configuracion({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  return (
    <>
      <PanelNav onCerrarSesion={onCerrarSesion} />
      <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16 pt-6">
        <header>
          <h1 className="font-display text-3xl tracking-wide">Configuración</h1>
          <p className="text-xs text-muted-foreground">Horarios, pagos y fidelización</p>
        </header>

        <AliasPagoCard />
        <HorariosCard />
        <ExcepcionesCard />
        <FidelizacionCard />

        <SiteFooter />
      </main>
    </>
  );
}

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
          loyalty_enabled: q.data.loyalty_enabled,
          loyalty_mode: q.data.loyalty_mode,
          loyalty_visits_required: q.data.loyalty_visits_required,
          loyalty_benefit_kind: q.data.loyalty_benefit_kind,
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

type ScheduleConfig = { hours: BusinessHour[]; exceptions: AvailabilityException[] };

function HorariosCard() {
  const queryClient = useQueryClient();
  const getScheduleFn = useServerFn(getScheduleConfig);
  const saveHoursFn = useServerFn(saveHours);
  const [rows, setRows] = useState<BusinessHour[] | null>(null);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["schedule-config"],
    queryFn: () => getScheduleFn() as Promise<ScheduleConfig>,
  });

  useEffect(() => {
    if (q.data && !rows) setRows(q.data.hours);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar el primer valor
  }, [q.data]);

  function actualizar(weekday: number, patch: Partial<BusinessHour>) {
    setRows((prev) => (prev ?? []).map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  }

  async function guardar() {
    if (!rows) return;
    setSaving(true);
    try {
      await saveHoursFn({
        data: {
          rows: rows.map((r) => ({
            weekday: r.weekday,
            enabled: r.enabled,
            start_time: r.start_time.slice(0, 5),
            end_time: r.end_time.slice(0, 5),
            break_start: r.break_start ? r.break_start.slice(0, 5) : null,
            break_end: r.break_end ? r.break_end.slice(0, 5) : null,
            slot_interval_min: r.slot_interval_min,
          })),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["schedule-config"] });
      toast.success("Horarios guardados");
    } catch {
      toast.error("No se pudieron guardar los horarios");
    }
    setSaving(false);
  }

  return (
    <section className="card-neo mt-4 space-y-3 p-4">
      <h2 className="font-display text-lg tracking-wide text-gold">Horarios de atención</h2>
      {q.isPending || !rows ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows
            .slice()
            .sort((a, b) => a.weekday - b.weekday)
            .map((r) => (
              <div
                key={r.weekday}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
              >
                <div className="flex w-28 items-center gap-2">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => actualizar(r.weekday, { enabled: v })}
                  />
                  <span className="text-sm">{nombreDiaSemana(r.weekday)}</span>
                </div>
                {r.enabled ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={r.start_time.slice(0, 5)}
                      onChange={(e) => actualizar(r.weekday, { start_time: e.target.value })}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={r.end_time.slice(0, 5)}
                      onChange={(e) => actualizar(r.weekday, { end_time: e.target.value })}
                      className="w-28"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Cerrado</span>
                )}
              </div>
            ))}
        </div>
      )}
      <button
        onClick={guardar}
        disabled={saving || !rows}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        Guardar horarios
      </button>
    </section>
  );
}

function ExcepcionesCard() {
  const queryClient = useQueryClient();
  const getScheduleFn = useServerFn(getScheduleConfig);
  const addExceptionFn = useServerFn(addException);
  const deleteExceptionFn = useServerFn(deleteException);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: "", isAvailable: false, start: "", end: "", reason: "" });

  const q = useQuery({
    queryKey: ["schedule-config"],
    queryFn: () => getScheduleFn() as Promise<ScheduleConfig>,
  });

  async function agregar() {
    if (!form.date) {
      toast.error("Elegí una fecha");
      return;
    }
    if (form.isAvailable && (!form.start || !form.end)) {
      toast.error("Completá el horario excepcional");
      return;
    }
    setSaving(true);
    try {
      await addExceptionFn({
        data: {
          date: form.date,
          isAvailable: form.isAvailable,
          start: form.isAvailable ? form.start : undefined,
          end: form.isAvailable ? form.end : undefined,
          reason: form.reason.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["schedule-config"] });
      setForm({ date: "", isAvailable: false, start: "", end: "", reason: "" });
      toast.success("Excepción guardada");
    } catch {
      toast.error("No se pudo guardar la excepción");
    }
    setSaving(false);
  }

  async function eliminar(id: string) {
    setDeletingId(id);
    try {
      await deleteExceptionFn({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["schedule-config"] });
    } catch {
      toast.error("No se pudo eliminar la excepción");
    }
    setDeletingId(null);
  }

  const exceptions = q.data?.exceptions ?? [];

  return (
    <section className="card-neo mt-4 space-y-3 p-4">
      <h2 className="font-display text-lg tracking-wide text-gold">Excepciones de fecha</h2>
      <p className="text-xs text-muted-foreground">
        Para un día puntual (feriado, vacaciones, horario especial). Tiene prioridad sobre el horario
        semanal, sin modificarlo.
      </p>

      {exceptions.length > 0 ? (
        <ul className="space-y-2">
          {exceptions.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm"
            >
              <div>
                <p className="font-medium capitalize">{fechaCorta(e.date)}</p>
                <p className="text-xs text-muted-foreground">
                  {e.is_available
                    ? `Abierto ${e.start_time?.slice(0, 5) ?? ""} a ${e.end_time?.slice(0, 5) ?? ""}`
                    : "Cerrado todo el día"}
                  {e.reason ? ` · ${e.reason}` : ""}
                </p>
              </div>
              <button
                onClick={() => eliminar(e.id)}
                disabled={deletingId === e.id}
                className="rounded-lg border border-destructive p-1.5 text-destructive disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No hay excepciones próximas.</p>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <Input
          type="date"
          min={todayBA()}
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <div className="flex items-center justify-between">
          <Label htmlFor="exc-disponible">Abre este día</Label>
          <Switch
            id="exc-disponible"
            checked={form.isAvailable}
            onCheckedChange={(v) => setForm({ ...form, isAvailable: v })}
          />
        </div>
        {form.isAvailable ? (
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">a</span>
            <Input
              type="time"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </div>
        ) : null}
        <Input
          placeholder="Motivo (opcional)"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <button
          onClick={agregar}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Plus className="size-3.5" /> Agregar excepción
        </button>
      </div>
    </section>
  );
}

type LoyaltyForm = {
  enabled: boolean;
  mode: "monthly" | "cumulative";
  visits: string;
  kind: "percent_20" | "percent_50" | "free_cut";
};

function FidelizacionCard() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getSettings);
  const saveSettingsFn = useServerFn(saveSettings);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LoyaltyForm | null>(null);

  const q = useQuery({ queryKey: ["settings"], queryFn: () => getSettingsFn() as Promise<Settings> });

  useEffect(() => {
    if (q.data && !form) {
      setForm({
        enabled: q.data.loyalty_enabled,
        mode: q.data.loyalty_mode,
        visits: String(q.data.loyalty_visits_required),
        kind: q.data.loyalty_benefit_kind,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar el primer valor
  }, [q.data]);

  async function guardar() {
    if (!q.data || !form) return;
    const visits = Number(form.visits);
    if (!Number.isFinite(visits) || visits <= 0) {
      toast.error("La cantidad de visitas debe ser mayor a 0");
      return;
    }
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
          payment_alias: q.data.payment_alias,
          loyalty_enabled: form.enabled,
          loyalty_mode: form.mode,
          loyalty_visits_required: visits,
          loyalty_benefit_kind: form.kind,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Fidelización guardada");
    } catch {
      toast.error("No se pudo guardar la fidelización");
    }
    setSaving(false);
  }

  if (!form) {
    return (
      <section className="card-neo mt-4 p-4">
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="card-neo mt-4 space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wide text-gold">Fidelización</h2>
        <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
      </div>
      <p className="text-xs text-muted-foreground">
        Cuando un cliente cumple la condición, la ficha del cliente muestra un aviso. Vos decidís
        cuándo generar el beneficio: no se aplica solo.
      </p>

      <div className="space-y-2">
        <Label>Modo</Label>
        <RadioGroup
          value={form.mode}
          onValueChange={(v) => setForm({ ...form, mode: v as LoyaltyForm["mode"] })}
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="monthly" /> Visitas dentro del mismo mes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="cumulative" /> Visitas acumuladas (histórico)
          </label>
        </RadioGroup>
      </div>

      <div>
        <Label htmlFor="loyalty-visits">Visitas requeridas</Label>
        <Input
          id="loyalty-visits"
          type="number"
          min={1}
          value={form.visits}
          onChange={(e) => setForm({ ...form, visits: e.target.value })}
        />
      </div>

      <div>
        <Label>Beneficio asociado</Label>
        <Select
          value={form.kind}
          onValueChange={(v) => setForm({ ...form, kind: v as LoyaltyForm["kind"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOYALTY_BENEFIT_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {BENEFIT_LABEL[k].title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        onClick={guardar}
        disabled={saving}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        Guardar fidelización
      </button>
    </section>
  );
}
