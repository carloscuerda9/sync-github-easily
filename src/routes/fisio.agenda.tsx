import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, User, Clock, MapPin, Check, X, CheckCircle2, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_LABEL, STATUS_COLOR, TYPE_LABEL,
  type AppointmentStatus, type AppointmentType,
  formatDateTime,
} from "@/lib/appointments";

export const Route = createFileRoute("/fisio/agenda")({ component: PhysioAgenda });

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string | null;
  player_id: string;
  player?: { full_name: string | null; email: string } | null;
}

function PhysioAgenda() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("id,scheduled_at,duration_minutes,type,status,notes,player_id")
      .eq("physio_id", user.id)
      .order("scheduled_at", { ascending: true });
    if (error) { toast.error("Error cargando agenda"); setLoading(false); return; }
    const list = (data ?? []) as Appointment[];
    const ids = Array.from(new Set(list.map((a) => a.player_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((a) => { a.player = map.get(a.player_id) ?? null; });
    }
    setAppts(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const update = async (id: string, status: AppointmentStatus, label: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) return toast.error("No se pudo actualizar");
    toast.success(label);
    load();
  };

  const now = Date.now();
  const pending = useMemo(() => appts.filter((a) => a.status === "requested"), [appts]);
  const upcoming = useMemo(
    () => appts.filter((a) => a.status === "confirmed" && new Date(a.scheduled_at).getTime() >= now)
              .sort((a,b)=>+new Date(a.scheduled_at)-+new Date(b.scheduled_at)),
    [appts, now],
  );
  const past = useMemo(
    () => appts.filter((a) => !pending.includes(a) && !upcoming.includes(a))
              .sort((a,b)=>+new Date(b.scheduled_at)-+new Date(a.scheduled_at)),
    [appts, pending, upcoming],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">Solicitudes y citas de tus jugadores.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendientes ({pending.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Historial ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {loading ? <Skeleton /> : pending.length === 0 ? (
            <Empty icon={<Calendar className="h-8 w-8" />} title="Sin solicitudes" desc="Cuando un jugador pida cita aparecerá aquí." />
          ) : pending.map((a) => (
            <Card key={a.id} a={a}
              actions={
                <>
                  <Button size="sm" onClick={() => update(a.id, "confirmed", "Cita confirmada")}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Aceptar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => update(a.id, "rejected", "Cita rechazada")}>
                    <X className="mr-1 h-3.5 w-3.5" /> Rechazar
                  </Button>
                </>
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {loading ? <Skeleton /> : upcoming.length === 0 ? (
            <Empty icon={<Calendar className="h-8 w-8" />} title="Sin citas próximas" desc="Cuando confirmes solicitudes aparecerán aquí." />
          ) : upcoming.map((a) => (
            <Card key={a.id} a={a}
              actions={
                <>
                  <Button size="sm" onClick={() => update(a.id, "completed", "Cita marcada como completada")}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Completar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => update(a.id, "cancelled", "Cita cancelada")}>
                    Cancelar
                  </Button>
                </>
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="past" className="mt-4 space-y-3">
          {loading ? <Skeleton /> : past.length === 0 ? (
            <Empty icon={<CalendarOff className="h-8 w-8" />} title="Historial vacío" desc="Aquí verás las citas pasadas y resueltas." />
          ) : past.map((a) => <Card key={a.id} a={a} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ a, actions }: { a: Appointment; actions?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{a.player?.full_name || a.player?.email || "Jugador"}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(a.scheduled_at)} · {a.duration_minutes} min</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{TYPE_LABEL[a.type]}</span>
          </div>
          {a.notes && <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{a.notes}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[a.status]}`}>
          {STATUS_LABEL[a.status]}
        </span>
      </div>
      {actions && <div className="mt-3 flex flex-wrap justify-end gap-2">{actions}</div>}
    </div>
  );
}

function Empty({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div>;
}
