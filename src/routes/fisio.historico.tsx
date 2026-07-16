import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ClipboardList, Plus, User, Clock, CheckCircle2, AlertCircle, Pencil,
  Ban, Stethoscope, FileText, Upload, Download, Trash2,
} from "lucide-react";
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

type LeaveType = "deportiva" | "medica";
interface Leave {
  id: string;
  player_id: string;
  physio_id: string;
  type: LeaveType;
  reason: string | null;
  document_url: string | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
  player?: Player | null;
}

function FisioHistorico() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tratamientos por cita y gestión de bajas deportivas y médicas.
        </p>
      </div>

      <Tabs defaultValue="treatments">
        <TabsList>
          <TabsTrigger value="treatments">
            <ClipboardList className="mr-1 h-3.5 w-3.5" /> Tratamientos
          </TabsTrigger>
          <TabsTrigger value="deportiva">
            <Ban className="mr-1 h-3.5 w-3.5" /> Baja deportiva
          </TabsTrigger>
          <TabsTrigger value="medica">
            <Stethoscope className="mr-1 h-3.5 w-3.5" /> Baja médica
          </TabsTrigger>
        </TabsList>

        <TabsContent value="treatments" className="mt-4">
          <TreatmentsTab />
        </TabsContent>
        <TabsContent value="deportiva" className="mt-4">
          <LeavesTab type="deportiva" />
        </TabsContent>
        <TabsContent value="medica" className="mt-4">
          <LeavesTab type="medica" />
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

/* ---------------- Leaves (deportiva / médica) ---------------- */

const LEAVE_META: Record<LeaveType, { title: string; empty: string; docRequired: boolean; reasonRequired: boolean; icon: React.ReactNode }> = {
  deportiva: {
    title: "Baja deportiva",
    empty: "Sin bajas deportivas registradas.",
    docRequired: false,
    reasonRequired: true,
    icon: <Ban className="h-8 w-8" />,
  },
  medica: {
    title: "Baja médica",
    empty: "Sin bajas médicas registradas.",
    docRequired: false,
    reasonRequired: false,
    icon: <Stethoscope className="h-8 w-8" />,
  },
};

function LeavesTab({ type }: { type: LeaveType }) {
  const { user, club } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Leave | null>(null);

  const load = async () => {
    if (!user || !club) return;
    setLoading(true);
    const [{ data: pData }, { data: lData }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").eq("club_id", club.id).eq("role", "player"),
      supabase.from("player_leaves").select("*").eq("type", type).order("start_date", { ascending: false }),
    ]);
    const pMap = new Map((pData ?? []).map((p: any) => [p.id, p as Player]));
    const list = ((lData ?? []) as Leave[]).map((l) => ({ ...l, player: pMap.get(l.player_id) ?? null }));
    setPlayers((pData ?? []) as Player[]);
    setLeaves(list);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, club?.id, type]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (l: Leave) => { setEditing(l); setOpen(true); };

  const downloadDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) return toast.error("No se pudo generar el enlace");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const toggleActive = async (l: Leave) => {
    const { error } = await supabase
      .from("player_leaves")
      .update({ active: !l.active, end_date: !l.active ? null : (l.end_date ?? new Date().toISOString().slice(0, 10)) })
      .eq("id", l.id);
    if (error) return toast.error("No se pudo actualizar");
    toast.success(l.active ? "Baja finalizada" : "Baja reactivada");
    load();
  };

  const meta = LEAVE_META[type];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {leaves.length} registro{leaves.length === 1 ? "" : "s"} · {leaves.filter((l) => l.active).length} activa{leaves.filter((l) => l.active).length === 1 ? "" : "s"}
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-3.5 w-3.5" /> Nueva {meta.title.toLowerCase()}</Button>
      </div>

      {loading ? <Skeleton /> : leaves.length === 0 ? (
        <Empty icon={meta.icon} title={meta.title} desc={meta.empty} />
      ) : (
        <div className="space-y-2">
          {leaves.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{l.player?.full_name || l.player?.email || "Jugador"}</span>
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.active ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}>
                      {l.active ? "Activa" : "Finalizada"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Desde {new Date(l.start_date).toLocaleDateString("es-ES")}
                    {l.end_date && <> · hasta {new Date(l.end_date).toLocaleDateString("es-ES")}</>}
                  </div>
                  {l.reason && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{l.reason}</p>}
                  {l.document_url && (
                    <button
                      type="button"
                      onClick={() => downloadDoc(l.document_url!)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" /> Ver documento
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(l)}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(l)}>
                    {l.active ? "Finalizar" : "Reactivar"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LeaveDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        players={players}
        type={type}
        onSaved={load}
      />
    </div>
  );
}

const MAX_BYTES = 20 * 1024 * 1024;

function LeaveDialog({
  open, onOpenChange, editing, players, type, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Leave | null;
  players: Player[];
  type: LeaveType;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    player_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    reason: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [existingDoc, setExistingDoc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        player_id: editing.player_id,
        start_date: editing.start_date,
        end_date: editing.end_date ?? "",
        reason: editing.reason ?? "",
      } : {
        player_id: "",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: "",
        reason: "",
      });
      setFile(null);
      setExistingDoc(editing?.document_url ?? null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open, editing]);

  const removeExistingDoc = async () => {
    if (!existingDoc) return;
    await supabase.storage.from("documents").remove([existingDoc]);
    setExistingDoc(null);
  };

  const save = async () => {
    if (!user) return;
    if (!form.player_id) return toast.error("Selecciona un jugador");
    if (type === "deportiva" && !form.reason.trim()) return toast.error("Añade el motivo de la baja");
    if (file && file.size > MAX_BYTES) return toast.error("Máximo 20 MB por archivo");

    setSaving(true);
    let docPath: string | null = existingDoc;
    if (file) {
      // remove old
      if (existingDoc) await supabase.storage.from("documents").remove([existingDoc]);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${form.player_id}/leaves/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("documents").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || undefined,
      });
      if (up.error) {
        setSaving(false);
        return toast.error("No se pudo subir el documento", { description: up.error.message });
      }
      docPath = path;
    }

    const payload = {
      player_id: form.player_id,
      physio_id: user.id,
      type,
      reason: form.reason.trim() || null,
      document_url: docPath,
      start_date: form.start_date,
      end_date: form.end_date || null,
      active: true,
    };
    const { error } = editing
      ? await supabase.from("player_leaves").update(payload).eq("id", editing.id)
      : await supabase.from("player_leaves").insert(payload);
    setSaving(false);
    if (error) return toast.error(editing ? "No se pudo actualizar" : "No se pudo crear");
    toast.success(editing ? "Baja actualizada" : "Baja registrada");
    onOpenChange(false);
    onSaved();
  };

  const meta = LEAVE_META[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${meta.title.toLowerCase()}` : `Nueva ${meta.title.toLowerCase()}`}</DialogTitle>
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
              <Label>Fecha inicio *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>
              {type === "deportiva" ? "Motivo *" : "Comentarios"}
            </Label>
            <Textarea
              rows={4}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder={type === "deportiva"
                ? "Ej.: sobrecarga muscular, precaución tras lesión, decisión técnica..."
                : "Comentarios sobre la baja médica..."}
            />
          </div>
          <div>
            <Label>Documento {type === "medica" ? "(PDF, informe médico...)" : "(opcional)"}</Label>
            {existingDoc && !file && (
              <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
                <span className="inline-flex items-center gap-1 truncate"><FileText className="h-3.5 w-3.5" /> Documento actual</span>
                <button type="button" onClick={removeExistingDoc} className="text-destructive hover:underline">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <span className="text-xs text-muted-foreground truncate max-w-[8rem]">{file.name}</span>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando..." : (<><Upload className="mr-1 h-3.5 w-3.5" /> Guardar</>)}
          </Button>
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
