import { useState } from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { waLink } from "@/lib/datetime";

function urlPublica() {
  return typeof window !== "undefined" ? `${window.location.origin}/` : "";
}

export function CompartirWebButton() {
  const [open, setOpen] = useState(false);

  async function compartir() {
    const url = urlPublica();
    const text = "Reservá tu turno en Neo Barbería";
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Neo Barbería", text, url });
      } catch {
        // el usuario cerró el selector nativo, no hacemos nada
      }
      return;
    }
    setOpen(true);
  }

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(urlPublica());
      toast.success("Enlace copiado");
      setOpen(false);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  return (
    <>
      <button
        onClick={compartir}
        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <Share2 className="size-3.5" /> Compartir Neo Barbería
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir Neo Barbería</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={copiarEnlace}
              className="flex w-full items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium"
            >
              <Copy className="size-4" /> Copiar enlace
            </button>
            <a
              href={waLink("", `Reservá tu turno en Neo Barbería: ${urlPublica()}`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="btn-gold-outline flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
            >
              <MessageCircle className="size-4" /> Enviar por WhatsApp
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
