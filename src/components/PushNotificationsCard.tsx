import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Smartphone, BellRing, Apple, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  isPushSupported,
  isStandalone,
  isIos,
  isCurrentlySubscribed,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from "@/lib/push";

export function PushNotificationsCard() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const sup = isPushSupported();
    setSupported(sup);
    if (sup) {
      setPermission(Notification.permission);
      isCurrentlySubscribed().then(setSubscribed).catch(() => setSubscribed(false));
    }
    if (isIos() && !isStandalone()) setShowIosHelp(true);
  }, []);

  const handleToggle = async (value: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      if (value) {
        if (isIos() && !isStandalone()) {
          toast.error("En iPhone instala antes la app en la pantalla de inicio");
          setShowIosHelp(true);
          return;
        }
        await subscribeUserToPush(user.id);
        setSubscribed(true);
        setPermission(Notification.permission);
        toast.success("Notificaciones del navegador activadas");
      } else {
        await unsubscribeUserFromPush();
        setSubscribed(false);
        toast.success("Notificaciones del navegador desactivadas");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <CardTitle>Avisos en tu dispositivo</CardTitle>
        </div>
        <CardDescription>
          Recibe avisos en tu móvil u ordenador aunque no tengas la app abierta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Tu navegador actual no soporta notificaciones push. Prueba con Chrome, Edge, Firefox o Safari (iOS instalado en pantalla de inicio).</p>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <Label htmlFor="push-toggle" className="text-sm font-medium">
                  Notificaciones del sistema
                </Label>
                <p className="text-xs text-muted-foreground">
                  {permission === "denied"
                    ? "Permiso bloqueado en el navegador. Actívalo manualmente en los ajustes del sitio."
                    : "Activa para recibir avisos incluso con la app cerrada."}
                </p>
              </div>
            </div>
            <Switch
              id="push-toggle"
              checked={subscribed}
              disabled={busy || permission === "denied"}
              onCheckedChange={handleToggle}
            />
          </div>
        )}

        {showIosHelp && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Apple className="h-4 w-4" />
              Cómo activar avisos en iPhone / iPad
            </div>
            <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
              <li>Abre esta web en <strong>Safari</strong> (no en Chrome).</li>
              <li>Pulsa el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba).</li>
              <li>Selecciona <strong>"Añadir a pantalla de inicio"</strong>.</li>
              <li>Abre la app desde el icono nuevo de la pantalla de inicio.</li>
              <li>Vuelve aquí y pulsa el interruptor para activar las notificaciones.</li>
            </ol>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs"
              onClick={() => setShowIosHelp(false)}
            >
              Entendido
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
