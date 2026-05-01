import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Download, Trash2, User } from "lucide-react";
import { toast } from "sonner";

interface DocRow {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  uploader_id: string;
  recipient_id: string;
  created_at: string;
}
interface PartyProfile { id: string; full_name: string | null; email: string }

interface Props {
  /** the role of the OTHER party (recipient if we upload, peer in any case) */
  contactRole: "physio" | "player";
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export function DocumentsView({ contactRole }: Props) {
  const { user, club } = useAuth();
  const [received, setReceived] = useState<DocRow[]>([]);
  const [sent, setSent] = useState<DocRow[]>([]);
  const [parties, setParties] = useState<PartyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // upload form
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [recRes, sentRes, partyRes] = await Promise.all([
      supabase.from("documents").select("*").eq("recipient_id", user.id).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("uploader_id", user.id).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email").eq("role", contactRole).eq("status", "approved"),
    ]);
    if (recRes.error || sentRes.error) toast.error("Error cargando documentos");
    setReceived((recRes.data ?? []) as DocRow[]);
    setSent((sentRes.data ?? []) as DocRow[]);
    setParties(((partyRes.data ?? []) as PartyProfile[]).filter((p) => p.id !== user.id));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const allParties = useMemo(() => {
    const map = new Map<string, PartyProfile>();
    parties.forEach((p) => map.set(p.id, p));
    return map;
  }, [parties]);

  const resetForm = () => {
    setRecipientId(""); setTitle(""); setDescription(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!user) return;
    if (!recipientId) return toast.error("Elige un destinatario");
    if (!title.trim()) return toast.error("Pon un título al documento");
    if (!file) return toast.error("Selecciona un archivo");
    if (file.size > MAX_BYTES) return toast.error("Máximo 20 MB por archivo");

    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    // path = "<recipient_id>/<timestamp>-<filename>"  (RLS depende del primer segmento = jugador)
    const playerId = contactRole === "player" ? recipientId : user.id;
    const path = `${playerId}/${Date.now()}-${safeName}`;

    const up = await supabase.storage.from("documents").upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type || undefined,
    });
    if (up.error) {
      setUploading(false);
      return toast.error("No se pudo subir", { description: up.error.message });
    }

    const { error: insErr } = await supabase.from("documents").insert({
      uploader_id: user.id,
      recipient_id: recipientId,
      title: title.trim(),
      description: description.trim() || null,
      file_url: path,
      file_type: file.type || null,
    });
    setUploading(false);
    if (insErr) {
      // limpia el blob si falló el registro
      await supabase.storage.from("documents").remove([path]);
      return toast.error("No se pudo guardar", { description: insErr.message });
    }
    toast.success("Documento subido");
    setOpen(false);
    resetForm();
    load();
  };

  const download = async (d: DocRow) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_url, 60);
    if (error || !data) return toast.error("No se pudo generar el enlace");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const remove = async (d: DocRow) => {
    if (!confirm(`¿Eliminar "${d.title}"?`)) return;
    const { error: stErr } = await supabase.storage.from("documents").remove([d.file_url]);
    if (stErr) return toast.error("No se pudo borrar el archivo");
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) return toast.error("No se pudo borrar el registro");
    toast.success("Documento eliminado");
    load();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comparte informes y archivos en {club?.name ?? "tu club"} (máx. 20 MB).</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Upload className="mr-2 h-4 w-4" /> Subir documento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nuevo documento</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Destinatario ({contactRole === "physio" ? "fisio" : "jugador"})</Label>
                <Select value={recipientId} onValueChange={setRecipientId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {parties.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Sin contactos disponibles.</div>}
                    {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Ej: Informe de evaluación" />
              </div>
              <div className="grid gap-1.5">
                <Label>Descripción</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={250} />
              </div>
              <div className="grid gap-1.5">
                <Label>Archivo *</Label>
                <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                {file && <span className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={uploading}>{uploading ? "Subiendo…" : "Subir"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Recibidos ({received.length})</TabsTrigger>
          <TabsTrigger value="sent">Enviados ({sent.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="mt-4 space-y-3">
          {loading ? <Skeleton /> : received.length === 0 ? (
            <Empty title="Sin documentos recibidos" desc="Aquí verás los archivos que te compartan." />
          ) : received.map((d) => (
            <DocCard
              key={d.id}
              d={d}
              who={allParties.get(d.uploader_id)}
              whoLabel="De"
              onDownload={() => download(d)}
            />
          ))}
        </TabsContent>

        <TabsContent value="sent" className="mt-4 space-y-3">
          {loading ? <Skeleton /> : sent.length === 0 ? (
            <Empty title="Sin documentos enviados" desc="Pulsa 'Subir documento' para compartir el primero." />
          ) : sent.map((d) => (
            <DocCard
              key={d.id}
              d={d}
              who={allParties.get(d.recipient_id)}
              whoLabel="Para"
              onDownload={() => download(d)}
              onDelete={() => remove(d)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DocCard({ d, who, whoLabel, onDownload, onDelete }: {
  d: DocRow; who?: PartyProfile; whoLabel: string;
  onDownload: () => void; onDelete?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{d.title}</div>
          {d.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{whoLabel}: {who?.full_name || who?.email || "—"}</span>
            <span>{new Date(d.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>
            {d.file_type && <span className="rounded bg-muted px-1.5 py-0.5">{d.file_type.split("/").pop()}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" onClick={onDownload} aria-label="Descargar"><Download className="h-4 w-4" /></Button>
          {onDelete && <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
        </div>
      </div>
    </div>
  );
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><FileText className="h-7 w-7" /></div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />)}</div>;
}
