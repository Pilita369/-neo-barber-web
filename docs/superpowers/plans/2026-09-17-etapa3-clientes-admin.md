# Etapa 3 — Ficha administrativa de clientes + calendario mensual: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "Clientes" section to the admin panel — search, list, and an individual client profile with a navigable monthly calendar highlighting completed (`atendido`) appointments — built entirely on the existing `clients` table and `appointments.client_id` relationship from Etapa 2. No database changes.

**Architecture:** A new `src/lib/clients.functions.ts` (same `requireSupabaseAuth` + `assertAdmin` pattern as the rest of the panel) exposes three read-only server functions. The panel's existing auth-check logic is extracted into a small reusable hook so the two new routes share it with the existing Agenda page, plus a small shared nav component for the "Agenda / Clientes" tabs. The monthly calendar reuses the already-installed, already-styled `Calendar` component (`src/components/ui/calendar.tsx`, built on `react-day-picker`) instead of a hand-built grid.

**Tech Stack:** TanStack Start server functions, Supabase (read-only queries, no RPC/migration), `react-day-picker` (already installed, via the existing `Calendar` wrapper), existing `waLink` WhatsApp helper.

**Reference spec:** `docs/superpowers/specs/2026-09-17-etapa3-clientes-admin-design.md`

**No automated test suite exists in this repo.** Verification is `npx tsc --noEmit`, `npm run build`, and manual checks against the running dev server / real Supabase data — the same pattern used for Etapa 2.

---

### Task 1: Month-range date helper

**Files:**
- Modify: `src/lib/datetime.ts`

- [ ] **Step 1: Add a helper for a month's date range**

Add this function, following the existing file's style (UTC-noon anchoring to avoid timezone edge cases, same as `addDays`):

```ts
/** Primer y último día de un mes (1-12) en formato "yyyy-mm-dd". */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}
```

- [ ] **Step 2: Verify**

Run:
```bash
npx --yes tsx -e "
import { monthRange } from './src/lib/datetime.ts';
console.log(monthRange(2026, 2));
console.log(monthRange(2026, 9));
console.log(monthRange(2024, 2));
"
```
Expected: `{ from: '2026-02-01', to: '2026-02-28' }`, `{ from: '2026-09-01', to: '2026-09-30' }`, and `{ from: '2024-02-01', to: '2024-02-29' }` (2024 is a leap year — this confirms the leap-year edge case is handled correctly via `Date.UTC(year, month, 0)`, not hardcoded day counts).

- [ ] **Step 3: Run the full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/datetime.ts
git commit -m "$(cat <<'EOF'
Add monthRange date helper for client monthly calendar queries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Types for the client list, profile, and month view

**Files:**
- Modify: `src/lib/types.ts`

The file already has a `Client` interface (from Etapa 2: `id`, `phone_e164`, `name`, `lastname`, `created_at`, `updated_at`) — do not change it. Add these new interfaces near it:

- [ ] **Step 1: Add the types**

```ts
export interface ClientListItem extends Client {
  total_completados: number;
  last_visit: string | null;
}

export interface ClientNextAppointment {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
}

export interface ClientProfile {
  client: Client;
  next_appointment: ClientNextAppointment | null;
  last_visit: string | null;
  total_completados: number;
}

export interface ClientMonthAppointment {
  id: string;
  date: string;
  start_time: string;
  service_name: string;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (nothing references these yet, so this just confirms the syntax is valid).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "$(cat <<'EOF'
Add types for client list, profile, and monthly calendar views

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `src/lib/clients.functions.ts` — the three read-only server functions

**Files:**
- Create: `src/lib/clients.functions.ts`

- [ ] **Step 1: Write the file**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthRange, todayBA } from "./datetime";
import type { ClientListItem, ClientMonthAppointment, ClientProfile } from "./types";

type Ctx = { context: { supabase: any; userId: string } };

async function assertAdmin(ctx: Ctx["context"]) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("No tenés permisos de administrador");
}

export const listClients = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ search: z.string().trim().max(60).optional() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { search?: string } } & Ctx) => {
    await assertAdmin(context);

    let query = context.supabase.from("clients").select("*");
    if (data.search) {
      const digits = data.search.replace(/\D/g, "");
      const orParts = [`name.ilike.%${data.search}%`, `lastname.ilike.%${data.search}%`];
      if (digits.length >= 3) orParts.push(`phone_e164.ilike.%${digits}%`);
      query = query.or(orParts.join(","));
    }
    const { data: clients, error } = await query.order("name");
    if (error) throw new Error("No se pudo cargar la lista de clientes");
    const clientIds = (clients ?? []).map((c: { id: string }) => c.id);

    const { data: completados } = clientIds.length
      ? await context.supabase
          .from("appointments")
          .select("client_id, date")
          .in("client_id", clientIds)
          .eq("status", "atendido")
      : { data: [] };

    const statsByClient = new Map<string, { total: number; lastVisit: string | null }>();
    for (const row of completados ?? []) {
      const current = statsByClient.get(row.client_id) ?? { total: 0, lastVisit: null };
      current.total += 1;
      if (!current.lastVisit || row.date > current.lastVisit) current.lastVisit = row.date;
      statsByClient.set(row.client_id, current);
    }

    const result: ClientListItem[] = (clients ?? []).map((c: any) => ({
      ...c,
      total_completados: statsByClient.get(c.id)?.total ?? 0,
      last_visit: statsByClient.get(c.id)?.lastVisit ?? null,
    }));
    return result;
  });

export const getClientProfile = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ clientId: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { clientId: string } } & Ctx) => {
    await assertAdmin(context);

    const { data: client, error: clientError } = await context.supabase
      .from("clients")
      .select("*")
      .eq("id", data.clientId)
      .single();
    if (clientError || !client) throw new Error("Cliente no encontrado");

    const today = todayBA();
    const [{ data: next }, { data: completados }] = await Promise.all([
      context.supabase
        .from("appointments")
        .select("id, date, start_time, services(name)")
        .eq("client_id", data.clientId)
        .in("status", ["pendiente", "confirmado"])
        .gte("date", today)
        .order("date")
        .order("start_time")
        .limit(1),
      context.supabase
        .from("appointments")
        .select("date")
        .eq("client_id", data.clientId)
        .eq("status", "atendido")
        .order("date", { ascending: false }),
    ]);

    const nextRow = (next ?? [])[0] as any;
    const profile: ClientProfile = {
      client,
      next_appointment: nextRow
        ? {
            id: nextRow.id,
            date: nextRow.date,
            start_time: String(nextRow.start_time).slice(0, 5),
            service_name: nextRow.services?.name ?? "",
          }
        : null,
      last_visit: completados && completados.length > 0 ? completados[0].date : null,
      total_completados: completados?.length ?? 0,
    };
    return profile;
  });

export const getClientMonth = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        clientId: z.string().uuid(),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { clientId: string; year: number; month: number } } & Ctx) => {
    await assertAdmin(context);
    const { from, to } = monthRange(data.year, data.month);
    const { data: appts, error } = await context.supabase
      .from("appointments")
      .select("id, date, start_time, services(name)")
      .eq("client_id", data.clientId)
      .eq("status", "atendido")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("start_time");
    if (error) throw new Error("No se pudo cargar el calendario del cliente");

    const result: ClientMonthAppointment[] = (appts ?? []).map((a: any) => ({
      id: a.id,
      date: a.date,
      start_time: String(a.start_time).slice(0, 5),
      service_name: a.services?.name ?? "",
    }));
    return result;
  });
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/clients.functions.ts
git commit -m "$(cat <<'EOF'
Add read-only server functions for client list, profile, and month view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Verify Task 3's queries against real data (no UI yet)

**No files changed.**

This project has no local/test database — verification happens against the real "Barber Neo" Supabase project, read-only (nothing in this task writes anything).

- [ ] **Step 1: Confirm the real client with historical data**

Run (loading env vars first, e.g. `set -a; source .env; set +a`):
```bash
curl -s "$SUPABASE_URL/rest/v1/clients?select=id,name,lastname,phone_e164" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Note the `id` of the client with 7 historical appointments (name "yo"/"mio", phone `+5492991111111`, from Etapa 2's backfill) — you'll use this id in the next steps.

- [ ] **Step 2: Reproduce `listClients`'s aggregation logic directly**

Run (substituting the real client id from Step 1 where marked):
```bash
curl -s "$SUPABASE_URL/rest/v1/appointments?client_id=eq.<ID_FROM_STEP_1>&select=date&status=eq.atendido" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Count the rows and note the max `date` — this is the `total_completados` and `last_visit` that `listClients` and `getClientProfile` should compute for this client. (From the Etapa 2 verification session, this client had appointments with statuses `pendiente`/`cancelado`/`atendido` mixed — confirm how many are specifically `atendido`, don't assume all 7 are.)

- [ ] **Step 3: Reproduce `getClientMonth`'s query for the month(s) containing that client's `atendido` appointments**

For each distinct month found in Step 2's results, run:
```bash
curl -s "$SUPABASE_URL/rest/v1/appointments?client_id=eq.<ID_FROM_STEP_1>&status=eq.atendido&date=gte.<YYYY-MM-01>&date=lte.<YYYY-MM-DD_last_day>&select=id,date,start_time" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Confirm the rows returned match what you'd expect from Step 2's data, and note if any two rows share the same `date` (this is the "two completed appointments same day" case from the spec — if it doesn't occur naturally in the existing data, that's fine, Task 9's manual UI verification will need to construct it deliberately).

- [ ] **Step 4: Confirm a client with zero `atendido` appointments behaves correctly**

Find a client id with no `atendido` rows at all (e.g. the `Ana`/`test` client from Etapa 2's manual testing, if it only has `pendiente`/`cancelado` appointments — check first). Run the same Step 2 query for that client's id and confirm it returns `[]`. This is the "cliente sin visitas completadas" case the spec requires to not break.

No commit in this task (no files changed) — this is verification only. If any of these read-only checks reveal that the real data doesn't match what Task 3's queries would produce (e.g. a Postgrest `.or()` filter syntax issue), STOP and report back rather than proceeding to build UI on top of a broken backend.

---

### Task 5: Extract the panel's auth-check into a reusable hook

**Files:**
- Create: `src/lib/use-panel-auth.ts`
- Modify: `src/routes/panel/index.tsx`

The current `src/routes/panel/index.tsx` has this auth-checking logic embedded directly in its `PanelPage` component (lines 25-59 as of this plan being written — re-read the actual current file first, since exact line numbers may have shifted):

```ts
type AuthState = "checking" | "signed-out" | "forbidden" | "ok";

function PanelPage() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const getIsAdminFn = useServerFn(getIsAdmin);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setAuthState("signed-out");
        return;
      }
      try {
        const res = await getIsAdminFn();
        if (active) setAuthState(res.isAdmin ? "ok" : "forbidden");
      } catch {
        if (active) setAuthState("forbidden");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (authState === "signed-out") navigate({ to: "/auth" });
  }, [authState, navigate]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

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

  return <Agenda onCerrarSesion={cerrarSesion} />;
}
```

Two new routes (Task 7 and 8) need this exact same guard. Extract it into a hook so it's written once.

- [ ] **Step 1: Create the hook**

```ts
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getIsAdmin } from "@/lib/admin.functions";

export type PanelAuthState = "checking" | "signed-out" | "forbidden" | "ok";

export function usePanelAuth() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<PanelAuthState>("checking");
  const getIsAdminFn = useServerFn(getIsAdmin);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setAuthState("signed-out");
        return;
      }
      try {
        const res = await getIsAdminFn();
        if (active) setAuthState(res.isAdmin ? "ok" : "forbidden");
      } catch {
        if (active) setAuthState("forbidden");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (authState === "signed-out") navigate({ to: "/auth" });
  }, [authState, navigate]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return { authState, cerrarSesion };
}
```

- [ ] **Step 2: Update `src/routes/panel/index.tsx` to use it**

Replace the `AuthState` type, the `PanelPage` function's body, and the now-unused `useState`/`useEffect`/`useServerFn`/`getIsAdmin`/`supabase` imports that only existed for this logic, with:

```ts
import { usePanelAuth } from "@/lib/use-panel-auth";

function PanelPage() {
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

  return <Agenda onCerrarSesion={cerrarSesion} />;
}
```

Keep every other part of the file (the `ACCIONES` map, the `Agenda` component and everything inside it) completely untouched — this task is only about the auth-check extraction, not the Agenda's own logic. Remove imports that become unused as a result (`useNavigate`, `useState` — check if `useState` is still used elsewhere in the file by the `Agenda` component before removing it; it is, for `savingId`, so keep that import, just remove `useEffect`/`useNavigate`/`getIsAdmin`/`supabase` if the `Agenda` component doesn't also need them — check `Agenda`'s body for `supabase` usage: it doesn't reference `supabase` directly, so that import can be removed from this file entirely; `useServerFn` IS still needed by `Agenda` for its own server functions, so keep that import).

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors, no "unused import" warnings from the linter (run `npx eslint src/routes/panel/index.tsx src/lib/use-panel-auth.ts` too and fix anything it flags).

- [ ] **Step 4: Manual smoke test — confirm the Agenda page still works exactly as before**

Start the dev server (`npm run dev`, note the port it actually picks), open `/panel` in a browser, log in with one of the existing test accounts (WhatsApp `2990000000`, PIN `<PIN_DE_PRUEBA>`), and confirm the Agenda still loads, shows turnos, and "Salir" still logs out correctly. This is a pure refactor — if anything about the Agenda's behavior changed, that's a regression to fix before moving on.

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-panel-auth.ts src/routes/panel/index.tsx
git commit -m "$(cat <<'EOF'
Extract panel auth-check into a reusable hook

Needed so the new Clientes routes can share the same guard as Agenda
without duplicating the logic.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Shared panel navigation (Agenda / Clientes tabs)

**Files:**
- Create: `src/components/panel-nav.tsx`
- Modify: `src/routes/panel/index.tsx`

- [ ] **Step 1: Write the nav component**

```tsx
import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

export function PanelNav({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const linkClass =
    "rounded-full px-3 py-1.5 text-sm font-medium [&.active]:bg-primary [&.active]:text-primary-foreground text-muted-foreground";
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-5">
      <nav className="flex gap-2">
        <Link to="/panel" className={linkClass} activeOptions={{ exact: true }}>
          Agenda
        </Link>
        <Link to="/panel/clientes" className={linkClass}>
          Clientes
        </Link>
      </nav>
      <button
        onClick={onCerrarSesion}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
      >
        <LogOut className="size-3.5" /> Salir
      </button>
    </div>
  );
}
```

Before finalizing, check how TanStack Router's `<Link>` marks the active link in this exact installed version (`@tanstack/react-router: 1.170.18`) — read `node_modules/@tanstack/react-router`'s types or an existing usage in this codebase for the correct active-state mechanism (it may be an `activeProps` prop with a `className`/`style` object rather than an automatic `.active` CSS class — verify rather than assume, and adjust the component accordingly if the mechanism is different from what's sketched above). Keep the visual result the same either way: the current tab is visually distinguished (filled pink pill), the other is muted text.

- [ ] **Step 2: Wire it into `src/routes/panel/index.tsx`**

In the `Agenda` component's returned JSX, replace the existing `<header>` block (name/title + inline "Salir" button) with the new `<PanelNav onCerrarSesion={onCerrarSesion} />`, placed right before the `<main>`'s existing content — i.e., it should render above the "Agenda" heading, not replace the heading itself. The `<h1>Agenda</h1>` / "Próximos 7 días" text stays inside `<main>` as page content; only the top-level "Salir" button moves into the shared nav (remove the now-duplicate `LogOut` button and its wrapping `<button>` from `Agenda`'s own header, since `PanelNav` now owns it — but keep the `<h1>`/subtitle).

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Manual check**

With the dev server running, open `/panel`, confirm the new nav bar shows "Agenda" (highlighted as active) and "Clientes" (muted, clicking it will 404 until Task 7 exists — that's expected right now), and "Salir" still works from the nav bar.

- [ ] **Step 5: Commit**

```bash
git add src/components/panel-nav.tsx src/routes/panel/index.tsx
git commit -m "$(cat <<'EOF'
Add shared Agenda/Clientes navigation to the panel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `/panel/clientes` — client list with search

**Files:**
- Create: `src/routes/panel/clientes/index.tsx`

- [ ] **Step 1: Write the route**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { listClients } from "@/lib/clients.functions";
import { usePanelAuth } from "@/lib/use-panel-auth";
import { PanelNav } from "@/components/panel-nav";
import { fechaLarga } from "@/lib/datetime";

export const Route = createFileRoute("/panel/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Neo Barbería" }] }),
  component: ClientesPage,
});

function ClientesPage() {
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

  return <ClientList onCerrarSesion={cerrarSesion} />;
}

function ClientList({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const listClientsFn = useServerFn(listClients);
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(inputValue.trim()), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  const q = useQuery({
    queryKey: ["clientes", search],
    queryFn: () => listClientsFn({ data: { search: search || undefined } }),
  });

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16">
      <PanelNav onCerrarSesion={onCerrarSesion} />
      <h1 className="mt-5 font-display text-3xl tracking-wide">Clientes</h1>

      <label className="mt-4 block">
        <span className="sr-only">Buscar cliente</span>
        <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Nombre o WhatsApp"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>
      </label>

      {q.isPending ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <p className="card-neo mt-4 p-4 text-sm text-muted-foreground">
          No hay clientes que coincidan con la búsqueda.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {q.data!.map((c) => (
            <li key={c.id}>
              <Link
                to="/panel/clientes/$id"
                params={{ id: c.id }}
                className="card-neo block p-4 transition active:scale-[0.99]"
              >
                <p className="font-semibold">
                  {c.name} {c.lastname ?? ""}
                </p>
                <p className="mt-1 text-sm text-gold">
                  {c.total_completados === 0
                    ? "Sin visitas completadas"
                    : `${c.total_completados} corte${c.total_completados === 1 ? "" : "s"} · Última visita: ${fechaLarga(c.last_visit!)}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{c.phone_e164}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors. If `fechaLarga` doesn't accept the `last_visit` date format directly, check its actual signature in `src/lib/datetime.ts` and adjust (it's designed for `"yyyy-mm-dd"` strings, which is exactly what `last_visit` is — this should just work, but verify).

- [ ] **Step 3: Manual check against real data**

With the dev server running and logged into `/panel`, click "Clientes". Confirm:
- All existing clients appear (at least the 3 from Etapa 2's testing: the one with 7 historical appointments, `PruebaEtapa2*`, and `ana`/`test`).
- The one with `atendido` history shows the right count and a formatted last-visit date; the ones without show "Sin visitas completadas".
- Typing part of a name filters the list (after the ~300ms debounce).
- Typing digits from a client's phone number also finds them.
- Clicking a client attempts to navigate to `/panel/clientes/$id` (this will 404 until Task 8 exists — expected right now).

- [ ] **Step 4: Commit**

```bash
git add src/routes/panel/clientes/index.tsx
git commit -m "$(cat <<'EOF'
Add client list page with search by name and phone

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `/panel/clientes/$id` — client profile (data + summary, no calendar yet)

**Files:**
- Create: `src/routes/panel/clientes/$id.tsx`

- [ ] **Step 1: Write the route with the Datos/Resumen sections (calendar comes in Task 9)**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { getClientProfile } from "@/lib/clients.functions";
import { usePanelAuth } from "@/lib/use-panel-auth";
import { PanelNav } from "@/components/panel-nav";
import { fechaLarga, waLink } from "@/lib/datetime";

export const Route = createFileRoute("/panel/clientes/$id")({
  head: () => ({ meta: [{ title: "Ficha de cliente — Neo Barbería" }] }),
  component: ClientProfilePage,
});

function ClientProfilePage() {
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

  return <ClientProfile onCerrarSesion={cerrarSesion} />;
}

function ClientProfile({ onCerrarSesion }: { onCerrarSesion: () => void }) {
  const { id } = Route.useParams();
  const getClientProfileFn = useServerFn(getClientProfile);

  const q = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => getClientProfileFn({ data: { clientId: id } }),
  });

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-16">
      <PanelNav onCerrarSesion={onCerrarSesion} />

      <div className="mt-5">
        <Link to="/panel/clientes" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Clientes
        </Link>
      </div>

      {q.isPending ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : !q.data ? (
        <p className="card-neo mt-4 p-4 text-sm text-muted-foreground">No encontramos este cliente.</p>
      ) : (
        <>
          <h1 className="mt-3 font-display text-3xl tracking-wide">
            {q.data.client.name} {q.data.client.lastname ?? ""}
          </h1>

          <section className="card-neo mt-4 space-y-2 p-4">
            <h2 className="font-display text-lg tracking-wide text-gold">Datos</h2>
            <a
              href={waLink(q.data.client.phone_e164, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm underline"
            >
              <MessageCircle className="size-4 text-gold" /> {q.data.client.phone_e164}
            </a>
            <p className="text-xs text-muted-foreground">
              Cliente desde {fechaLarga(q.data.client.created_at.slice(0, 10))}
            </p>
          </section>

          <section className="card-neo mt-4 space-y-2 p-4">
            <h2 className="font-display text-lg tracking-wide text-gold">Resumen</h2>
            <p className="text-sm">
              Próximo turno:{" "}
              {q.data.next_appointment
                ? `${fechaLarga(q.data.next_appointment.date)} · ${q.data.next_appointment.start_time} h · ${q.data.next_appointment.service_name}`
                : "Sin turnos próximos"}
            </p>
            <p className="text-sm">
              Última visita: {q.data.last_visit ? fechaLarga(q.data.last_visit) : "—"}
            </p>
            <p className="text-sm">Cortes completados (histórico): {q.data.total_completados}</p>
          </section>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Manual check**

From `/panel/clientes`, click into the client with 7 historical appointments. Confirm:
- Name, WhatsApp (as a link), "cliente desde" date all show correctly.
- "Próximo turno" shows correctly if that client has a `pendiente`/`confirmado` appointment with a future date, or "Sin turnos próximos" otherwise.
- "Última visita" and "Cortes completados (histórico)" match what Task 4 found directly in the database.
- Click into a client with zero `atendido` history (e.g. `ana`/`test`) and confirm it shows "—" / `0` without erroring.
- Click the WhatsApp link and confirm it opens `wa.me` with that client's number.

- [ ] **Step 4: Commit**

```bash
git add src/routes/panel/clientes/\$id.tsx
git commit -m "$(cat <<'EOF'
Add client profile page (data + summary sections)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Monthly calendar on the client profile

**Files:**
- Modify: `src/routes/panel/clientes/$id.tsx`

- [ ] **Step 1: Confirm the installed `react-day-picker` API before writing integration code**

This project has `react-day-picker: ^9.14.0`, which had breaking API changes from earlier major versions. Do NOT assume prop names from older tutorials or from a different version. Before writing any code:

Run:
```bash
grep -n "month\?:" node_modules/react-day-picker/dist/esm/types/props.d.ts | head -20
grep -n "onMonthChange\|modifiers\|modifiersClassNames\|onDayClick\|onSelect" node_modules/react-day-picker/dist/esm/types/props.d.ts | head -20
```
(adjust the path if the package's actual type-definitions file lives somewhere else — find it first with `find node_modules/react-day-picker -name "*.d.ts" | xargs grep -l "onMonthChange"` if the guess above doesn't match). Confirm the exact prop names and types for: controlling the displayed month, being notified when the user navigates to a different month, applying a custom highlight to a specific set of dates, and being notified when a specific day is clicked. Also check how `src/components/ui/calendar.tsx`'s `Calendar` wrapper passes props through (it spreads `...props` onto `DayPicker`, so anything valid for `DayPicker` should work through `Calendar` too — confirm this is still true by re-reading that file).

If any of the prop names in the sketch below turn out to be wrong for this installed version, use the real ones — the important thing is the behavior (controlled month navigation, custom-styled highlighted dates, click handler on days), not matching this sketch literally.

- [ ] **Step 2: Add the calendar section**

Sketch (adjust prop names per Step 1's findings):

```tsx
// New imports at the top of the file:
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import type { ClientMonthAppointment } from "@/lib/types";
import { getClientMonth } from "@/lib/clients.functions";

// Inside ClientProfile, after the existing hooks:
const getClientMonthFn = useServerFn(getClientMonth);
const [viewedMonth, setViewedMonth] = useState(() => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
});
const [selectedDay, setSelectedDay] = useState<string | null>(null);

const monthQuery = useQuery({
  queryKey: ["cliente-mes", id, viewedMonth.year, viewedMonth.month],
  queryFn: () =>
    getClientMonthFn({ data: { clientId: id, year: viewedMonth.year, month: viewedMonth.month } }),
});

const appts = monthQuery.data ?? [];
const completadosDelMes = appts.length;
const highlightedDates = [...new Set(appts.map((a) => a.date))].map(
  (d) => new Date(d + "T12:00:00Z"),
);
const selectedDayAppts: ClientMonthAppointment[] = selectedDay
  ? appts.filter((a) => a.date === selectedDay)
  : [];
```

Add a third `card-neo` section (after "Resumen", still inside the `!q.isPending && q.data` branch) rendering:
- A line showing `Completados este mes: {completadosDelMes}`.
- The `Calendar` component, controlled to `viewedMonth`, with the month-change handler updating `viewedMonth` (reset `selectedDay` to `null` on month change), the highlighted dates styled with the app's gold accent (check `src/styles.css` for the existing `--gold`/`text-gold` tokens and use a `modifiersClassNames`-equivalent that applies a gold background/border — don't invent new color values, reuse what's already defined), and a day-click handler that sets `selectedDay` to the clicked date's `"yyyy-mm-dd"` string ONLY if that date is one of the highlighted ones (clicking a non-highlighted day should do nothing, per the spec — there's nothing to show for a day with no completed appointment).
- Below the calendar, if `selectedDay` is set, a small list of `selectedDayAppts` (service name + hour), so that a day with two completed appointments shows both.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Manual verification against real data**

Using the client with historical `atendido` appointments (from Task 4's findings): open their profile, confirm the calendar opens on the current month, navigate back to the month(s) where their `atendido` appointments actually happened, confirm those days are highlighted, click a highlighted day and confirm the right appointment(s) show below (if Task 4 found a day with two `atendido` appointments for the same client, verify both show — if no such day exists naturally in the current data, this specific sub-case can't be verified against real data right now; note that in your report rather than fabricating test data, since Etapa 2's design explicitly discouraged creating throwaway state changes beyond what's needed). Confirm "Completados este mes" changes as you navigate between months, matching the count of `atendido` rows in that month (not the count of highlighted days). Click a non-highlighted day and confirm nothing breaks (no appointment list appears, no error).

- [ ] **Step 5: Commit**

```bash
git add src/routes/panel/clientes/\$id.tsx
git commit -m "$(cat <<'EOF'
Add navigable monthly calendar with completed-appointment highlights

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Full end-to-end verification and final review

**No files changed.**

- [ ] **Step 1: Re-run the complete verification checklist from the design spec**

Go through every bullet in the "Verificación" section of `docs/superpowers/specs/2026-09-17-etapa3-clientes-admin-design.md` against the running dev server, and confirm each one holds. Report any that don't.

- [ ] **Step 2: Confirm the Agenda page is unaffected**

Go back to `/panel` (Agenda tab) and confirm every piece of existing functionality still works exactly as before this etapa: viewing the week's appointments, approving/rejecting pending-authorization turnos, changing appointment status, the WhatsApp buttons. This etapa should be purely additive to the Agenda's surroundings (nav bar), never to its logic.

- [ ] **Step 3: Final type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Clean up any auto-regenerated noise**

Run: `git status --short`. If `src/routeTree.gen.ts` shows as modified with no actual content diff (`git diff -- src/routeTree.gen.ts` produces nothing but a line-ending warning), discard it with `git checkout -- src/routeTree.gen.ts` — this is expected noise from running `build`/`dev`, not a real change (seen repeatedly during Etapa 2).

No commit in this task unless Step 4 needed to discard something (which itself needs no commit, just a clean working tree).
