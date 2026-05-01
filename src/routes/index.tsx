import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Activity, Calendar, MessageSquare, FileText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role === "superadmin") navigate({ to: "/admin" });
    else if (profile.role === "physio") navigate({ to: "/fisio" });
    else navigate({ to: "/jugador" });
  }, [profile, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/login">Entrar</Link></Button>
          <Button asChild size="sm"><Link to="/registro">Registrarse</Link></Button>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Fisioterapia deportiva
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
              Te lesionas. <span className="text-primary">Te arreglamos.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              La plataforma todo-en-uno para deportistas y fisioterapeutas. Reserva citas,
              controla tu historial de lesiones y comunícate directamente con tu fisio.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/registro">Empezar gratis</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link to="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { icon: Calendar, title: "Reserva citas", desc: "Agenda con tu fisio en segundos." },
              { icon: MessageSquare, title: "Mensajería", desc: "Habla directamente con tu fisio." },
              { icon: Activity, title: "Tu historial", desc: "Lesiones, sesiones y progreso en un solo sitio." },
              { icon: FileText, title: "Documentos", desc: "Informes, planes de ejercicios y formularios." },
              { icon: ShieldCheck, title: "Privado y seguro", desc: "Tus datos médicos protegidos." },
              { icon: Activity, title: "Para fisios", desc: "Agenda, jugadores, facturas y formularios." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
                <f.icon className="mb-3 h-6 w-6 text-primary" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <Logo compact />
          <p>© {new Date().getFullYear()} We Fix You. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
