import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o ha sido movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "We Fix You — Fisioterapia" },
      { name: "description", content: "Plataforma de gestión para fisioterapeutas y deportistas. Reserva citas, controla tu historial y comunícate con tu fisio." },
      { name: "theme-color", content: "#0066FF" },
      { property: "og:title", content: "We Fix You — Fisioterapia" },
      { property: "og:description", content: "Plataforma de gestión para fisioterapeutas y deportistas. Reserva citas, controla tu historial y comunícate con tu fisio." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "We Fix You — Fisioterapia" },
      { name: "twitter:description", content: "Plataforma de gestión para fisioterapeutas y deportistas. Reserva citas, controla tu historial y comunícate con tu fisio." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9b3d5868-098d-40ce-8b6f-33643841e626/id-preview-6d9b7e1d--94187a79-5af4-4d12-ab76-59e4093a263b.lovable.app-1777638725135.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9b3d5868-098d-40ce-8b6f-33643841e626/id-preview-6d9b7e1d--94187a79-5af4-4d12-ab76-59e4093a263b.lovable.app-1777638725135.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
      </NotificationsProvider>
    </AuthProvider>
  );
}
