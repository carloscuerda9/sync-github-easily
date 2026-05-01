import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, MessageSquare, Calendar, ClipboardList, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";

export interface NotificationPrefs {
  messages: boolean;
  appointments: boolean;
  forms: boolean;
  documents: boolean;
  invoices: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  messages: true,
  appointments: true,
  forms: true,
  documents: true,
  invoices: true,
};

export function readPrefs(profileData: Record<string, unknown> | null | undefined): NotificationPrefs {
  const raw = (profileData?.notifications ?? {}) as Partial<NotificationPrefs>;
  return { ...DEFAULT_NOTIFICATION_PREFS, ...raw };
}

const ITEMS: Array<{ key: keyof NotificationPrefs; label: string; desc: string; icon: typeof Bell; rolesOnly?: "player" | "physio" }> = [
  { key: "messages", label: "Nuevos mensajes", desc: "Te avisamos cuando recibas un mensaje.", icon: MessageSquare },
  { key: "appointments", label: "Citas", desc: "Confirmaciones y nuevas solicitudes de cita.", icon: Calendar },
  { key: "forms", label: "Formularios", desc: "Cuando te asignen un cuestionario nuevo.", icon: ClipboardList, rolesOnly: "player" },
  { key: "documents", label: "Documentos", desc: "Cuando recibas un documento nuevo.", icon: FileText },
  { key: "invoices", label: "Facturación", desc: "Facturas emitidas o pendientes de cobro.", icon: Receipt },
];

export function NotificationSettings() {
  const { profile, refreshProfile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readPrefs(profile?.profile_data));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs(profile?.profile_data));
    setDirty(false);
  }, [profile?.id]);

  const toggle = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const nextData = { ...(profile.profile_data ?? {}), notifications: { ...prefs } } as Record<string, unknown>;
    const { error } = await supabase
      .from("profiles")
      .update({ profile_data: nextData as never })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudieron guardar las preferencias");
      return;
    }
    toast.success("Preferencias guardadas");
    setDirty(false);
    await refreshProfile();
  };

  const visible = ITEMS.filter((it) => !it.rolesOnly || it.rolesOnly === profile?.role);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Notificaciones</CardTitle>
        </div>
        <CardDescription>Elige qué tipo de avisos quieres recibir dentro de la app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {visible.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <Label htmlFor={`notif-${it.key}`} className="text-sm font-medium">
                    {it.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{it.desc}</p>
                </div>
              </div>
              <Switch
                id={`notif-${it.key}`}
                checked={prefs[it.key]}
                onCheckedChange={(v) => toggle(it.key, v)}
              />
            </div>
          );
        })}
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
