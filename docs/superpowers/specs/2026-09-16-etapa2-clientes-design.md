# Etapa 2 — Ficha única de cliente y normalización de teléfonos

Parte de un plan más grande (28 puntos) para transformar el turnero actual en un
sistema de gestión de clientes y turnos. Este documento cubre **solo la Etapa 2**:
la base de datos y la lógica de identificación de clientes. Las etapas
siguientes (sección Clientes en el panel, notas privadas, nuevo turno desde
administración, reprogramar, portal del cliente, etc.) tienen su propio diseño
cuando se aborden.

## Objetivo

Cada cliente debe tener una ficha única, identificada de forma exacta y
determinística por su número de WhatsApp normalizado, sin necesidad de fusión
de datos ni heurísticas de coincidencia por nombre. Los turnos ya existentes
deben quedar vinculados a esa ficha sin perder ni alterar los datos que ya
tienen guardados.

## Fuera de alcance de esta etapa

- Pantallas nuevas (sección "Clientes" del panel → Etapa 3).
- Notas privadas del barbero → Etapa 3 (tabla separada, RLS solo-admin).
- `clients.claimed_by_user_id` y cualquier vínculo con cuentas de cliente
  autenticadas → Etapa 7.
- Cambios al flujo de reserva pública o al panel más allá de lo necesario para
  completar `client_id` al crear un turno.

## Esquema de base de datos

### Tabla `clients` (nueva)

| columna | tipo | notas |
|---|---|---|
| `id` | uuid, PK | `gen_random_uuid()` |
| `phone_e164` | text, **UNIQUE**, not null | formato `+54911...` — identidad técnica del cliente |
| `name` | text, not null | |
| `lastname` | text, nullable | |
| `created_at` | timestamptz, not null | default `now()` |
| `updated_at` | timestamptz, not null | default `now()`, se actualiza en cada upsert |

RLS: sin políticas públicas. Todo el acceso a `clients` pasa por `service_role`
en servidor (mismo patrón que ya usan `appointments`, `services`, etc. hoy).
Se agregará una política admin-only recién cuando el panel necesite leerla
directamente con el JWT del staff (Etapa 3) — no hace falta antes.

### `appointments.client_id` (nueva columna)

`uuid`, **nullable**, FK a `clients(id)`. Nullable porque:
- Turnos existentes se completan vía backfill, y algunos podrían no poder
  normalizarse con confianza (ver sección Backfill).
- Los datos originales (`client_name`, `client_lastname`, `client_phone`) en
  `appointments` **no se tocan, no se sobrescriben y no se eliminan**. Siguen
  siendo el registro histórico de lo que se ingresó al momento de reservar.
  `client_id` es un vínculo adicional, no un reemplazo.

### Migración retroactiva (housekeeping)

Los últimos 3 cambios de esquema (`needs_approval` en `appointments`,
`app_role` con `superadmin`, tabla `staff_accounts`) se aplicaron directo en
el SQL Editor de Supabase y nunca quedaron como archivo de migración en el
repo. Antes de sumar el esquema de esta etapa, se genera ese archivo
retroactivo con guardas (`if not exists` / `add value if not exists`) para
que el repo refleje el estado real de la base sin fallar si se corre de nuevo.

## Normalización de teléfonos (`src/lib/phone.ts`, nuevo)

- Librería: `libphonenumber-js`, región por defecto `AR`.
- Función `toPhoneE164(input: string): string | null` — devuelve el número en
  formato E.164 canónico, o `null` si `libphonenumber-js` no puede parsearlo
  como un número argentino válido (nunca lanza una excepción ni fuerza un
  resultado dudoso).
- Se usa en el momento de reservar (público o admin), nunca se duplica en SQL.

## Identificación de cliente — upsert atómico, sin fusiones

El RPC `create_appointment` se extiende para aceptar `p_phone_e164` (ya
normalizado por la capa TypeScript) y, dentro de la misma transacción que ya
usa para el lock de turnos, hacer:

```sql
insert into public.clients (phone_e164, name, lastname)
values (p_phone_e164, p_client_name, p_client_lastname)
on conflict (phone_e164) do update set updated_at = now()
returning id into v_client_id;
```

- La coincidencia es **exacta** por `phone_e164` — nunca por nombre, nunca
  aproximada. No existe lógica de "coincidencia dudosa" que fusionar: dos
  teléfonos normalizados iguales son la misma persona por definición; dos
  distintos son personas distintas.
- El `on conflict ... do update set updated_at = now()` es un truco estándar
  para poder recuperar el `id` de la fila existente con `returning`, sin
  tocar `name`/`lastname`/`phone_e164` de esa fila. **El nombre de una ficha
  existente nunca se sobrescribe** con el de una reserva nueva.
- El `UNIQUE constraint` en `phone_e164` es lo que hace esto seguro ante dos
  reservas simultáneas con el mismo teléfono nuevo (la misma garantía de
  atomicidad que ya usa el lock de turnos, aplicada acá al alta de cliente).

Si `p_phone_e164` es `null` (el teléfono no pudo normalizarse), el turno se
crea igual pero sin `client_id` — no se bloquea la reserva por esto.

## Backfill de turnos existentes

Script único (Node + `libphonenumber-js` + `SUPABASE_SERVICE_ROLE_KEY`),
ejecutado una sola vez de forma manual, no como parte del build:

1. Trae todos los turnos con `client_id is null`.
2. Para cada uno, intenta normalizar `client_phone` con `toPhoneE164`.
3. **Si normaliza con éxito:** upsert en `clients` (mismo criterio que el RPC:
   no sobrescribe nombre si ya existe) y `update appointments set client_id = ...`.
4. **Si NO normaliza con confianza:** no crea ni asocia ningún cliente, deja
   `client_id` en `null` para ese turno, y lo agrega a un reporte final.
5. Al terminar, imprime un resumen: cuántos turnos se vincularon, cuántos
   quedaron pendientes de revisión manual (con su `id`, `code` y el teléfono
   original tal cual está guardado, para que se puedan revisar a mano después).
6. No modifica `client_name`, `client_lastname` ni `client_phone` en ningún
   caso — son de solo lectura para este script.

Es re-ejecutable sin duplicar: los turnos que ya tienen `client_id` se
excluyen de entrada, y el upsert de `clients` es idempotente por diseño.

## Verificación

- `npx tsc --noEmit` y `npm run build` sin errores.
- Reservar un turno nuevo desde `/reservar` con un teléfono nuevo → aparece
  una fila nueva en `clients` con ese `phone_e164`.
- Reservar de nuevo con el mismo teléfono (distinto nombre a propósito) →
  **no** se crea un segundo cliente, y el nombre de la ficha original no
  cambia.
- Correr el backfill contra los turnos de prueba existentes → confirmar
  `client_id` poblado donde corresponde y el reporte de pendientes si aplica.
- Confirmar que `appointments.client_name/lastname/phone` no cambiaron de
  valor para ninguna fila existente.
