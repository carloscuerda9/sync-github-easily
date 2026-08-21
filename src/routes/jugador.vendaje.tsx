import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bandage, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  TAPING_ZONES, ZONE_LABEL, currentWeekStart, formatWeekRange, type TapingRequest,
} from "@/lib/taping";

export const Route = createFileRoute("/jugador/vendaje")({
  component: PlayerTaping,
  head: () => ({
    meta: [
      { title: "Solicitar vendaje | We Fix You" },
      { name: "description", content: "Pide tu vendaje para el partido de esta semana indicando las zonas del cuerpo que necesitas." },
      { property: "og:title", content: "Solicitar vendaje | We Fix You" },
      { property: "og:description", content: "Pide tu vendaje para el partido de esta semana indicando las zonas del cuerpo que necesitas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PlayerTaping() {
  const { user, profile } = useAuth();
  const week = currentWeekStart();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<TapingRequest | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("taping_requests")
        .select("*")
        .eq("player_id", user.id)
        .eq("week_start", week)
        .maybeSingle();
      const r = (data as TapingRequest | null) ?? null;
      setRequest(r);
      setZones(r?.zones ?? []);
      setNotes(r?.notes ?? "");
      setLoading(false);
    })();
  }, [user?.id, week]);

  const toggle = (value: string) =>
    setZones((prev) => (prev.includes(value) ? prev.filter((z) => z !== value) : [...prev, value]));

  const save = async () => {
    if (!user) return;
    if (zones.length === 0) {
      toast.error("Marca al menos una zona del cuerpo");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("taping_requests")
      .upsert(
        {
          player_id: user.id,
          club_id: profile?.club_id ?? null,
          week_start: week,
          zones,
          notes: notes.trim() || null,
        },
        { onConflict: "player_id,week_start" },
      )
      .select()
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar la solicitud");
      return;
    }
    setRequest((data as TapingRequest) ?? null);
    toast.success("Vendaje solicitado para esta semana");
  };

  const cancel = async () => {
    if (!request) return;
    setSaving(true);
    const { error } = await supabase.from("taping_requests").delete().eq("id", request.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo cancelar la solicitud");
      return;
    }
    setRequest(null);
    setZones([]);
    setNotes("");
    toast.success("Solicitud cancelada");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Solicitar vendaje</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Semana del {formatWeekRange(week)}. Cada lunes la solicitud se reinicia.
        </p>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bandage className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {request ? "Vendaje solicitado" : "Sin solicitud esta semana"}
              </p>
              <p className="text-xs text-muted-foreground">
                {request
                  ? request.zones.map((z) => ZONE_LABEL[z] ?? z).join(", ")
                  : "Marca las zonas que necesitas vendar"}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {TAPING_ZONES.map((z) => (
              <label
                key={z.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 transition-colors hover:border-primary"
              >
                <Checkbox
                  checked={zones.includes(z.value)}
                  onCheckedChange={() => toggle(z.value)}
                />
                <span className="text-sm">{z.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <Label htmlFor="taping-notes">Observaciones (opcional)</Label>
            <Textarea
              id="taping-notes"
              className="mt-1.5"
              placeholder="Ej. molestia en la parte externa, prefiero vendaje rígido…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={save} disabled={saving}>
              {request ? "Actualizar solicitud" : "Solicitar vendaje"}
            </Button>
            {request && (
              <Button variant="outline" onClick={cancel} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
