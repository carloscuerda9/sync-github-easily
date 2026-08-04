import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { readPrefs } from "@/components/NotificationSettings";

export interface NotificationItem {
  id: string;
  kind: "message" | "appointment" | "form" | "document" | "invoice" | "treatment";
  title: string;
  body: string;
  href: string;
  created_at: string;
}

export interface Counters {
  messages: number;
  appointments: number; // pending requests (role-aware)
  documents: number;    // received in last 7d (proxy: created_at > last seen)
  invoices: number;     // sent unpaid (physio only)
  treatments: number;   // completed appointments without session (physio only)
}

interface Ctx {
  counters: Counters;
  total: number;
  recent: NotificationItem[];
  markAllSeen: () => void;
}

const NotificationsContext = createContext<Ctx | undefined>(undefined);

const EMPTY: Counters = { messages: 0, appointments: 0, documents: 0, invoices: 0, treatments: 0 };

const SEEN_KEY = "wfy:notif:lastSeen";

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [counters, setCounters] = useState<Counters>(EMPTY);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return new Date(0).toISOString();
    return localStorage.getItem(SEEN_KEY) ?? new Date(0).toISOString();
  });

  const isPlayer = profile?.role === "player";
  const isPhysio = profile?.role === "physio";

  const baseHref = isPlayer ? "/jugador" : "/fisio";

  const refresh = async () => {
    if (!profile) { setCounters(EMPTY); setRecent([]); return; }

    const prefs = readPrefs(profile.profile_data);
    const next: Counters = { ...EMPTY };
    const items: NotificationItem[] = [];

    // Messages: unread received
    if (prefs.messages) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, content, created_at, sender_id")
        .eq("receiver_id", profile.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      next.messages = msgs?.length ?? 0;
      msgs?.forEach((m) => items.push({
        id: `msg-${m.id}`,
        kind: "message",
        title: "Nuevo mensaje",
        body: (m.content ?? "").slice(0, 80),
        href: `${baseHref}/mensajes`,
        created_at: m.created_at,
      }));
    }

    // Appointments pending
    if (prefs.appointments) {
      if (isPlayer) {
        const { data } = await supabase
          .from("appointments")
          .select("id, scheduled_at, status, created_at")
          .eq("player_id", profile.id)
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(10);
        next.appointments = data?.length ?? 0;
        data?.forEach((a) => items.push({
          id: `apt-${a.id}`,
          kind: "appointment",
          title: "Cita en revisión",
          body: new Date(a.scheduled_at).toLocaleString("es-ES"),
          href: `${baseHref}/citas`,
          created_at: a.created_at,
        }));
      } else if (isPhysio) {
        const { data } = await supabase
          .from("appointments")
          .select("id, scheduled_at, status, created_at")
          .eq("physio_id", profile.id)
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(10);
        next.appointments = data?.length ?? 0;
        data?.forEach((a) => items.push({
          id: `apt-${a.id}`,
          kind: "appointment",
          title: "Nueva solicitud de cita",
          body: new Date(a.scheduled_at).toLocaleString("es-ES"),
          href: `${baseHref}/agenda`,
          created_at: a.created_at,
        }));
      }
    }


    // Documents received since lastSeen
    if (prefs.documents) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, title, created_at")
        .eq("recipient_id", profile.id)
        .gt("created_at", lastSeen)
        .order("created_at", { ascending: false })
        .limit(10);
      next.documents = docs?.length ?? 0;
      docs?.forEach((d) => items.push({
        id: `doc-${d.id}`,
        kind: "document",
        title: "Nuevo documento",
        body: d.title,
        href: `${baseHref}/documentos`,
        created_at: d.created_at,
      }));
    }

    // Invoices (physio: sent unpaid)
    if (prefs.invoices && isPhysio) {
      const { data } = await supabase
        .from("invoices")
        .select("id, amount, currency, status, issued_at")
        .eq("physio_id", profile.id)
        .eq("status", "sent")
        .order("issued_at", { ascending: false })
        .limit(10);
      next.invoices = data?.length ?? 0;
      data?.forEach((i) => items.push({
        id: `inv-${i.id}`,
        kind: "invoice",
        title: "Factura sin cobrar",
        body: `${i.amount} ${i.currency}`,
        href: `${baseHref}/facturacion`,
        created_at: i.issued_at,
      }));
    }

    // Treatments pending (physio): completed appointments without a session
    if (prefs.treatments && isPhysio) {
      const { data: completed } = await supabase
        .from("appointments")
        .select("id, scheduled_at, player_id, updated_at")
        .eq("physio_id", profile.id)
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(30);
      const ids = (completed ?? []).map((a) => a.id);
      let withSession = new Set<string>();
      if (ids.length) {
        const { data: sess } = await supabase
          .from("sessions")
          .select("appointment_id")
          .in("appointment_id", ids);
        withSession = new Set((sess ?? []).map((s: any) => s.appointment_id as string));
      }
      const pending = (completed ?? []).filter((a) => !withSession.has(a.id));
      next.treatments = pending.length;
      pending.slice(0, 10).forEach((a) => items.push({
        id: `treat-${a.id}`,
        kind: "treatment",
        title: "Rellena el tratamiento",
        body: new Date(a.scheduled_at).toLocaleString("es-ES"),
        href: `/fisio/historico`,
        created_at: a.updated_at ?? a.scheduled_at,
      }));
    }

    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setCounters(next);
    setRecent(items.slice(0, 15));
  };

  useEffect(() => {
    if (!profile) return;
    refresh();

    const channel = supabase
      .channel(`notif-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${profile.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: isPlayer ? `player_id=eq.${profile.id}` : `physio_id=eq.${profile.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `recipient_id=eq.${profile.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: isPhysio ? `physio_id=eq.${profile.id}` : `player_id=eq.${profile.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, JSON.stringify((profile?.profile_data as any)?.notifications ?? {})]);

  const total = counters.messages + counters.appointments + counters.documents + counters.invoices + counters.treatments;

  const markAllSeen = () => {
    const now = new Date().toISOString();
    setLastSeen(now);
    if (typeof window !== "undefined") localStorage.setItem(SEEN_KEY, now);
    setCounters((c) => ({ ...c, documents: 0 }));
  };

  const value = useMemo(() => ({ counters, total, recent, markAllSeen }), [counters, total, recent]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
