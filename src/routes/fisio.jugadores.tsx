import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Search, ArrowLeft, User, Mail, Phone, Plus, Activity, Calendar,
  HeartPulse, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABEL, STATUS_COLOR, TYPE_LABEL, formatDateTime, type AppointmentStatus, type AppointmentType } from "@/lib/appointments";

export const Route = createFileRoute("/fisio/jugadores")({
  component: PhysioPlayers,
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
});

interface Player {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  profile_data: Record<string, unknown>;
  created_at: string;
}
interface Injury {
  id: string;
  injury_date: string;
  body_part: string;
  injury_type: string;
  severity: string | null;
  treatment: string | null;
  recovery_days: number | null;
  notes: string | null;
}
interface Appt {
  id: string;
  scheduled_at: string;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string | null;
}

function PhysioPlayers() {
  const { id } = Route.useSearch();
  return id ? <PlayerDetail playerId={id} /> : <PlayersList />;
}

/* ---------- LIST ---------- */

function PlayersList() {
  const { user, club } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,phone,profile_data,created_at")
        .eq("role", "player")
        .order("full_name", { ascending: true, nullsFirst: false });
      if (error) toast.error("Error cargando jugadores");
      setPlayers((data ?? []) as Player[]);
      setLoading(false);
    })();
  }, [user?.id]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return players;
    return players.filter((p) =>
      (p.full_name ?? "").toLowerCase().includes(t) || p.email.toLowerCase().includes(t),
    );
  }, [players, q]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Mis jugadores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {players.length} jugador{players.length === 1 ? "" : "es"} en {club?.name ?? "tu club"}.
          </p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email…" className="pl-9" />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1,2,3,4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          icon={<Users className="h-8 w-8" />}
          title={q ? "Sin resultados" : "Aún no hay jugadores"}
          desc={q
            ? "Prueba con otro nombre o email."
            : "Comparte el código de tu club con tus jugadores para que se registren."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ to: "/fisio/jugadores", search: { id: p.id } })}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.full_name || p.email}</div>
                <div className="truncate text-xs text-muted-foreground">{p.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- DETAIL ---------- */

function PlayerDetail({ playerId }: { playerId: string }) {
  const { user } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // injury form
  const today = new Date().toISOString().slice(0, 10);
  const [injuryDate, setInjuryDate] = useState(today);
  const [bodyPart, setBodyPart] = useState("");
  const [injuryType, setInjuryType] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [treatment, setTreatment] = useState("");
  const [recoveryDays, setRecoveryDays] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [pRes, iRes, aRes] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,phone,profile_data,created_at").eq("id", playerId).maybeSingle(),
      supabase.from("injuries").select("id,injury_date,body_part,injury_type,severity,treatment,recovery_days,notes").eq("player_id", playerId).order("injury_date", { ascending: false }),
      supabase.from("appointments").select("id,scheduled_at,type,status,notes").eq("player_id", playerId).order("scheduled_at", { ascending: false }).limit(20),
    ]);
    if (pRes.error) toast.error("Error cargando jugador");
    setPlayer((pRes.data as Player | null) ?? null);
    setInjuries((iRes.data ?? []) as Injury[]);
    setAppts((aRes.data ?? []) as Appt[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [playerId]);

  const resetForm = () => {
    setInjuryDate(today); setBodyPart(""); setInjuryType(""); setSeverity("");
    setTreatment(""); setRecoveryDays(""); setNotes("");
  };

  const submitInjury = async () => {
    if (!user) return;
    if (!bodyPart.trim() || !injuryType.trim()) return toast.error("Indica zona y tipo de lesión");
    setSubmitting(true);
    const { error } = await supabase.from("injuries").insert({
      player_id: playerId,
      physio_id: user.id,
      injury_date: injuryDate,
      body_part: bodyPart.trim(),
      injury_type: injuryType.trim(),
      severity: severity || null,
      treatment: treatment.trim() || null,
      recovery_days: recoveryDays ? Number(recoveryDays) : null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error("No se pudo guardar", { description: error.message });
    toast.success("Lesión añadida");
    setOpen(false);
    resetForm();
    load();
  };

  if (loading) {
    return <div className="mx-auto max-w-4xl space-y-3">
      <div className="h-8 w-40 animate-pulse rounded bg-muted/60" />
      <div className="h-32 animate-pulse rounded-xl bg-muted/60" />
      <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
    </div>;
  }
  if (!player) {
    return <div className="mx-auto max-w-4xl">
      <Link to="/fisio/jugadores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <Empty icon={<AlertCircle className="h-8 w-8" />} title="Jugador no encontrado" desc="Puede que ya no esté en tu club." />
    </div>;
  }

  const pd = (player.profile_data ?? {}) as Record<string, unknown>;
  const sport = typeof pd.sport === "string" ? pd.sport : null;
  const position = typeof pd.position === "string" ? pd.position : null;
  const dob = typeof pd.date_of_birth === "string" ? pd.date_of_birth : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/fisio/jugadores" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a jugadores
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-tight">{player.full_name || player.email}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{player.email}</span>
              {player.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{player.phone}</span>}
              {sport && <span>🏃 {sport}{position ? ` · ${position}` : ""}</span>}
              {dob && <span>🎂 {new Date(dob).toLocaleDateString("es-ES")}</span>}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="injuries" className="mt-6">
        <TabsList>
          <TabsTrigger value="injuries">Lesiones ({injuries.length})</TabsTrigger>
          <TabsTrigger value="appointments">Citas ({appts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="injuries" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Añadir lesión</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Nueva lesión</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Fecha</Label>
                      <Input type="date" value={injuryDate} max={today} onChange={(e) => setInjuryDate(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Severidad</Label>
                      <Select value={severity} onValueChange={setSeverity}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="leve">Leve</SelectItem>
                          <SelectItem value="moderada">Moderada</SelectItem>
                          <SelectItem value="grave">Grave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Zona del cuerpo *</Label>
                    <Input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="Ej: Rodilla derecha" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Tipo *</Label>
                    <Input value={injuryType} onChange={(e) => setInjuryType(e.target.value)} placeholder="Ej: Esguince grado 2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Días de recuperación</Label>
                      <Input type="number" min="0" value={recoveryDays} onChange={(e) => setRecoveryDays(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Tratamiento</Label>
                    <Textarea rows={2} value={treatment} onChange={(e) => setTreatment(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notas</Label>
                    <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={submitInjury} disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {injuries.length === 0 ? (
            <Empty icon={<HeartPulse className="h-8 w-8" />} title="Sin lesiones registradas" desc="Añade la primera para empezar el historial." />
          ) : (
            <div className="space-y-3">
              {injuries.map((i) => (
                <div key={i.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{i.body_part} — {i.injury_type}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(i.injury_date).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                        {i.recovery_days != null && ` · ${i.recovery_days} días recuperación`}
                      </div>
                      {i.treatment && <p className="mt-2 text-sm"><span className="font-medium">Tratamiento:</span> {i.treatment}</p>}
                      {i.notes && <p className="mt-1 text-sm text-muted-foreground">{i.notes}</p>}
                    </div>
                    {i.severity && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">{i.severity}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          {appts.length === 0 ? (
            <Empty icon={<Calendar className="h-8 w-8" />} title="Sin citas" desc="Cuando este jugador tenga citas contigo aparecerán aquí." />
          ) : (
            <div className="space-y-3">
              {appts.map((a) => (
                <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{formatDateTime(a.scheduled_at)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{TYPE_LABEL[a.type]}</div>
                      {a.notes && <p className="mt-2 text-sm text-foreground/80">{a.notes}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><Activity className="h-0 w-0" />{icon}</div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
