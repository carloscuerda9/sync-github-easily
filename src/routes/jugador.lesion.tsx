import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Siren, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";
import {
  ACTION_LABEL, ACTION_OPTIONS, BODY_PART_OPTIONS, CONTEXT_LABEL, CONTEXT_OPTIONS,
  LOCATION_LABEL, LOCATION_OPTIONS, MOMENT_LABEL, MOMENT_OPTIONS,
  formatReportDate, type InjuryReport,
} from "@/lib/injury-reports";

export const Route = createFileRoute("/jugador/lesion")({
  component: PlayerInjuryReport,
  head: () => ({
    meta: [
      { title: "Parte de lesión | We Fix You" },
      { name: "description", content: "Comunica tu lesión a tu fisioterapeuta con todos los detalles y adjunta fotos o informes." },
      { property: "og:title", content: "Parte de lesión | We Fix You" },
      { property: "og:description", content: "Comunica tu lesión a tu fisioterapeuta con todos los detalles y adjunta fotos o informes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MAX_BYTES = 20 * 1024 * 1024;
const YES_NO = [{ value: "si", label: "Sí" }, { value: "no", label: "No" }];

function PlayerInjuryReport() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<InjuryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [context, setContext] = useState("");
  const [matchLocation, setMatchLocation] = useState("");
  const [moment, setMoment] = useState("");
  const [actionType, setActionType] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [previous, setPrevious] = useState("no");
  const [canContinue, setCanContinue] = useState("no");
  const [attended, setAttended] = useState("no");
  const [attendedBy, setAttendedBy] = useState("");
  const [observations, setObservations] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("injury_reports").select("*").eq("player_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Error cargando partes de lesión");
    setReports((data ?? []) as InjuryReport[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const reset = () => {
    setContext(""); setMatchLocation(""); setMoment(""); setActionType(""); setBodyPart("");
    setPrevious("no"); setCanContinue("no"); setAttended("no"); setAttendedBy("");
    setObservations(""); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!user) return;
    if (!context) return toast.error("Indica si fue en partido o entrenamiento");
    if (context === "partido" && !matchLocation) return toast.error("Indica si el partido fue en casa o fuera");
    if (!moment) return toast.error("Indica el momento de la lesión");
    if (!actionType) return toast.error("Indica el tipo de acción");
    if (!bodyPart) return toast.error("Indica la zona del cuerpo");
    if (attended === "si" && !attendedBy.trim()) return toast.error("Indica quién o dónde te atendieron");
    if (file && file.size > MAX_BYTES) return toast.error("Máximo 20 MB por archivo");
    if (!profile?.club_id) return toast.error("Tu cuenta no está asociada a ningún club");

    setSaving(true);
    let path: string | null = null;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      path = `${user.id}/lesiones/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("documents").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || undefined,
      });
      if (up.error) {
        setSaving(false);
        return toast.error("No se pudo subir el archivo", { description: up.error.message });
      }
    }

    const { error } = await supabase.from("injury_reports").insert({
      player_id: user.id,
      club_id: profile.club_id,
      context,
      match_location: context === "partido" ? matchLocation : null,
      moment,
      action_type: actionType,
      body_part: bodyPart,
      previous_same_injury: previous === "si",
      can_continue: canContinue === "si",
      was_attended: attended === "si",
      attended_by: attended === "si" ? attendedBy.trim() : null,
      observations: observations.trim() || null,
      file_url: path,
      file_type: file?.type || null,
    });
    setSaving(false);
    if (error) {
      if (path) await supabase.storage.from("documents").remove([path]);
      return toast.error("No se pudo enviar el parte", { description: error.message });
    }
    toast.success("Parte de lesión enviado a tu fisio");
    setOpen(false);
    reset();
    load();
  };

  const download = async (r: InjuryReport) => {
    if (!r.file_url) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(r.file_url, 60);
    if (error || !data) return toast.error("No se pudo generar el enlace");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Parte de lesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rellena el cuestionario y tu fisioterapeuta lo recibirá al instante.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button className="h-11"><Plus className="mr-1.5 h-4 w-4" /> Nuevo parte</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
            <DialogHeader><DialogTitle>Nuevo parte de lesión</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="¿Dónde ocurrió? *">
                <Select value={context} onValueChange={(v) => { setContext(v); if (v !== "partido") setMatchLocation(""); }}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {CONTEXT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              {context === "partido" && (
                <Field label="¿En casa o fuera? *">
                  <Select value={matchLocation} onValueChange={setMatchLocation}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {LOCATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="Momento de la lesión *">
                <Select value={moment} onValueChange={setMoment}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {MOMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Tipo de acción *">
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Zona del cuerpo *">
                <Select value={bodyPart} onValueChange={setBodyPart}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {BODY_PART_OPTIONS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="¿Has tenido la misma lesión antes? *">
                <Select value={previous} onValueChange={setPrevious}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{YES_NO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <Field label="¿Puedes seguir? *">
                <Select value={canContinue} onValueChange={setCanContinue}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{YES_NO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <Field label="¿Te han atendido? *">
                <Select value={attended} onValueChange={setAttended}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{YES_NO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              {attended === "si" && (
                <Field label="¿Quién o dónde te atendieron? *">
                  <Input className="h-11" value={attendedBy} onChange={(e) => setAttendedBy(e.target.value)} placeholder="Ej: Fisio del club / Hospital" />
                </Field>
              )}

              <Field label="Observaciones">
                <Textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Cuenta cualquier detalle relevante…" />
              </Field>

              <Field label="Foto o PDF (opcional)">
                <Input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="h-11"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" className="h-11" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="h-11" onClick={submit} disabled={saving}>{saving ? "Enviando…" : "Enviar parte"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/60" />)}</div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><Siren className="h-7 w-7" /></div>
          <h2 className="text-sm font-semibold">Sin partes de lesión</h2>
          <p className="mt-1 text-xs text-muted-foreground">Si te lesionas, crea un parte para avisar a tu fisio.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{r.body_part} — {ACTION_LABEL[r.action_type] ?? r.action_type}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatReportDate(r.created_at)} · {CONTEXT_LABEL[r.context] ?? r.context}
                    {r.match_location ? ` (${LOCATION_LABEL[r.match_location]})` : ""} · {MOMENT_LABEL[r.moment] ?? r.moment}
                  </div>
                  {r.observations && <p className="mt-2 text-sm text-foreground/80">{r.observations}</p>}
                  {r.file_url && (
                    <button onClick={() => download(r)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Paperclip className="h-3 w-3" /> Ver adjunto <Download className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.reviewed ? "bg-accent/15 text-accent-foreground" : "bg-muted"}`}>
                  {r.reviewed ? "Revisado" : "Enviado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
