import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Siren, Paperclip, Download, User, Check } from "lucide-react";
import { toast } from "sonner";
import {
  ACTION_LABEL, CONTEXT_LABEL, LOCATION_LABEL, MOMENT_LABEL,
  formatReportDate, type InjuryReport,
} from "@/lib/injury-reports";

export const Route = createFileRoute("/fisio/lesiones")({
  component: PhysioInjuryReports,
  head: () => ({
    meta: [
      { title: "Lesiones del club | We Fix You" },
      { name: "description", content: "Revisa los partes de lesión enviados por los jugadores de tu club con todos los detalles y adjuntos." },
      { property: "og:title", content: "Lesiones del club | We Fix You" },
      { property: "og:description", content: "Revisa los partes de lesión enviados por los jugadores de tu club con todos los detalles y adjuntos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface PlayerLite { id: string; full_name: string | null; email: string }

function PhysioInjuryReports() {
  const { user, club } = useAuth();
  const [reports, setReports] = useState<InjuryReport[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("injury_reports").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Error cargando lesiones");
    const rows = (data ?? []) as InjuryReport[];
    setReports(rows);
    const ids = [...new Set(rows.map((r) => r.player_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const map: Record<string, PlayerLite> = {};
      ((profs ?? []) as PlayerLite[]).forEach((p) => { map[p.id] = p; });
      setPlayers(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const markReviewed = async (r: InjuryReport) => {
    setReports((rs) => rs.map((x) => (x.id === r.id ? { ...x, reviewed: true } : x)));
    const { error } = await supabase.from("injury_reports").update({ reviewed: true }).eq("id", r.id);
    if (error) {
      setReports((rs) => rs.map((x) => (x.id === r.id ? { ...x, reviewed: false } : x)));
      toast.error("No se pudo marcar como revisado");
    }
  };

  const download = async (r: InjuryReport) => {
    if (!r.file_url) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(r.file_url, 60);
    if (error || !data) return toast.error("No se pudo generar el enlace");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return reports;
    return reports.filter((r) => {
      const p = players[r.player_id];
      return (
        (p?.full_name ?? "").toLowerCase().includes(t) ||
        (p?.email ?? "").toLowerCase().includes(t) ||
        r.body_part.toLowerCase().includes(t)
      );
    });
  }, [reports, players, q]);

  const pending = filtered.filter((r) => !r.reviewed);
  const reviewed = filtered.filter((r) => r.reviewed);

  const list = (rows: InjuryReport[], emptyText: string) =>
    loading ? (
      <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/60" />)}</div>
    ) : rows.length === 0 ? (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><Siren className="h-7 w-7" /></div>
        <h2 className="text-sm font-semibold">{emptyText}</h2>
      </div>
    ) : (
      <div className="space-y-3">
        {rows.map((r) => {
          const p = players[r.player_id];
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <User className="h-4 w-4 text-primary" />
                    {p?.full_name || p?.email || "Jugador"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatReportDate(r.created_at)}</div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <Row k="Zona" v={r.body_part} />
                    <Row k="Acción" v={ACTION_LABEL[r.action_type] ?? r.action_type} />
                    <Row k="Contexto" v={`${CONTEXT_LABEL[r.context] ?? r.context}${r.match_location ? ` · ${LOCATION_LABEL[r.match_location]}` : ""}`} />
                    <Row k="Momento" v={MOMENT_LABEL[r.moment] ?? r.moment} />
                    <Row k="Lesión previa" v={r.previous_same_injury ? "Sí" : "No"} />
                    <Row k="Puede seguir" v={r.can_continue ? "Sí" : "No"} />
                    <Row k="Atendido" v={r.was_attended ? (r.attended_by || "Sí") : "No"} />
                  </dl>

                  {r.observations && <p className="mt-3 text-sm text-foreground/80"><span className="font-medium">Observaciones:</span> {r.observations}</p>}

                  {r.file_url && (
                    <button onClick={() => download(r)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Paperclip className="h-3 w-3" /> Ver adjunto <Download className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {!r.reviewed && (
                  <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => markReviewed(r)}>
                    <Check className="mr-1 h-4 w-4" /> Revisado
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Lesiones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partes enviados por los jugadores de {club?.name ?? "tu club"}.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por jugador o zona…" className="h-11 pl-9" />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Nuevos ({pending.length})</TabsTrigger>
          <TabsTrigger value="reviewed">Revisados ({reviewed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">{list(pending, "No hay partes pendientes")}</TabsContent>
        <TabsContent value="reviewed" className="mt-4">{list(reviewed, "Aún no has revisado ningún parte")}</TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}
