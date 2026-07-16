import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartPulse, ClipboardList, Plus, User, Clock, CheckCircle2, AlertCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, TYPE_LABEL, type AppointmentType } from "@/lib/appointments";

export const Route = createFileRoute("/fisio/historico")({ component: FisioHistorico });

interface Appt {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  notes: string | null;
  player_id: string;
  player?: { full_name: string | null; email: string } | null;
  session?: SessionRow | null;
}
interface SessionRow {
  id: string;
  appointment_id: string;
  physio_notes: string | null;
  player_feedback: string | null;
  duration_actual: number | null;
}
interface Player { id: string; full_name: string | null; email: string }
interface Injury {
  id: string;
  player_id: string;
  injury_date: string;
  body_part: string;
  injury_type: string;
  severity: string | null;
  treatment: string | null;
  recovery_days: number | null;
  notes: string | null;
  player?: Player | null;
}

const SEVERITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "grave", label: "Grave" },
];

function FisioHistorico() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra tratamientos por cita y mantén el listado de lesiones.
        </p>
      </div>

      <Tabs defaultValue="treatments">
        <TabsList>
          <TabsTrigger value="treatments">
            <ClipboardList className="mr-1 h-3.5 w-3.5" /> Tratamientos
          </TabsTrigger>
          <TabsTrigger value="injuries">
            <HeartPulse className="mr-1 h-3.5 w-3.5" /> Lesiones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="treatments" className="mt-4">
          <TreatmentsTab />
        </TabsContent>
        <TabsContent value="injuries" className="mt-4">
          <InjuriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Treatments ---------------- */

function TreatmentsTab() {
  const { user } = useAuth();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: aData, error } = await supabase
      .from("appointments")
      .select("id,scheduled_at,duration_minutes,type,notes,player_id")
      .eq("physio_id", user.id)
      .eq("status", "completed")
      .order("scheduled_at", { ascending: false });
    if (error) { toast.error("Error cargando citas"); setLoading(false); return; }
    const list = (aData ?? []) as Appt[];
    const ids = list.map((a) => a.id);
    const playerIds = Array.from(new Set(list.map((a) => a.player_id)));
    const [{ data: sess }, { data: profs }] = await Promise.all([
      ids.length
        ? supabase.from("sessions").select("id,appointment_id,physio_notes,player_feedback,duration_actual").in("appointment_id", ids)
        : Promise.resolve({ data: [] as SessionRow[] }),
      playerIds.length
        ? supabase.from("profiles").select("id,full_name,email").in("id", playerIds)
        : Promise.resolve({ data: [] as Player[] }),
    ]);
    const sessMap = new Map((sess ?? []).map((s: any) => [s.appointment_id, s as SessionRow]));
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p as Player]));
    list.forEach((a) => {
      a.session = sessMap.get(a.id) ?? null;
      a.player = pMap.get(a.player_id) ?? null;
    });
    setAppts(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const visible = useMemo(
    () => filter === "pending" ? appts.filter((a) => !a.session) : appts,
    [appts, filter],
  );

  const pendingCount = appts.filter((a) => !a.session).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {pendingCount > 0
            ? <span className="inline-flex items-center gap-1"><AlertCircle className="h-4 w-4 text-amber-600" /> {pendingCount} tratamiento{pendingCount === 1 ? "" : "s"} por rellenar</span>
            : <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-primary" /> Todo al día</span>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Pendientes</Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todas</Button>
        </div>
      </div>

      {loading ? <Skeleton /> : visible.length === 0 ? (
        <Empty
          icon={<ClipboardList className="h-8 w-8" />}
          title={filter === "pending" ? "Sin tratamientos pendientes" : "Aún no hay citas completadas"}
          desc="Cuando marques una cita como completada aparecerá aquí."
        />
      ) : (
        visible.map((a) => <TreatmentCard key={a.id} a={a} onSaved={load} />)
      )}
    </div>
  );
}

function TreatmentCard({ a, onSaved }: { a: Appt; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(a.session?.physio_notes ?? "");
  const [feedback, setFeedback] = useState(a.session?.player_feedback ?? "");
  const [duration, setDuration] = useState<string>(
    a.session?.duration_actual != null ? String(a.session.duration_actual) : String(a.duration_minutes),
  );

  useEffect(() => {
    if (open) {
      setNotes(a.session?.physio_notes ?? "");
      setFeedback(a.session?.player_feedback ?? "");
      setDuration(a.session?.duration_actual != null ? String(a.session.duration_actual) : String(a.duration_minutes));
    }
  }, [open, a]);

  const save = async () => {
    if (!notes.trim()) return toast.error("Añade una nota del tratamiento");
    setSaving(true);
    const payload = {
      appointment_id: a.id,
      physio_notes: notes.trim(),
      player_feedback: feedback.trim() || null,
      duration_actual: duration ? Number(duration) : null,
    };
    const { error } = a.session
      ? await supabase.from("sessions").update(payload).eq("id", a.session.id)
      : await supabase.from("sessions").insert(payload);
    setSaving(false);
    if (error) return toast.error("No se pudo guardar");
    toast.success("Tratamiento guardado");
    setOpen(false);
    onSaved();
  };

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
            <span>{TYPE_LABEL[a.type]}</span>
          </div>
          {a.session?.physio_notes && (
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-foreground/80">{a.session.physio_notes}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.session ? "bg-primary/15 text-primary" : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"}`}>
          {a.session ? "Rellenado" : "Pendiente"}
        </span>
      </div>
      <div className="mt-3 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant={a.session ? "outline" : "default"}>
              {a.session ? <><Pencil className="mr-1 h-3.5 w-3.5" /> Editar tratamiento</> : <><Plus className="mr-1 h-3.5 w-3.5" /> Rellenar tratamiento</>}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tratamiento de la cita</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tratamiento / técnicas aplicadas *</Label>
                <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: masaje descontracturante en isquios, movilización cadera, punción seca..." />
              </div>
              <div>
                <Label>Feedback del jugador</Label>
                <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Cómo se ha encontrado, sensaciones, dolor..." />
              </div>
              <div>
                <Label>Duración real (min)</Label>
                <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

/* ---------------- Injuries ---------------- */

function InjuriesTab() {
  const { user, club } = useAuth();
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Injury | null>(null);

  const load = async () => {
    if (!user || !club) return;
    setLoading(true);
    const [{ data: pData }, { data: iData }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").eq("club_id", club.id).eq("role", "player"),
      supabase.from("injuries").select("*").order("injury_date", { ascending: false }),
    ]);
    const pMap = new Map((pData ?? []).map((p: any) => [p.id, p as Player]));
    const list = ((iData ?? []) as Injury[]).map((i) => ({ ...i, player: pMap.get(i.player_id) ?? null }));
    setPlayers((pData ?? []) as Player[]);
    setInjuries(list);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, club?.id]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (i: Injury) => { setEditing(i); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{injuries.length} lesión{injuries.length === 1 ? "" : "es"} registrada{injuries.length === 1 ? "" : "s"}</div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-3.5 w-3.5" /> Nueva lesión</Button>
      </div>

      {loading ? <Skeleton /> : injuries.length === 0 ? (
        <Empty icon={<HeartPulse className="h-8 w-8" />} title="Sin lesiones" desc="Añade la primera lesión de un jugador." />
      ) : (
        <div className="space-y-2">
          {injuries.map((i) => (
            <div key={i.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{i.player?.full_name || i.player?.email || "Jugador"}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-medium">{i.body_part}</span> · {i.injury_type}
                    {i.severity && <> · <span className="text-muted-foreground">{i.severity}</span></>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(i.injury_date).toLocaleDateString("es-ES")}
                    {i.recovery_days != null && <> · Recuperación estimada: {i.recovery_days} días</>}
                  </div>
                  {i.treatment && <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-foreground/80"><span className="font-medium">Tratamiento: </span>{i.treatment}</p>}
                  {i.notes && <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{i.notes}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(i)}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <InjuryDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        players={players}
        onSaved={load}
      />
    </div>
  );
}

function InjuryDialog({
  open, onOpenChange, editing, players, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Injury | null;
  players: Player[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    player_id: "",
    injury_date: new Date().toISOString().slice(0, 10),
    body_part: "",
    injury_type: "",
    severity: "leve",
    treatment: "",
    recovery_days: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        player_id: editing.player_id,
        injury_date: editing.injury_date,
        body_part: editing.body_part,
        injury_type: editing.injury_type,
        severity: editing.severity ?? "leve",
        treatment: editing.treatment ?? "",
        recovery_days: editing.recovery_days != null ? String(editing.recovery_days) : "",
        notes: editing.notes ?? "",
      } : {
        player_id: "",
        injury_date: new Date().toISOString().slice(0, 10),
        body_part: "",
        injury_type: "",
        severity: "leve",
        treatment: "",
        recovery_days: "",
        notes: "",
      });
    }
  }, [open, editing]);

  const save = async () => {
    if (!user) return;
    if (!form.player_id) return toast.error("Selecciona un jugador");
    if (!form.body_part.trim() || !form.injury_type.trim()) return toast.error("Completa zona y tipo de lesión");
    setSaving(true);
    const payload = {
      player_id: form.player_id,
      physio_id: user.id,
      injury_date: form.injury_date,
      body_part: form.body_part.trim(),
      injury_type: form.injury_type.trim(),
      severity: form.severity || null,
      treatment: form.treatment.trim() || null,
      recovery_days: form.recovery_days ? Number(form.recovery_days) : null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("injuries").update(payload).eq("id", editing.id)
      : await supabase.from("injuries").insert(payload);
    setSaving(false);
    if (error) return toast.error(editing ? "No se pudo actualizar" : "No se pudo crear");
    toast.success(editing ? "Lesión actualizada" : "Lesión registrada");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lesión" : "Nueva lesión"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Jugador *</Label>
            <Select value={form.player_id} onValueChange={(v) => setForm((f) => ({ ...f, player_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona un jugador" /></SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={form.injury_date} onChange={(e) => setForm((f) => ({ ...f, injury_date: e.target.value }))} />
            </div>
            <div>
              <Label>Gravedad</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Zona *</Label>
              <Input value={form.body_part} onChange={(e) => setForm((f) => ({ ...f, body_part: e.target.value }))} placeholder="Ej.: Isquios der." />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Input value={form.injury_type} onChange={(e) => setForm((f) => ({ ...f, injury_type: e.target.value }))} placeholder="Ej.: Contractura" />
            </div>
          </div>
          <div>
            <Label>Días estimados de recuperación</Label>
            <Input type="number" min={0} value={form.recovery_days} onChange={(e) => setForm((f) => ({ ...f, recovery_days: e.target.value }))} />
          </div>
          <div>
            <Label>Tratamiento</Label>
            <Textarea rows={3} value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Shared ---------------- */

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
  return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div>;
}
