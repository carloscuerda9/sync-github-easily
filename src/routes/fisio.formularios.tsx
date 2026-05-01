import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Plus, ExternalLink, Send, Trash2, CheckCircle2, Clock, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/fisio/formularios")({ component: PhysioForms });

interface FormRow {
  id: string;
  title: string;
  description: string | null;
  external_url: string;
  active: boolean;
  created_at: string;
}
interface AssignmentRow {
  id: string;
  form_id: string;
  player_id: string;
  completed: boolean;
  assigned_at: string;
  completed_at: string | null;
  player?: { full_name: string | null; email: string };
}
interface PlayerRow { id: string; full_name: string | null; email: string }

function PhysioForms() {
  const { user } = useAuth();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // create-form dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // assign dialog
  const [assignFor, setAssignFor] = useState<FormRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [fRes, pRes] = await Promise.all([
      supabase.from("forms").select("*").eq("physio_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email").eq("role", "player").eq("status", "approved"),
    ]);
    if (fRes.error) toast.error("Error cargando formularios");
    const fl = (fRes.data ?? []) as FormRow[];
    setForms(fl);
    setPlayers((pRes.data ?? []) as PlayerRow[]);

    if (fl.length) {
      const ids = fl.map((f) => f.id);
      const { data: aData } = await supabase.from("form_assignments").select("*").in("form_id", ids);
      const playerIds = Array.from(new Set((aData ?? []).map((a) => a.player_id)));
      const { data: profs } = playerIds.length
        ? await supabase.from("profiles").select("id,full_name,email").in("id", playerIds)
        : { data: [] as PlayerRow[] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      setAssignments(((aData ?? []) as AssignmentRow[]).map((a) => ({ ...a, player: map.get(a.player_id) })));
    } else {
      setAssignments([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const resetCreate = () => { setTitle(""); setDescription(""); setExternalUrl(""); };

  const validUrl = (s: string) => {
    try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
  };

  const create = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Pon un título");
    if (!validUrl(externalUrl)) return toast.error("URL no válida (debe empezar por http(s)://)");
    setCreating(true);
    const { error } = await supabase.from("forms").insert({
      physio_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      external_url: externalUrl.trim(),
    });
    setCreating(false);
    if (error) return toast.error("No se pudo crear", { description: error.message });
    toast.success("Formulario creado");
    setOpenCreate(false);
    resetCreate();
    load();
  };

  const toggleActive = async (f: FormRow) => {
    const { error } = await supabase.from("forms").update({ active: !f.active }).eq("id", f.id);
    if (error) return toast.error("No se pudo actualizar");
    toast.success(f.active ? "Formulario desactivado" : "Formulario activado");
    load();
  };

  const remove = async (f: FormRow) => {
    if (!confirm(`¿Eliminar "${f.title}"? Se borrarán también sus asignaciones.`)) return;
    await supabase.from("form_assignments").delete().eq("form_id", f.id);
    const { error } = await supabase.from("forms").delete().eq("id", f.id);
    if (error) return toast.error("No se pudo eliminar");
    toast.success("Eliminado");
    load();
  };

  const openAssign = (f: FormRow) => {
    const already = new Set(assignments.filter((a) => a.form_id === f.id).map((a) => a.player_id));
    setSelected(already);
    setAssignFor(f);
  };

  const saveAssign = async () => {
    if (!assignFor) return;
    setAssigning(true);
    const current = new Set(assignments.filter((a) => a.form_id === assignFor.id).map((a) => a.player_id));
    const toAdd = Array.from(selected).filter((id) => !current.has(id));
    const toRemove = Array.from(current).filter((id) => !selected.has(id));

    if (toAdd.length) {
      const { error } = await supabase.from("form_assignments").insert(
        toAdd.map((player_id) => ({ form_id: assignFor.id, player_id })),
      );
      if (error) { setAssigning(false); return toast.error("No se pudo asignar", { description: error.message }); }
    }
    if (toRemove.length) {
      const { error } = await supabase.from("form_assignments").delete()
        .eq("form_id", assignFor.id).in("player_id", toRemove);
      if (error) { setAssigning(false); return toast.error("No se pudo desasignar"); }
    }
    setAssigning(false);
    setAssignFor(null);
    toast.success("Asignaciones guardadas");
    load();
  };

  const stats = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    assignments.forEach((a) => {
      const s = map.get(a.form_id) ?? { total: 0, done: 0 };
      s.total++; if (a.completed) s.done++;
      map.set(a.form_id, s);
    });
    return map;
  }, [assignments]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Formularios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crea cuestionarios externos (Google Forms, Typeform…) y asígnalos.</p>
        </div>
        <Dialog open={openCreate} onOpenChange={(v) => { setOpenCreate(v); if (!v) resetCreate(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo formulario</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nuevo formulario</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Título *</Label>
                <Input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Cuestionario semanal de carga" />
              </div>
              <div className="grid gap-1.5">
                <Label>Descripción</Label>
                <Textarea rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>URL externa *</Label>
                <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://forms.gle/…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button onClick={create} disabled={creating}>{creating ? "Creando…" : "Crear"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div>
      ) : forms.length === 0 ? (
        <Empty title="Aún no hay formularios" desc="Crea uno enlazando un Google Form o Typeform." />
      ) : (
        <div className="space-y-3">
          {forms.map((f) => {
            const s = stats.get(f.id) ?? { total: 0, done: 0 };
            return (
              <div key={f.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{f.title}</span>
                      {!f.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">Inactivo</span>}
                    </div>
                    {f.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <a href={f.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> Abrir
                      </a>
                      <span>Asignados: <strong className="text-foreground">{s.total}</strong></span>
                      <span>Completados: <strong className="text-foreground">{s.done}</strong></span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                    <Button size="sm" variant="outline" onClick={() => openAssign(f)}>
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Asignar
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => toggleActive(f)} aria-label={f.active ? "Desactivar" : "Activar"}>
                      {f.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(f)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign dialog */}
      <Dialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar “{assignFor?.title}”</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            {players.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">No hay jugadores en tu club.</p>
            ) : players.map((p) => {
              const checked = selected.has(p.id);
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0 hover:bg-muted/40">
                  <Checkbox checked={checked} onCheckedChange={(v) => {
                    setSelected((s) => {
                      const next = new Set(s);
                      if (v) next.add(p.id); else next.delete(p.id);
                      return next;
                    });
                  }} />
                  <span className="text-sm">
                    <span className="font-medium">{p.full_name || p.email}</span>
                    <span className="block text-[11px] text-muted-foreground">{p.email}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignFor(null)}>Cancelar</Button>
            <Button onClick={saveAssign} disabled={assigning}>{assigning ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de asignaciones detallada */}
      {assignments.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estado por jugador</h2>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pendientes ({assignments.filter((a) => !a.completed).length})</TabsTrigger>
              <TabsTrigger value="done">Completados ({assignments.filter((a) => a.completed).length})</TabsTrigger>
            </TabsList>
            {(["pending", "done"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-3 space-y-2">
                {assignments.filter((a) => tab === "done" ? a.completed : !a.completed).map((a) => {
                  const f = forms.find((x) => x.id === a.form_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{a.player?.full_name || a.player?.email || "—"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{f?.title}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.completed ? "bg-accent/20 text-accent-foreground" : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"}`}>
                        {a.completed ? <><CheckCircle2 className="h-3 w-3" /> Completado</> : <><Clock className="h-3 w-3" /> Pendiente</>}
                      </span>
                    </div>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      )}
    </div>
  );
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><ClipboardList className="h-7 w-7" /></div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
