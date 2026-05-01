import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jugador/formularios")({ component: PlayerForms });

interface AssignmentRow {
  id: string;
  form_id: string;
  completed: boolean;
  assigned_at: string;
  completed_at: string | null;
  form?: { id: string; title: string; description: string | null; external_url: string; active: boolean };
}

function PlayerForms() {
  const { user } = useAuth();
  const [list, setList] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("form_assignments")
      .select("id,form_id,completed,assigned_at,completed_at")
      .eq("player_id", user.id)
      .order("assigned_at", { ascending: false });
    if (error) { toast.error("Error cargando"); setLoading(false); return; }
    const rows = (data ?? []) as AssignmentRow[];
    const ids = Array.from(new Set(rows.map((r) => r.form_id)));
    if (ids.length) {
      const { data: forms } = await supabase.from("forms").select("id,title,description,external_url,active").in("id", ids);
      const map = new Map((forms ?? []).map((f) => [f.id, f]));
      rows.forEach((r) => { r.form = map.get(r.form_id) as AssignmentRow["form"]; });
    }
    setList(rows.filter((r) => r.form?.active !== false));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const markDone = async (id: string) => {
    const { error } = await supabase.from("form_assignments")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error("No se pudo marcar");
    toast.success("Marcado como completado");
    load();
  };

  const pending = list.filter((a) => !a.completed);
  const done = list.filter((a) => a.completed);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Formularios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cuestionarios que tu fisio te ha asignado.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendientes ({pending.length})</TabsTrigger>
          <TabsTrigger value="done">Completados ({done.length})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="mt-4 space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />)}</div>
        ) : (
          <>
            <TabsContent value="pending" className="mt-4 space-y-3">
              {pending.length === 0 ? (
                <Empty title="Sin formularios pendientes" desc="Cuando tu fisio te asigne uno aparecerá aquí." />
              ) : pending.map((a) => (
                <Card key={a.id} a={a}
                  actions={<>
                    <Button asChild size="sm">
                      <a href={a.form?.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir</a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markDone(a.id)}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Marcar completado
                    </Button>
                  </>}
                />
              ))}
            </TabsContent>
            <TabsContent value="done" className="mt-4 space-y-3">
              {done.length === 0 ? (
                <Empty title="Aún no has completado ninguno" desc="Cuando termines un formulario aparecerá aquí." />
              ) : done.map((a) => (
                <Card key={a.id} a={a}
                  actions={<Button asChild size="sm" variant="ghost">
                    <a href={a.form?.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver</a>
                  </Button>}
                />
              ))}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function Card({ a, actions }: { a: AssignmentRow; actions: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{a.form?.title}</div>
          {a.form?.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.form.description}</p>}
          <div className="mt-1.5 text-[11px] text-muted-foreground">
            Asignado: {new Date(a.assigned_at).toLocaleDateString("es-ES")}
            {a.completed_at && ` · Completado: ${new Date(a.completed_at).toLocaleDateString("es-ES")}`}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">{actions}</div>
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
