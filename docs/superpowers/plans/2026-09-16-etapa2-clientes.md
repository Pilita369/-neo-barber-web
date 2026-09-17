# Etapa 2 — Clientes y normalización de teléfonos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every appointment a link to a unique client record, identified deterministically by normalized WhatsApp number, without altering any existing historical data.

**Architecture:** A new `clients` table (unique on `phone_e164`) plus a nullable `appointments.client_id` FK. `create_appointment` (the existing Postgres RPC that already handles the anti-double-booking lock) is extended to also upsert the client atomically in the same transaction, never overwriting an existing client's name. Phone normalization lives in one TypeScript module (`libphonenumber-js`) used by the server functions before calling the RPC. A one-time Node script backfills `client_id` on existing rows without touching their original text fields.

**Tech Stack:** TanStack Start server functions, Supabase Postgres (RPC/plpgsql), `libphonenumber-js`, existing `@supabase/supabase-js` service-role client.

**Reference spec:** `docs/superpowers/specs/2026-09-16-etapa2-clientes-design.md`

**No automated test suite exists in this repo.** Verification for every task is: `npx tsc --noEmit`, `npm run build`, and manual checks against the running dev server / Supabase REST API (the same pattern already used throughout this project). Follow that pattern rather than introducing a new test framework.

---

### Task 1: Add the phone-parsing dependency

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)

- [ ] **Step 1: Install the package**

Run: `npm install libphonenumber-js`

- [ ] **Step 2: Verify it's in package.json**

Run: `grep libphonenumber-js package.json`
Expected: a line like `"libphonenumber-js": "^1.x.x",` under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
Add libphonenumber-js for Argentina phone normalization

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Phone normalization module

**Files:**
- Create: `src/lib/phone.ts`

- [ ] **Step 1: Write the module**

```ts
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normaliza un teléfono a formato E.164 usando Argentina como región por
 * defecto. Devuelve null si no se puede interpretar con confianza — nunca
 * fuerza un resultado dudoso.
 */
export function toPhoneE164(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, "AR");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}
```

- [ ] **Step 2: Verify manually against real-world inputs**

Run:
```bash
node --input-type=module -e "
import { toPhoneE164 } from './src/lib/phone.ts';
" 2>&1 || true
```

That will fail because Node can't run `.ts` directly. Instead verify through Vite's dev server, which already transpiles TS: create a scratch check using `tsx` via npx (no new dependency, `npx` fetches it once):

```bash
npx --yes tsx -e "
import { toPhoneE164 } from './src/lib/phone.ts';
const cases = ['+54 9 299 4123456', '0299 4123456', '299 4123456', '15 4123456', 'no es un telefono'];
for (const c of cases) console.log(c, '->', toPhoneE164(c));
"
```

Expected: the first three all print the same value (`+5492994123456`), the last prints `null`. The `'15 4123456'` case has no area code so it's expected to also print `null` or fail to parse — that's correct behavior (not enough information to normalize), not a bug.

- [ ] **Step 3: Commit**

```bash
git add src/lib/phone.ts
git commit -m "$(cat <<'EOF'
Add Argentina phone normalization helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Retroactive housekeeping migration

**Files:**
- Create: `supabase/migrations/20260916120000_retroactive_staff_and_approval.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Retroactive record of schema changes applied directly via the Supabase
-- SQL Editor on 2026-09-14/15 (superadmin role, staff_accounts,
-- needs_approval). Guarded so this file is safe to run again against a
-- database that already has these — it must not fail if re-applied.

alter type public.app_role add value if not exists 'superadmin';

create table if not exists public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.staff_accounts to authenticated;
grant all on public.staff_accounts to service_role;
alter table public.staff_accounts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staff_accounts'
      and policyname = 'Superadmin gestiona accesos'
  ) then
    create policy "Superadmin gestiona accesos" on public.staff_accounts
      for all to authenticated
      using (public.has_role(auth.uid(), 'superadmin'))
      with check (public.has_role(auth.uid(), 'superadmin'));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staff_accounts'
      and policyname = 'Cada uno ve su propio acceso'
  ) then
    create policy "Cada uno ve su propio acceso" on public.staff_accounts
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

alter table public.appointments add column if not exists needs_approval boolean not null default false;
```

- [ ] **Step 2: Commit (file only — not applied to the database yet)**

```bash
git add supabase/migrations/20260916120000_retroactive_staff_and_approval.sql
git commit -m "$(cat <<'EOF'
Record retroactive migration for staff_accounts/superadmin/needs_approval

These were applied directly via the Supabase SQL Editor and never saved
as migration files. Guarded with IF NOT EXISTS so it's safe to re-run.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

This task only writes the file for the record — it is a no-op against the
live database (everything in it already exists there), so there is nothing
to apply or verify against Supabase for this task.

---

### Task 4: Clients table + `create_appointment` migration

**Files:**
- Create: `supabase/migrations/20260916120100_clients.sql`

- [ ] **Step 1: Write the migration file**

```sql
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  name text not null,
  lastname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.clients to service_role;
alter table public.clients enable row level security;
-- Sin políticas públicas todavía: todo el acceso pasa por service_role en
-- servidor, igual que appointments hoy. Se agrega una política admin-only
-- cuando el panel necesite leerla con el JWT del staff (Etapa 3).

alter table public.appointments add column client_id uuid references public.clients(id);
create index appointments_client_id_idx on public.appointments (client_id);

drop function if exists public.create_appointment(uuid, uuid, text, text, text, text, date, time, time, boolean);

create or replace function public.create_appointment(
  p_professional_id uuid,
  p_service_id uuid,
  p_client_name text,
  p_client_lastname text,
  p_client_phone text,
  p_notes text,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_admin_created boolean default false,
  p_phone_e164 text default null
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare
  v_appt public.appointments;
  v_needs_approval boolean := false;
  v_client_id uuid := null;
begin
  perform pg_advisory_xact_lock(hashtext(p_professional_id::text || p_date::text));
  if exists (
    select 1 from public.appointments
    where professional_id = p_professional_id
      and date = p_date
      and status in ('pendiente', 'confirmado')
      and start_time < p_end_time and end_time > p_start_time
  ) then
    raise exception 'SLOT_TAKEN';
  end if;
  if not p_admin_created and exists (
    select 1 from public.appointments
    where client_phone = p_client_phone
      and status in ('pendiente', 'confirmado')
  ) then
    v_needs_approval := true;
  end if;
  if p_phone_e164 is not null then
    insert into public.clients (phone_e164, name, lastname)
    values (p_phone_e164, p_client_name, p_client_lastname)
    on conflict (phone_e164) do update set updated_at = now()
    returning id into v_client_id;
  end if;
  insert into public.appointments (
    professional_id, service_id, client_name, client_lastname, client_phone,
    notes, date, start_time, end_time, needs_approval, client_id
  )
  values (
    p_professional_id, p_service_id, p_client_name, p_client_lastname, p_client_phone,
    p_notes, p_date, p_start_time, p_end_time, v_needs_approval, v_client_id
  )
  returning * into v_appt;
  return v_appt;
end;
$$;
revoke all on function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time, boolean, text) from public, anon, authenticated;
grant execute on function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time, boolean, text) to service_role;
```

- [ ] **Step 2: Commit (file only)**

```bash
git add supabase/migrations/20260916120100_clients.sql
git commit -m "$(cat <<'EOF'
Add clients table and wire create_appointment to upsert by phone

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Apply both migrations to the live database

**No files changed in this task** — this is a manual step against the
"Barber Neo" Supabase project's SQL Editor (same workflow used for every
prior schema change this session; there is no CLI/MCP access to this
project).

- [ ] **Step 1: Show the user the exact contents of both migration files**
(the ones written in Tasks 3 and 4) and ask them to paste and run each one,
**in order**, as two separate executions in the SQL Editor.

- [ ] **Step 2: Verify Task 3's migration was a true no-op**

Run:
```bash
curl -s "$SUPABASE_URL/rest/v1/staff_accounts?select=user_id" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: the same 2 rows that existed before (Pilar + the test admin) — count unchanged.

- [ ] **Step 3: Verify the clients table and new column exist**

Run:
```bash
curl -s "$SUPABASE_URL/rest/v1/clients?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -s "$SUPABASE_URL/rest/v1/appointments?select=client_id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: both return `[]` or rows with a `client_id` field — not a `42703`/`PGRST205` error.

No commit in this task (no files changed).

---

### Task 6: Patch the generated Supabase types

**Files:**
- Modify: `src/integrations/supabase/types.ts`

The Supabase project for this app isn't reachable from this session's tooling
to auto-regenerate types, so these are hand-patched — same approach already
used for `needs_approval`/`superadmin` earlier this project.

- [ ] **Step 1: Add the `clients` table type**

Add a new entry alongside the other tables (e.g. near `business_settings`):

```ts
clients: {
  Row: {
    id: string
    phone_e164: string
    name: string
    lastname: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    phone_e164: string
    name: string
    lastname?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    phone_e164?: string
    name?: string
    lastname?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: []
}
```

- [ ] **Step 2: Add `client_id` to the `appointments` Row/Insert/Update types**

In each of the three, add `client_id: string | null` (Row) / `client_id?: string | null` (Insert, Update).

- [ ] **Step 3: Update `create_appointment`'s Args and Returns**

Add `p_phone_e164?: string | null` to `Args`, and `client_id: string | null` to `Returns`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "$(cat <<'EOF'
Hand-patch generated types for clients table and RPC signature

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `Client` type and wiring in server functions

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/public.functions.ts`
- Modify: `src/lib/admin.functions.ts`

- [ ] **Step 1: Add the `Client` type**

In `src/lib/types.ts`, add:

```ts
export interface Client {
  id: string;
  phone_e164: string;
  name: string;
  lastname: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Wire the public booking flow**

In `src/lib/public.functions.ts`, add the import:

```ts
import { toPhoneE164 } from "./phone";
```

In `createAppointment`'s handler, right before the `supabase.rpc("create_appointment", {...})` call, compute the normalized phone and pass it:

```ts
    const phoneE164 = toPhoneE164(data.phone);
```

Then add `p_phone_e164: phoneE164,` as a new field inside that same `.rpc("create_appointment", { ... })` call's argument object (alongside the existing `p_professional_id`, `p_service_id`, etc. — do not remove or rename anything already there).

- [ ] **Step 3: Wire the admin manual-booking flow**

In `src/lib/admin.functions.ts`, add the same import:

```ts
import { toPhoneE164 } from "./phone";
```

In `createManualAppointment`'s handler, right before its `supabaseAdmin.rpc("create_appointment", {...})` call, compute and pass it the same way:

```ts
    const phoneE164 = toPhoneE164(data.phone);
```

and add `p_phone_e164: phoneE164,` to that call's argument object (keep the existing `p_admin_created: true` as-is).

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/public.functions.ts src/lib/admin.functions.ts
git commit -m "$(cat <<'EOF'
Normalize and pass client phone through to create_appointment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Manual smoke test against the local dev server

**No files changed.**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background), then wait for it to report its port (check the earlier pattern in this session: it may not be 8080 if something else is already listening — read the log line starting with `Local:`).

- [ ] **Step 2: Book a first appointment with a brand-new phone number**

Through the browser (or by calling the flow manually), reserve a turno using a phone number that has never been used before, e.g. `299 4999999`.

- [ ] **Step 3: Confirm a client row was created**

Run:
```bash
curl -s "$SUPABASE_URL/rest/v1/clients?phone_e164=eq.%2B5492994999999&select=*" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: exactly one row, with the name used in the booking.

- [ ] **Step 4: Book a second appointment with the SAME phone but a different name**

Use the same phone number again, but type a different first name this time.

- [ ] **Step 5: Confirm no duplicate was created and the name did not change**

Run the same `clients?phone_e164=eq...` query again.
Expected: still exactly **one** row, and `name` is still the value from the **first** booking (not the second) — proves the "never overwrite an existing client's name" rule holds.

- [ ] **Step 6: Confirm both appointments point to the same client**

Run:
```bash
curl -s "$SUPABASE_URL/rest/v1/appointments?client_phone=eq.5492994999999&select=id,client_id,client_name" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: two rows, both with the **same** `client_id`, and `client_name` differing between them (proving the original per-appointment text snapshot was preserved, un-touched, even though the client record wasn't).

No commit in this task (no files changed) — this is verification only.

---

### Task 9: Backfill script for existing appointments

**Files:**
- Create: `scripts/backfill-clients.mjs`

- [ ] **Step 1: Write the script**

```js
import { createClient } from "@supabase/supabase-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

const supabase = createClient(url, key);

function toPhoneE164(input) {
  const parsed = parsePhoneNumberFromString(input, "AR");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

async function findOrCreateClient(phoneE164, name, lastname) {
  const { data: existing, error: selErr } = await supabase
    .from("clients")
    .select("id")
    .eq("phone_e164", phoneE164)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("clients")
    .insert({ phone_e164: phoneE164, name, lastname })
    .select("id")
    .single();
  if (!insErr) return created.id;

  if (insErr.code === "23505") {
    const { data: raceWinner, error: raceErr } = await supabase
      .from("clients")
      .select("id")
      .eq("phone_e164", phoneE164)
      .single();
    if (raceErr) throw raceErr;
    return raceWinner.id;
  }
  throw insErr;
}

async function main() {
  const { data: appts, error } = await supabase
    .from("appointments")
    .select("id, code, client_name, client_lastname, client_phone")
    .is("client_id", null);
  if (error) throw error;

  const pending = [];
  let linked = 0;

  for (const a of appts ?? []) {
    const phoneE164 = toPhoneE164(a.client_phone);
    if (!phoneE164) {
      pending.push({ id: a.id, code: a.code, client_phone: a.client_phone });
      continue;
    }
    const clientId = await findOrCreateClient(phoneE164, a.client_name, a.client_lastname);
    const { error: updateErr } = await supabase
      .from("appointments")
      .update({ client_id: clientId })
      .eq("id", a.id);
    if (updateErr) throw updateErr;
    linked++;
  }

  console.log(`Vinculados: ${linked}`);
  console.log(`Pendientes de revisión manual: ${pending.length}`);
  if (pending.length > 0) {
    console.log(JSON.stringify(pending, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

This script never writes to `client_name`, `client_lastname`, or `client_phone`
on `appointments` — it only reads them and writes `client_id`. It's safe to
re-run: rows that already have a `client_id` are excluded by the initial
query, and `findOrCreateClient` never overwrites an existing client's name.

- [ ] **Step 2: Commit**

```bash
git add scripts/backfill-clients.mjs
git commit -m "$(cat <<'EOF'
Add one-time backfill script linking existing appointments to clients

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Run and verify the backfill

**No files changed.**

- [ ] **Step 1: Run it against the live "Barber Neo" project**

Run: `node --env-file=.env scripts/backfill-clients.mjs`

- [ ] **Step 2: Read the printed report**

Expected output: a `Vinculados: N` count, a `Pendientes de revisión manual: M` count, and if `M > 0`, a JSON list of `{ id, code, client_phone }` for the ones that need a human to look at them (e.g. garbled phone numbers from early manual testing).

- [ ] **Step 3: Confirm no appointment lost its original data**

Run:
```bash
curl -s "$SUPABASE_URL/rest/v1/appointments?select=id,client_name,client_lastname,client_phone,client_id" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Compare `client_name`/`client_lastname`/`client_phone` against what was there
before this task (from earlier session output/screenshots) — none of those
three columns should have changed for any row. Only `client_id` should now
be populated (or still `null` for anything in the "pendientes" report).

- [ ] **Step 4: Re-run once more to confirm idempotency**

Run: `node --env-file=.env scripts/backfill-clients.mjs`
Expected: `Vinculados: 0` (everything already had a `client_id` from the first run, so the query in Step 1 of the script finds nothing left to do) and the same `Pendientes` count as before (still unresolved, expected).

No commit in this task (no files changed).

---

### Task 11: Final verification and push

**No files changed** — this closes out the etapa.

- [ ] **Step 1: Full type-check and build one more time**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 2: Confirm git log has all of this etapa's commits**

Run: `git log --oneline -10`
Expected: the commits from Tasks 1, 2, 3, 4, 6, 7, 9 (Task 5, 8, 10, 11 change no files) all present, in order, on top of the previous work.

- [ ] **Step 3: Push to trigger the Vercel deploy**

Run: `git push`

- [ ] **Step 4: Confirm the production site still works after deploy**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://neo-barberweb.vercel.app
curl -s -o /dev/null -w "%{http_code}\n" https://neo-barberweb.vercel.app/panel
```
Expected: both `200`.

- [ ] **Step 5: Report to the user**

Summarize: how many clients now exist, how many appointments are linked,
how many need manual review (with their codes), and that the site is live
and unchanged from the client's point of view (no new screens yet — those
are Etapa 3).
