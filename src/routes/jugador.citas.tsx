import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, User, Clock, MapPin, X, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, DURATIONS,
  type AppointmentStatus, type AppointmentType,
  formatDateTime,
} from "@/lib/appointments";

export const Route = createFileRoute("/jugador/citas")({ component: PlayerAppointments });

interface Physio { id: string; full_name: string | null; email: string }
interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string | null;
  physio_id: string;
  physio?: { full_name: string | null; email: string } | null;
}

function PlayerAppointments() {
  const { user, club } = useAuth();
  const [physios, setPhysios] = useState<Physio[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // form
  const [physioId, setPhysioId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);
  const [type, setType] = useState<AppointmentType>("in_person");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [physRes, appRes] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").eq("role", "physio").eq("status", "approved"),
      supabase.from("appointments")
        .select("id,scheduled_at,duration_minutes,type,status,notes,physio_id, physio:profiles!appointments_physio_id_fkey(full_name,email)")
        .eq("player_id", user.id)
        .order("scheduled_at", { ascending: false }),
    ]);
    if (physRes.error) toast.error("Error cargando fisios");
    else setPhysios((physRes.data ?? []) as Physio[]);

    if (appRes.error) {
      // fallback sin embed por si la FK no está nombrada igual
      const { data } = await supabase.from("appointments")
        .select("id,scheduled_at,duration_minutes,type,status,notes,physio_id")
        .eq("player_id", user.id)
        .order("scheduled_at", { ascending: false });
      const list = (data ?? []) as Appointment[];
      // hidratar con perfiles
      const ids = Array.from(new Set(list.map((a) => a.physio_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        list.forEach((a) => { a.physio = map.get(a.physio_id) ?? null; });
      }
      setAppointments(list);
    } else {
      setAppointments((appRes.data ?? []) as unknown as Appointment[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const resetForm = () => {
    setPhysioId(""); setDate(""); setTime(""); setDuration(60); setType("in_person"); setNotes("");
  };

  const submit = async () => {
    if (!user) return;
    if (!physioId) return toast.error("Elige un fisioterapeuta");
    if (!date || !time) return toast.error("Elige fecha y hora");
    const scheduledAt = new Date(`${date}T${time}:00`);
    if (scheduledAt < new Date()) return toast.error("La cita debe ser en el futuro");

    setSubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      player_id: user.id,
      physio_id: physioId,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: duration,
      type,
      status: "requested",
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo crear la cita", { description: error.message });
      return;
    }
    toast.success("Solicitud enviada", { description: "Tu fisio recibirá la petición." });
    setOpen(false);
    resetForm();
    load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error("No se pudo cancelar");
    toast.success("Cita cancelada");
    load();
  };

  const now = Date.now();
  const upcoming = useMemo(
    () => appointments.filter((a) => new Date(a.scheduled_at).getTime() >= now && a.status !== "cancelled" && a.status !== "rejected" && a.status !== "completed").sort((a,b)=>+new Date(a.scheduled_at)-+new Date(b.scheduled_at)),
    [appointments, now],
  );
  const past = useMemo(
    () => appointments.filter((a) => !upcoming.includes(a)),
    [appointments, upcoming],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Mis citas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reserva sesiones con los fisios de {club?.name ?? "tu club"}.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nueva cita</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Reservar cita</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Fisioterapeuta</Label>
                <Select value={physioId} onValueChange={setPhysioId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un fisio" /></SelectTrigger>
                  <SelectContent>
                    {physios.length === 0 && <div className="px-2 py-3 text-sm text-muted-foreground">No hay fisios disponibles en tu club todavía.</div>}
                    {physios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Fecha</Label>
                  <Input type="date" min={todayStr} value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Hora</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Duración</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as AppointmentType[]).map((t) => (
                        <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notas (opcional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Lesión, zona a tratar, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? "Enviando…" : "Solicitar cita"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Historial ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {loading ? <Skeleton /> : upcoming.length === 0 ? (
            <Empty
              icon={<Calendar className="h-8 w-8" />}
              title="Sin citas próximas"
              desc="Pulsa 'Nueva cita' para reservar tu primera sesión."
            />
          ) : upcoming.map((a) => (
            <AppointmentCard key={a.id} a={a} onCancel={() => cancel(a.id)} canCancel />
          ))}
        </TabsContent>
        <TabsContent value="past" className="mt-4 space-y-3">
          {loading ? <Skeleton /> : past.length === 0 ? (
            <Empty
              icon={<CalendarOff className="h-8 w-8" />}
              title="Sin historial todavía"
              desc="Aquí verás tus citas pasadas, completadas o canceladas."
            />
          ) : past.map((a) => <AppointmentCard key={a.id} a={a} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentCard({ a, onCancel, canCancel }: { a: Appointment; onCancel?: () => void; canCancel?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{a.physio?.full_name || a.physio?.email || "Fisio"}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(a.scheduled_at)} · {a.duration_minutes} min</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{TYPE_LABEL[a.type]}</span>
          </div>
          {a.notes && <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{a.notes}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[a.status]}`}>
          {STATUS_LABEL[a.status]}
        </span>
      </div>
      {canCancel && (a.status === "requested" || a.status === "confirmed") && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancelar cita
          </Button>
        </div>
      )}
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
  return (
    <div className="space-y-3">
      {[1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}
    </div>
  );
}
