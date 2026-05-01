import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Calendar, Users, MessageSquare, FileText, Receipt } from "lucide-react";

export const Route = createFileRoute("/fisio/")({
  component: PhysioHome,
});

const cards = [
  { to: "/fisio/agenda", title: "Agenda", desc: "Citas y calendario", icon: Calendar },
  { to: "/fisio/jugadores", title: "Mis jugadores", desc: "Pacientes y fichas", icon: Users },
  { to: "/fisio/mensajes", title: "Mensajes", desc: "Chat con jugadores", icon: MessageSquare },
  { to: "/fisio/documentos", title: "Documentos", desc: "Compartir informes", icon: FileText },
  { to: "/fisio/formularios", title: "Formularios", desc: "Crear y asignar", icon: FileText },
  { to: "/fisio/facturacion", title: "Facturación", desc: "Facturas y resumen", icon: Receipt },
];

function PhysioHome() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "fisio";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Hola,</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tu panel de gestión.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
