import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ClipboardList, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jugador/formularios")({
  component: PlayerForms,
  head: () => ({
    meta: [
      { title: "Mis formularios | We Fix You" },
      { name: "description", content: "Cuestionarios y formularios que te ha enviado el fisioterapeuta de tu club." },
      { property: "og:title", content: "Mis formularios | We Fix You" },
      { property: "og:description", content: "Cuestionarios y formularios que te ha enviado el fisioterapeuta de tu club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface Assignment {
  id: string;
  form_id: string;
  completed: boolean;
  assigned_at: string;
  forms: { title: string; description: string | null; external_url: string } | null;
}

function PlayerForms() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("form_assignments")
      .select("id,form_id,completed,assigned_at,forms(title,description,external_url)")
      .eq("player_id", user.id)
      .order("assigned_at", { ascending: false });
    setRows((data ?? []) as unknown as Assignment[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const markDone = async (a: Assignment) => {
    const { error } = await supabase
      .from("form_assignments")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", a.id);
    if (error) return toast.error("No se pudo marcar como completado");
    toast.success("Formulario marcado como completado");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Formularios</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">Cuestionarios que te ha enviado tu fisioterapeuta.</p>

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />)}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><ClipboardList className="h-7 w-7" /></div>
          <h3 className="text-sm font-semibold">Sin formularios</h3>
          <p className="mt-1 text-xs text-muted-foreground">Aquí verás los cuestionarios que te asignen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{a.forms?.title ?? "Formulario"}</span>
                    {a.completed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        <Check className="h-3 w-3" /> Completado
                      </span>
                    )}
                  </div>
                  {a.forms?.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.forms.description}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(a.assigned_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.forms?.external_url && (
                  <Button size="sm" asChild>
                    <a href={a.forms.external_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir
                    </a>
                  </Button>
                )}
                {!a.completed && (
                  <Button size="sm" variant="outline" onClick={() => markDone(a)}>
                    <Check className="mr-1.5 h-4 w-4" /> Marcar completado
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
