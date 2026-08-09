import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListSkeleton } from "@/components/ListSkeleton";
import { formatDateTime, TYPE_LABEL, type AppointmentType } from "@/lib/appointments";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/historico")({ component: AdminHistorico });

interface Profile { id: string; full_name: string | null; email: string; role: string; club_id: string | null }
interface Session { id: string; appointment_id: string; physio_notes: string | null; player_feedback: string | null; duration_actual: number | null }
interface Appt { id: string; scheduled_at: string; type: AppointmentType; status: string; notes: string | null; player_id: string; physio_id: string }
interface Leave { id: string; player_id: string; physio_id: string; type: "deportiva" | "medica"; reason: string | null; start_date: string; end_date: string | null; active: boolean }
interface Report { id: string; player_id: string; created_at: string; context: string; moment: string; action_type: string; body_part: string; observations: string | null; reviewed: boolean }
interface Tag { player_id: string; color: string; updated_at: string }

const COLOR_CLASS: Record<string, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-yellow-400",
  naranja: "bg-orange-500",
  rojo: "bg-red-500",
};

function AdminHistorico() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    (async () => {
      const [p, a, s, l, r, t] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,role,club_id"),
        supabase.from("appointments").select("id,scheduled_at,type,status,notes,player_id,physio_id").order("scheduled_at", { ascending: false }),
        supabase.from("sessions").select("id,appointment_id,physio_notes,player_feedback,duration_actual"),
        supabase.from("player_leaves").select("id,player_id,physio_id,type,reason,start_date,end_date,active").order("start_date", { ascending: false }),
        supabase.from("injury_reports").select("id,player_id,created_at,context,moment,action_type,body_part,observations,reviewed").order("created_at", { ascending: false }),
        supabase.from("player_tags").select("player_id,color,updated_at"),
      ]);
      setLoading(false);
      if (p.error || a.error || s.error || l.error || r.error || t.error) {
        toast.error("Error cargando el histórico");
      }
      setProfiles((p.data ?? []) as Profile[]);
      setAppts((a.data ?? []) as Appt[]);
      setSessions((s.data ?? []) as Session[]);
      setLeaves((l.data ?? []) as Leave[]);
      setReports((r.data ?? []) as Report[]);
      setTags((t.data ?? []) as Tag[]);
    })();
  }, []);

  const nameOf = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.id, p.full_name || p.email]));
    return (id: string) => map.get(id) ?? "—";
  }, [profiles]);

  const sessionByAppt = useMemo(
    () => new Map(sessions.map((s) => [s.appointment_id, s])),
    [sessions],
  );

  if (loading) return <div className="mx-auto max-w-6xl"><ListSkeleton rows={6} /></div>;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Histórico global</h1>
      <Tabs defaultValue="tratamientos">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="tratamientos">Tratamientos</TabsTrigger>
          <TabsTrigger value="bajas">Bajas</TabsTrigger>
          <TabsTrigger value="lesiones">Partes de lesión</TabsTrigger>
          <TabsTrigger value="estado">Estado jugadores</TabsTrigger>
        </TabsList>

        <TabsContent value="tratamientos" className="space-y-3">
          {appts.length === 0 && <Empty text="Sin citas registradas." />}
          {appts.map((a) => {
            const s = sessionByAppt.get(a.id);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{nameOf(a.player_id)}</p>
                  <span className="text-xs text-muted-foreground">{formatDateTime(a.scheduled_at)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fisio: {nameOf(a.physio_id)} · {TYPE_LABEL[a.type] ?? a.type} · {a.status}
                </p>
                {(s?.physio_notes || a.notes) && (
                  <p className="mt-2 text-sm">{s?.physio_notes || a.notes}</p>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="bajas" className="space-y-3">
          {leaves.length === 0 && <Empty text="Sin bajas registradas." />}
          {leaves.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{nameOf(l.player_id)}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  Baja {l.type} {l.active ? "· activa" : ""}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {l.start_date} → {l.end_date ?? "en curso"} · Fisio: {nameOf(l.physio_id)}
              </p>
              {l.reason && <p className="mt-2 text-sm">{l.reason}</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="lesiones" className="space-y-3">
          {reports.length === 0 && <Empty text="Sin partes de lesión." />}
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{nameOf(r.player_id)}</p>
                <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {r.context} · {r.moment} · {r.action_type} · {r.body_part}
                {r.reviewed ? " · revisado" : ""}
              </p>
              {r.observations && <p className="mt-2 text-sm">{r.observations}</p>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="estado" className="space-y-3">
          {tags.length === 0 && <Empty text="Ningún jugador etiquetado." />}
          {tags.map((t) => (
            <div key={t.player_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className={`h-4 w-4 rounded-full ${COLOR_CLASS[t.color] ?? "bg-muted"}`} />
              <p className="font-medium">{nameOf(t.player_id)}</p>
              <span className="ml-auto text-xs text-muted-foreground">{t.color}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
