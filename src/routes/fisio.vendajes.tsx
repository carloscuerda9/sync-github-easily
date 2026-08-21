import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Bandage, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import {
  ZONE_LABEL, currentWeekStart, formatWeekRange, toISODate, type TapingRequest,
} from "@/lib/taping";

export const Route = createFileRoute("/fisio/vendajes")({
  component: PhysioTaping,
  head: () => ({
    meta: [
      { title: "Vendajes de la semana | We Fix You" },
      { name: "description", content: "Lista de jugadores que han solicitado vendaje para el partido de esta semana y zonas del cuerpo a vendar." },
      { property: "og:title", content: "Vendajes de la semana | We Fix You" },
      { property: "og:description", content: "Lista de jugadores que han solicitado vendaje para el partido de esta semana y zonas del cuerpo a vendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = TapingRequest & { player?: { full_name: string | null; email: string } | null };

function shiftWeek(iso: string, weeks: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + weeks * 7);
  return toISODate(date);
}

function PhysioTaping() {
  const { profile } = useAuth();
  const [week, setWeek] = useState(currentWeekStart());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("taping_requests").select("*").eq("week_start", week);
    if (profile?.club_id) q = q.eq("club_id", profile.club_id);
    const { data } = await q.order("created_at", { ascending: true });
    const list = ((data as TapingRequest[]) ?? []) as Row[];
    if (list.length) {
      const ids = [...new Set(list.map((r) => r.player_id))];
      const { data: ps } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const map = new Map(
        ((ps as { id: string; full_name: string | null; email: string }[]) ?? []).map((p) => [p.id, p]),
      );
      list.forEach((r) => { r.player = map.get(r.player_id) ?? null; });
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [week, profile?.club_id]);

  const totalTapes = rows.reduce((acc, r) => acc + r.zones.length, 0);
  const isCurrent = week === currentWeekStart();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vendajes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Semana del {formatWeekRange(week)}{isCurrent ? " (actual)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={() => setWeek((w) => shiftWeek(w, -1))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeek((w) => shiftWeek(w, 1))} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={load} aria-label="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Jugadores</p>
          <p className="text-2xl font-extrabold">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Vendajes totales</p>
          <p className="text-2xl font-extrabold">{totalTapes}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Bandage className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay solicitudes de vendaje esta semana.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{r.player?.full_name || r.player?.email || "Jugador"}</p>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {r.zones.length} {r.zones.length === 1 ? "vendaje" : "vendajes"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.zones.map((z) => (
                  <span key={z} className="rounded-lg bg-muted px-2 py-1 text-xs">
                    {ZONE_LABEL[z] ?? z}
                  </span>
                ))}
              </div>
              {r.notes && <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
