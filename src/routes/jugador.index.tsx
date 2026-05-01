import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Calendar, MessageSquare, FileText, ClipboardList, Activity } from "lucide-react";

export const Route = createFileRoute("/jugador/")({
  component: PlayerHome,
});

const cards = [
  { to: "/jugador/citas", title: "Reservar cita", desc: "Agenda con tu fisio", icon: Calendar, color: "bg-primary/10 text-primary" },
  { to: "/jugador/mensajes", title: "Mensajes", desc: "Habla con tu fisio", icon: MessageSquare, color: "bg-accent/15 text-accent-foreground" },
  { to: "/jugador/documentos", title: "Documentos", desc: "Informes y planes", icon: FileText, color: "bg-primary/10 text-primary" },
  { to: "/jugador/formularios", title: "Formularios", desc: "Cuestionarios pendientes", icon: ClipboardList, color: "bg-accent/15 text-accent-foreground" },
  { to: "/jugador/historial", title: "Mi historial", desc: "Lesiones y progreso", icon: Activity, color: "bg-primary/10 text-primary" },
];

function PlayerHome() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "deportista";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Hola,</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">¿Qué quieres hacer hoy?</p>
      </div>

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
