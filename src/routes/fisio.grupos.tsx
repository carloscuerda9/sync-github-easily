import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users, Plus, Trash2, MessageSquare, FileText, ClipboardList, UserPlus, Pencil,
} from "lucide-react";

export const Route = createFileRoute("/fisio/grupos")({
  component: PhysioGroups,
  head: () => ({
    meta: [
      { title: "Grupos de jugadores | We Fix You" },
      { name: "description", content: "Crea grupos de jugadores de tu club y envía mensajes, documentos o formularios a varios jugadores a la vez." },
      { property: "og:title", content: "Grupos de jugadores | We Fix You" },
      { property: "og:description", content: "Crea grupos de jugadores de tu club y envía mensajes, documentos o formularios a varios a la vez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface Group { id: string; name: string; description: string | null; club_id: string; physio_id: string }
interface Member { group_id: string; player_id: string }
interface Player { id: string; full_name: string | null; email: string }

const MAX_BYTES = 20 * 1024 * 1024;

function PhysioGroups() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [membersFor, setMembersFor] = useState<Group | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [msgFor, setMsgFor] = useState<Group | null>(null);
  const [msgText, setMsgText] = useState("");

  const [docFor, setDocFor] = useState<Group | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [quizFor, setQuizFor] = useState<Group | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizUrl, setQuizUrl] = useState("");
  const [quizDesc, setQuizDesc] = useState("");

  const load = async () => {
    if (!profile?.club_id) { setLoading(false); return; }
    setLoading(true);
    const [gRes, pRes] = await Promise.all([
      supabase.from("player_groups").select("*").eq("club_id", profile.club_id).order("created_at"),
      supabase.from("profiles").select("id,full_name,email").eq("club_id", profile.club_id)
        .eq("role", "player").eq("status", "approved").order("full_name"),
    ]);
    const gs = (gRes.data ?? []) as Group[];
    setGroups(gs);
    setPlayers((pRes.data ?? []) as Player[]);
    if (gs.length) {
      const { data } = await supabase.from("player_group_members").select("group_id,player_id")
        .in("group_id", gs.map((g) => g.id));
      setMembers((data ?? []) as Member[]);
    } else setMembers([]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.club_id]);

  const byGroup = useMemo(() => {
    const m = new Map<string, string[]>();
    members.forEach((x) => m.set(x.group_id, [...(m.get(x.group_id) ?? []), x.player_id]));
    return m;
  }, [members]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const openCreate = () => { setEditGroup(null); setName(""); setDescription(""); setFormOpen(true); };
  const openEdit = (g: Group) => { setEditGroup(g); setName(g.name); setDescription(g.description ?? ""); setFormOpen(true); };

  const saveGroup = async () => {
    if (!user || !profile?.club_id) return;
    if (!name.trim()) return toast.error("Pon un nombre al grupo");
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null };
    const { error } = editGroup
      ? await supabase.from("player_groups").update(payload).eq("id", editGroup.id)
      : await supabase.from("player_groups").insert({ ...payload, club_id: profile.club_id, physio_id: user.id });
    setSaving(false);
    if (error) return toast.error("No se pudo guardar", { description: error.message });
    toast.success(editGroup ? "Grupo actualizado" : "Grupo creado");
    setFormOpen(false);
    load();
  };

  const deleteGroup = async (g: Group) => {
    if (!confirm(`¿Eliminar el grupo "${g.name}"?`)) return;
    const { error } = await supabase.from("player_groups").delete().eq("id", g.id);
    if (error) return toast.error("No se pudo eliminar");
    toast.success("Grupo eliminado");
    load();
  };

  const openMembers = (g: Group) => {
    setSelected(new Set(byGroup.get(g.id) ?? []));
    setMembersFor(g);
  };

  const saveMembers = async () => {
    if (!membersFor || !user) return;
    setSaving(true);
    const current = new Set(byGroup.get(membersFor.id) ?? []);
    const toAdd = [...selected].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !selected.has(id));
    if (toAdd.length) {
      const { error } = await supabase.from("player_group_members").insert(
        toAdd.map((player_id) => ({ group_id: membersFor.id, player_id, added_by: user.id })),
      );
      if (error) { setSaving(false); return toast.error("No se pudieron añadir jugadores", { description: error.message }); }
    }
    if (toRemove.length) {
      const { error } = await supabase.from("player_group_members").delete()
        .eq("group_id", membersFor.id).in("player_id", toRemove);
      if (error) { setSaving(false); return toast.error("No se pudieron quitar jugadores"); }
    }
    setSaving(false);
    setMembersFor(null);
    toast.success("Grupo actualizado");
    load();
  };

  const sendMessage = async () => {
    if (!msgFor || !user) return;
    const ids = byGroup.get(msgFor.id) ?? [];
    if (!ids.length) return toast.error("El grupo no tiene jugadores");
    if (!msgText.trim()) return toast.error("Escribe un mensaje");
    setSaving(true);
    const { error } = await supabase.from("messages").insert(
      ids.map((receiver_id) => ({ sender_id: user.id, receiver_id, content: msgText.trim(), read: false, attachments: [] })),
    );
    setSaving(false);
    if (error) return toast.error("No se pudo enviar", { description: error.message });
    toast.success(`Mensaje enviado a ${ids.length} jugador${ids.length === 1 ? "" : "es"}`);
    setMsgFor(null); setMsgText("");
  };

  const sendDocument = async () => {
    if (!docFor || !user) return;
    const ids = byGroup.get(docFor.id) ?? [];
    if (!ids.length) return toast.error("El grupo no tiene jugadores");
    if (!docTitle.trim()) return toast.error("Pon un título al documento");
    if (!docFile) return toast.error("Selecciona un archivo");
    if (docFile.size > MAX_BYTES) return toast.error("Máximo 20 MB por archivo");
    setSaving(true);
    const safeName = docFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    let okCount = 0;
    for (const playerId of ids) {
      const path = `${playerId}/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("documents").upload(path, docFile, {
        cacheControl: "3600", upsert: false, contentType: docFile.type || undefined,
      });
      if (up.error) continue;
      const { error } = await supabase.from("documents").insert({
        uploader_id: user.id, recipient_id: playerId, title: docTitle.trim(),
        description: docDesc.trim() || null, file_url: path, file_type: docFile.type || null,
      });
      if (error) await supabase.storage.from("documents").remove([path]);
      else okCount++;
    }
    setSaving(false);
    if (!okCount) return toast.error("No se pudo enviar el documento");
    toast.success(`Documento enviado a ${okCount} jugador${okCount === 1 ? "" : "es"}`);
    setDocFor(null); setDocTitle(""); setDocDesc(""); setDocFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sendForm = async () => {
    if (!quizFor || !user) return;
    const ids = byGroup.get(quizFor.id) ?? [];
    if (!ids.length) return toast.error("El grupo no tiene jugadores");
    if (!quizTitle.trim()) return toast.error("Pon un título al formulario");
    if (!/^https?:\/\//i.test(quizUrl.trim())) return toast.error("El enlace debe empezar por https://");
    setSaving(true);
    const { data: form, error: fErr } = await supabase.from("forms").insert({
      physio_id: user.id, title: quizTitle.trim(), description: quizDesc.trim() || null,
      external_url: quizUrl.trim(), active: true,
    }).select("id").maybeSingle();
    if (fErr || !form) { setSaving(false); return toast.error("No se pudo crear el formulario", { description: fErr?.message }); }
    const { error } = await supabase.from("form_assignments").insert(
      ids.map((player_id) => ({ form_id: form.id, player_id, completed: false })),
    );
    setSaving(false);
    if (error) return toast.error("No se pudo asignar", { description: error.message });
    toast.success(`Formulario enviado a ${ids.length} jugador${ids.length === 1 ? "" : "es"}`);
    setQuizFor(null); setQuizTitle(""); setQuizUrl(""); setQuizDesc("");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Grupos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrupa jugadores de tu club y envíales mensajes, documentos o formularios a la vez.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo grupo</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><Users className="h-7 w-7" /></div>
          <h3 className="text-sm font-semibold">Aún no tienes grupos</h3>
          <p className="mt-1 text-xs text-muted-foreground">Crea uno para enviar avisos a varios jugadores a la vez.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const ids = byGroup.get(g.id) ?? [];
            return (
              <div key={g.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{g.name}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {ids.length} jugador{ids.length === 1 ? "" : "es"}
                      </span>
                    </div>
                    {g.description && <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>}
                    <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {ids.length === 0 ? "Sin jugadores todavía." :
                        ids.map((id) => playerMap.get(id)?.full_name || playerMap.get(id)?.email || "—").join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label="Editar grupo" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Eliminar grupo" onClick={() => deleteGroup(g)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openMembers(g)}><UserPlus className="mr-1.5 h-4 w-4" /> Jugadores</Button>
                  <Button size="sm" variant="outline" onClick={() => setMsgFor(g)}><MessageSquare className="mr-1.5 h-4 w-4" /> Mensaje</Button>
                  <Button size="sm" variant="outline" onClick={() => setDocFor(g)}><FileText className="mr-1.5 h-4 w-4" /> Documento</Button>
                  <Button size="sm" variant="outline" onClick={() => setQuizFor(g)}><ClipboardList className="mr-1.5 h-4 w-4" /> Formulario</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* crear / editar grupo */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editGroup ? "Editar grupo" : "Nuevo grupo"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej: Lesionados" />
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={saveGroup} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* miembros */}
      <Dialog open={!!membersFor} onOpenChange={(v) => !v && setMembersFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Jugadores de {membersFor?.name}</DialogTitle></DialogHeader>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {players.length === 0 && <p className="text-xs text-muted-foreground">No hay jugadores aprobados en tu club.</p>}
            {players.map((p) => {
              const checked = selected.has(p.id);
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setSelected((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(p.id); else next.delete(p.id);
                      return next;
                    })}
                  />
                  <span className="text-sm">{p.full_name || p.email}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMembersFor(null)}>Cancelar</Button>
            <Button onClick={saveMembers} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* mensaje al grupo */}
      <Dialog open={!!msgFor} onOpenChange={(v) => !v && setMsgFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mensaje a {msgFor?.name}</DialogTitle></DialogHeader>
          <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} rows={5} maxLength={1000} placeholder="Escribe el mensaje…" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMsgFor(null)}>Cancelar</Button>
            <Button onClick={sendMessage} disabled={saving}>{saving ? "Enviando…" : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* documento al grupo */}
      <Dialog open={!!docFor} onOpenChange={(v) => !v && setDocFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Documento a {docFor?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} maxLength={100} />
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción</Label>
              <Input value={docDesc} onChange={(e) => setDocDesc(e.target.value)} maxLength={250} />
            </div>
            <div className="grid gap-1.5">
              <Label>Archivo * (máx. 20 MB)</Label>
              <Input ref={fileRef} type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocFor(null)}>Cancelar</Button>
            <Button onClick={sendDocument} disabled={saving}>{saving ? "Enviando…" : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* formulario al grupo */}
      <Dialog open={!!quizFor} onOpenChange={(v) => !v && setQuizFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Formulario a {quizFor?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} maxLength={100} placeholder="Ej: Cuestionario semanal" />
            </div>
            <div className="grid gap-1.5">
              <Label>Enlace *</Label>
              <Input value={quizUrl} onChange={(e) => setQuizUrl(e.target.value)} placeholder="https://forms.gle/…" />
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción</Label>
              <Input value={quizDesc} onChange={(e) => setQuizDesc(e.target.value)} maxLength={250} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuizFor(null)}>Cancelar</Button>
            <Button onClick={sendForm} disabled={saving}>{saving ? "Enviando…" : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
