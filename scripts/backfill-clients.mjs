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
