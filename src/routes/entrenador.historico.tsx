import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSkeleton } from "@/components/ListSkeleton";
import { HeartPulse, Ban, Stethoscope, User, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, TYPE_LABEL, type AppointmentType } from "@/lib/appointments";

export const Route = createFileRoute("/entrenador/historico")({
  head: () => ({
    meta: [
      { title: "Histórico del equipo | We Fix You" },
      { name: "description", content: "Consulta los tratamientos del fisio, las bajas y la situación de cada jugador de tu club." },
      { property: "og:title", content: "Histórico del equipo | We Fix You" },
      { property: "og:description", content: "Tratamientos, bajas y estado de los jugadores del club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachHistorico,
});

type TagColor = "green" | "yellow" | "orange" | "red";
const TAG_META: Record<TagColor, { label: string; dot: string; text: string; bg: string; border: string }> = {
  green: { label: "Verde", dot: "bg-green-500", text: "text-green-700 dark:text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  yellow: { label: "Amarillo", dot: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/40" },
  orange: { label: "Naranja", dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  red: { label: "Rojo", dot: "bg-red-500", text: "text-red-700 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
};

interface Player { id: string; full_name: string | null; email: string }
interface SessionRow { appointment_id: string; physio_notes: string | null; duration_actual: number | null }
interface Appt {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  player_id: string;
  notes: string | null;
}
interface Leave {
  id: string;
  player_id: string;
  type: "deportiva" | "medica";
  reason: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
}

function CoachHistorico() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tags, setTags] = useState<Record<string, TagColor>>({});
  const [appts, setAppts] = useState<Appt[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionRow>>({});
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [search, setSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [pRes, tRes, aRes, lRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email").eq("role", "player").eq("status", "approved"),
        supabase.from("player_tags").select("player_id,color"),
        supabase.from("appointments").select("id,scheduled_at,duration_minutes,type,player_id,notes").eq("status", "completed").order("scheduled_at", { ascending: false }),
        supabase.from("player_leaves").select("id,player_id,type,reason,start_date,end_date,active").order("start_date", { ascending: false }),
      ]);

      if (pRes.error || aRes.error) toast.error("Error cargando el histórico del club");

      setPlayers((pRes.data ?? []) as Player[]);

      const tagMap: Record<string, TagColor> = {};
      ((tRes.data ?? []) as { player_id: string; color: TagColor }[]).forEach((t) => { tagMap[t.player_id] = t.color; });
      setTags(tagMap);

      const apps = (aRes.data ?? []) as Appt[];
      setAppts(apps);
      setLeaves((lRes.data ?? []) as Leave[]);

      if (apps.length) {
        const { data: sData } = await supabase
          .from("sessions")
          .select("appointment_id,physio_notes,duration_actual")
          .in("appointment_id", apps.map((a) => a.id));
        const sMap: Record<string, SessionRow> = {};
        ((sData ?? []) as SessionRow[]).forEach((s) => { sMap[s.appointment_id] = s; });
        setSessions(sMap);
      }
      setLoading(false);
    })();
  }, [user]);

  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p?.full_name ?? p?.email ?? "Jugador";
  };

  const visiblePlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) =>
      !q || (p.full_name ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [players, search]);

  const filteredAppts = useMemo(
    () => appts.filter((a) => playerFilter === "all" || a.player_id === playerFilter),
    [appts, playerFilter]
  );
  const filteredLeaves = useMemo(
    () => leaves.filter((l) => playerFilter === "all" || l.player_id === playerFilter),
    [leaves, playerFilter]
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Histórico del equipo</h1>
        <p className="text-sm text-muted-foreground">
          Jugadores que pasan por el fisio, tratamientos registrados y su situación actual.
        </p>
      </div>

      <Tabs defaultValue="situacion">
        <TabsList className="mb-4">
          <TabsTrigger value="situacion">Situación</TabsTrigger>
          <TabsTrigger value="tratamientos">Tratamientos</TabsTrigger>
          <TabsTrigger value="bajas">Bajas</TabsTrigger>
        </TabsList>

        <TabsContent value="situacion">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Buscar jugador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading ? <ListSkeleton /> : visiblePlayers.length === 0 ? (
            <EmptyState text="No hay jugadores en tu club todavía." />
          ) : (
            <div className="space-y-2">
              {visiblePlayers.map((p) => {
                const color = tags[p.id];
                const meta = color ? TAG_META[color] : null;
                const activeLeave = leaves.find((l) => l.player_id === p.id && l.active);
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.full_name ?? p.email}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {activeLeave
                          ? `Baja ${activeLeave.type} desde ${activeLeave.start_date}`
                          : `${appts.filter((a) => a.player_id === p.id).length} sesiones con el fisio`}
                      </div>
                    </div>
                    {meta ? (
                      <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.border} ${meta.text}`}>
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
                      </span>
                    ) : (
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">Sin color</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tratamientos">
          <PlayerSelect players={players} value={playerFilter} onChange={setPlayerFilter} />
          {loading ? <ListSkeleton /> : filteredAppts.length === 0 ? (
            <EmptyState text="Todavía no hay tratamientos registrados." />
          ) : (
            <div className="space-y-2">
              {filteredAppts.map((a) => {
                const s = sessions[a.id];
                return (
                  <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        {nameOf(a.player_id)}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDateTime(a.scheduled_at)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {TYPE_LABEL[a.type]} · {s?.duration_actual ?? a.duration_minutes} min
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {s?.physio_notes?.trim()
                        ? s.physio_notes
                        : <span className="text-muted-foreground">El fisio aún no ha registrado el motivo del tratamiento.</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bajas">
          <PlayerSelect players={players} value={playerFilter} onChange={setPlayerFilter} />
          {loading ? <ListSkeleton /> : filteredLeaves.length === 0 ? (
            <EmptyState text="No hay bajas registradas." />
          ) : (
            <div className="space-y-2">
              {filteredLeaves.map((l) => (
                <div key={l.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Ban className="h-4 w-4 text-destructive" />
                      {nameOf(l.player_id)}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.active ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {l.active ? "Activa" : "Finalizada"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Baja {l.type} · {l.start_date}{l.end_date ? ` → ${l.end_date}` : ""}
                  </div>
                  {l.reason && <p className="mt-2 whitespace-pre-wrap text-sm">{l.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlayerSelect({ players, value, onChange }: { players: Player[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 max-w-xs">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Todos los jugadores" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los jugadores</SelectItem>
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <HeartPulse className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
