import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail } from "@/lib/staff-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Ingresar — Neo Barbería" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password: pin,
    });
    setLoading(false);
    if (error) {
      toast.error("Número o PIN incorrecto");
      return;
    }
    navigate({ to: "/panel" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <Lock className="mx-auto size-8 text-gold" />
        <h1 className="mt-3 font-display text-4xl tracking-wide">Panel de administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Neo Barbería</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-muted-foreground">Número de WhatsApp</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="299 XXX XXXX"
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted-foreground">PIN</span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            type="password"
            inputMode="numeric"
            maxLength={6}
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base tracking-[0.3em] outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display text-2xl tracking-wide text-primary-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          Ingresar
        </button>
      </form>
    </main>
  );
}
