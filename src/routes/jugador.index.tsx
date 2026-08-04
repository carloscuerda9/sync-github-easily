import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MessageSquare, FileText, Activity, HeartPulse } from "lucide-react";

export const Route = createFileRoute("/jugador/")({
  component: PlayerHome,
});

const cards = [
  { to: "/jugador/citas", title: "Reservar cita", desc: "Agenda con tu fisio", icon: Calendar, color: "bg-primary/10 text-primary" },
  { to: "/jugador/mensajes", title: "Mensajes", desc: "Habla con tu fisio", icon: MessageSquare, color: "bg-accent/15 text-accent-foreground" },
  { to: "/jugador/documentos", title: "Documentos", desc: "Informes y planes", icon: FileText, color: "bg-primary/10 text-primary" },
  { to: "/jugador/lesion", title: "Parte de lesión", desc: "Informa de una lesión", icon: HeartPulse, color: "bg-red-500/10 text-red-500" },
  { to: "/jugador/historial", title: "Mi historial", desc: "Lesiones y progreso", icon: Activity, color: "bg-primary/10 text-primary" },
];

type TagColor = "green" | "yellow" | "orange" | "red";
const TAG_META: Record<TagColor, { label: string; dot: string; text: string; bg: string; border: string }> = {
  green:  { label: "Verde",    dot: "bg-green-500",  text: "text-green-700 dark:text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30" },
  yellow: { label: "Amarillo", dot: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/40" },
  orange: { label: "Naranja",  dot: "bg-orange-500", text: "text-orange-700 dark:text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  red:    { label: "Rojo",     dot: "bg-red-500",    text: "text-red-700 dark:text-red-400",     bg: "bg-red-500/10",    border: "border-red-500/30" },
};

interface TagRow {
  color: TagColor;
  updated_at: string;
  physio_id: string;
  physio?: { full_name: string | null; email: string } | null;
}

function PlayerHome() {
  const { user, profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "deportista";
  const [tags, setTags] = useState<TagRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("player_tags")
        .select("color,updated_at,physio_id")
        .eq("player_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      const rows = (data ?? []) as TagRow[];
      if (rows.length) {
        const ids = [...new Set(rows.map((r) => r.physio_id))];
        const { data: ps } = await supabase
          .from("profiles").select("id,full_name,email").in("id", ids);
        const map = new Map(((ps as { id: string; full_name: string | null; email: string }[]) ?? []).map((p) => [p.id, p]));
        rows.forEach((r) => { r.physio = map.get(r.physio_id) ?? null; });
      }
      setTags(rows);
    })();
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Hola,</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">¿Qué quieres hacer hoy?</p>
      </div>

      {tags.length > 0 && (
        <div className="mb-6 space-y-2">
          {tags.map((t) => {
            const m = TAG_META[t.color];
            return (
              <div
                key={t.physio_id}
                className={`flex items-center gap-3 rounded-xl border ${m.border} ${m.bg} p-3.5`}
              >
                <span className={`h-4 w-4 shrink-0 rounded-full ${m.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${m.text}`}>Estado: {m.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Asignado por {t.physio?.full_name || t.physio?.email || "tu fisio"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${c.color}`}>
              <c.icon className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
