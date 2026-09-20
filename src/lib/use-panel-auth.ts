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
    navigate({ to: "/" });
  }

  return { authState, cerrarSesion };
}
