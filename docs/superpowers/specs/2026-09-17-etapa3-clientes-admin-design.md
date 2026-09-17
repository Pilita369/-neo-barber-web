# Etapa 3 — Ficha administrativa de clientes y calendario mensual

Parte del plan más grande de transformación del turnero. Este documento cubre
**solo la Etapa 3**: una sección "Clientes" de solo lectura en el panel de
administración, construida sobre la tabla `clients` y la relación
`appointments.client_id` que ya existen desde la Etapa 2.

## Objetivo

David (o quien administre) puede buscar un cliente por nombre o WhatsApp,
ver su ficha con los datos principales, su próximo turno, su última visita,
cuántos cortes completó (histórico y en el mes que esté mirando), y navegar
un calendario mensual donde los días con un corte completado quedan
resaltados — pudiendo tocar cualquiera de esos días para ver el detalle.

## Fuera de alcance de esta etapa

- Crear o editar clientes.
- Crear turnos desde el panel ("Nuevo turno").
- Notas privadas del barbero.
- Precios, promociones, descuentos, fidelización, mensajería automática.
- Cualquier migración de base de datos — esta etapa es 100% lectura sobre el
  esquema ya existente.

## Mapeo de términos

"COMPLETADO" = el estado `atendido` que ya existe en `appointment_status`.
No se introduce ningún estado nuevo.

## Datos y consultas (sin cambios de esquema)

Todas las consultas van dentro de un archivo nuevo, `src/lib/clients.functions.ts`,
separado de `admin.functions.ts` (que ya venía señalado como candidato a
dividirse) para no seguir agrandando ese archivo. Mismo patrón de seguridad
que ya usa todo el panel: middleware `requireSupabaseAuth` + `assertAdmin()`
al inicio de cada handler.

### `listClients({ search })`

1. Busca en `clients` por `search` (si viene): `ilike` sobre `name`/`lastname`,
   o coincidencia sobre el teléfono (comparando tanto contra `phone_e164`
   como contra los dígitos sueltos del término buscado, para que escribir
   "2991111111" encuentre a alguien guardado como `+5492991111111`).
2. Con los `id` resultantes, trae todos los `appointments` de esos clientes
   con `status = 'atendido'` (solo `client_id`, `date`).
3. Agrega en TypeScript (no en SQL — el volumen de datos de una barbería
   individual no lo justifica): por cliente, `total_completados` = cantidad
   de filas, `last_visit` = fecha máxima (o `null` si no tiene ninguna).
4. Devuelve la lista combinada, ordenada por nombre.

### `getClientProfile({ clientId })`

- Datos básicos del cliente (`clients` por `id`).
- Próximo turno: `appointments` de ese cliente con `status in ('pendiente','confirmado')`
  y `date >= hoy`, el más próximo por fecha/hora (o `null` si no tiene).
- Última visita: `appointments` con `status = 'atendido'`, la más reciente
  por fecha/hora (o `null`).
- Total histórico de completados: cantidad de `appointments` con
  `status = 'atendido'` para ese cliente.

### `getClientMonth({ clientId, year, month })`

Trae únicamente los `appointments` de ese cliente con `status = 'atendido'`
dentro del mes pedido (fecha, hora, servicio). El propio front deriva de acá:

- El **conteo de "completados del mes"** = cantidad de filas devueltas
  (no cantidad de días distintos) — si un mismo día tiene dos turnos
  completados, cuenta como 2, aunque el calendario solo resalte ese día una
  vez.
- Los **días a resaltar** = el conjunto de fechas distintas presentes en el
  resultado.
- El **detalle al tocar un día** = todas las filas devueltas cuya fecha
  coincide con el día tocado (puede ser más de una).

Esta función se vuelve a llamar cada vez que se cambia de mes en el
calendario, así el conteo del mes queda atado al mes que se está mirando,
como se definió.

## Frontend

### Navegación del panel

`src/routes/panel/index.tsx` gana dos pestañas simples arriba ("Agenda" /
"Clientes"). No se toca ninguna lógica de la Agenda existente — solo se
envuelve en una navegación mínima.

### `src/routes/panel/clientes/index.tsx` (listado)

- Input de búsqueda (nombre o teléfono).
- Por cliente: nombre, `"N cortes · Última visita: DD/MM/YYYY"` (o
  `"Sin visitas completadas"` si `total_completados` es 0), WhatsApp como
  texto simple (la acción de contacto por WhatsApp es específicamente de la
  ficha individual, no del listado).
- Tocar una fila navega a `/panel/clientes/$id`.
- Estilo `card-neo`, consistente con el resto del panel.

### `src/routes/panel/clientes/$id.tsx` (ficha)

- **Datos**: nombre, WhatsApp (tocar el número abre `wa.me` con ese
  contacto — reutilizando el helper `waLink` que ya existe en
  `datetime.ts` —, sin mensaje prellenado ni automatización, es solo un
  acceso directo de contacto), "cliente desde" (fecha de alta).
- **Resumen**: próximo turno (o "Sin turnos próximos"), última visita (o
  "—"), completados del mes que se esté viendo, completados histórico
  total.
- **Calendario mensual**: se reutiliza el componente `Calendar` ya existente
  en `src/components/ui/calendar.tsx` (basado en `react-day-picker`, ya
  instalado y con el estilo oscuro/dorado de la app aplicado) en vez de
  construir una grilla nueva desde cero. Los días con al menos un turno
  `atendido` se marcan vía `modifiers`/`modifiersClassNames` con el dorado
  de la app; `onMonthChange` dispara una nueva llamada a `getClientMonth`;
  `onDayClick` sobre un día marcado muestra debajo del calendario la lista
  de turnos `atendido` de ese día (servicio + hora). Un cliente sin ningún
  `atendido` en el mes simplemente no tiene días marcados — el calendario
  se ve, solo que vacío de resaltados.

## Verificación

- `npx tsc --noEmit` y `npm run build` sin errores.
- Buscar por nombre parcial y por distintos formatos de teléfono en
  `/panel/clientes`, contra clientes reales que ya existen en la base
  (incluyendo el cliente con 7 turnos históricos de la Etapa 2).
- Abrir esa ficha: el total histórico debe coincidir con lo que hay en la
  base, el calendario debe resaltar los días correctos del mes en que
  ocurrieron esos turnos, y tocar un día resaltado debe mostrar el/los
  turno(s) correcto(s) (incluyendo el caso de dos turnos `atendido` el
  mismo día, si se da).
- Navegar a un mes sin turnos `atendido` para ese cliente y confirmar que
  el conteo muestra 0 y el calendario no rompe.
- Abrir la ficha de un cliente sin ningún `atendido` (por ejemplo el
  cliente de prueba `Ana` de la Etapa 2, si solo tiene turnos `pendiente`)
  y confirmar que se ve correctamente con "Sin visitas completadas" /
  "última visita: —", sin errores.
- Tocar el WhatsApp de la ficha y confirmar que abre `wa.me` con el número
  correcto.
