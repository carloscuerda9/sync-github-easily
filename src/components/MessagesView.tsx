import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessagesSquare, ArrowLeft, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  full_name: string | null;
  email: string;
  unread: number;
  last_at: string | null;
}

interface Msg {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface Props {
  /** role we're chatting WITH (the other side) */
  contactRole: "physio" | "player";
  emptyTitle: string;
  emptyDesc: string;
}

export function MessagesView({ contactRole, emptyTitle, emptyDesc }: Props) {
  const { user, club } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load contacts (everyone in the club with the opposite role) + unread counts
  const loadContacts = async () => {
    if (!user) return;
    setLoadingContacts(true);
    const { data: profs, error } = await supabase
      .from("profiles")
      .select("id,full_name,email")
      .eq("role", contactRole)
      .eq("status", "approved");
    if (error) { toast.error("Error cargando contactos"); setLoadingContacts(false); return; }

    const list = (profs ?? []).filter((p) => p.id !== user.id) as Omit<Contact, "unread" | "last_at">[];

    // unread counts + last message timestamp per contact (single query each)
    const ids = list.map((c) => c.id);
    let unreadMap = new Map<string, number>();
    let lastMap = new Map<string, string>();
    if (ids.length) {
      const { data: incoming } = await supabase
        .from("messages")
        .select("sender_id,read,created_at")
        .eq("receiver_id", user.id)
        .in("sender_id", ids);
      (incoming ?? []).forEach((m) => {
        if (!m.read) unreadMap.set(m.sender_id, (unreadMap.get(m.sender_id) ?? 0) + 1);
        const prev = lastMap.get(m.sender_id);
        if (!prev || m.created_at > prev) lastMap.set(m.sender_id, m.created_at);
      });
      const { data: outgoing } = await supabase
        .from("messages")
        .select("receiver_id,created_at")
        .eq("sender_id", user.id)
        .in("receiver_id", ids);
      (outgoing ?? []).forEach((m) => {
        const prev = lastMap.get(m.receiver_id);
        if (!prev || m.created_at > prev) lastMap.set(m.receiver_id, m.created_at);
      });
    }

    const enriched: Contact[] = list.map((c) => ({
      ...c,
      unread: unreadMap.get(c.id) ?? 0,
      last_at: lastMap.get(c.id) ?? null,
    })).sort((a, b) => {
      if (b.unread !== a.unread) return b.unread - a.unread;
      return (b.last_at ?? "").localeCompare(a.last_at ?? "");
    });

    setContacts(enriched);
    setLoadingContacts(false);
  };

  const loadMessages = async (otherId: string) => {
    if (!user) return;
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from("messages")
      .select("id,sender_id,receiver_id,content,read,created_at")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    if (error) toast.error("Error cargando mensajes");
    setMessages((data ?? []) as Msg[]);
    setLoadingMsgs(false);

    // mark received as read
    await supabase.from("messages").update({ read: true })
      .eq("receiver_id", user.id).eq("sender_id", otherId).eq("read", false);
    // refresh unread badges
    setContacts((cs) => cs.map((c) => c.id === otherId ? { ...c, unread: 0 } : c));
  };

  useEffect(() => { loadContacts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  useEffect(() => {
    if (active) loadMessages(active);
    else setMessages([]);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [active]);

  // Realtime: listen to all messages where I am sender or receiver
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as Msg;
          if (active && (m.sender_id === active)) {
            setMessages((prev) => [...prev, m]);
            // mark read immediately since chat is open
            supabase.from("messages").update({ read: true }).eq("id", m.id);
          } else {
            setContacts((cs) => cs.map((c) => c.id === m.sender_id ? { ...c, unread: c.unread + 1, last_at: m.created_at } : c));
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` },
        (payload) => {
          const m = payload.new as Msg;
          if (active && m.receiver_id === active) {
            setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, active]);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!user || !active) return;
    const content = text.trim();
    if (!content) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id, receiver_id: active, content,
    });
    setSending(false);
    if (error) return toast.error("No se pudo enviar", { description: error.message });
    setText("");
  };

  const activeContact = useMemo(() => contacts.find((c) => c.id === active) ?? null, [contacts, active]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Mensajes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conversaciones dentro de {club?.name ?? "tu club"}.</p>
      </div>

      <div className="grid h-[calc(100vh-220px)] grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[280px_1fr]">
        {/* Contact list */}
        <aside className={cn(
          "flex flex-col border-r border-border",
          active && "hidden md:flex",
        )}>
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Contactos</div>
          <div className="flex-1 overflow-y-auto">
            {loadingContacts ? (
              <div className="space-y-2 p-3">{[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />)}</div>
            ) : contacts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">{emptyDesc}</div>
            ) : contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                  active === c.id && "bg-primary/5",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.full_name || c.email}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.email}</div>
                </div>
                {c.unread > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Chat */}
        <section className={cn("flex flex-col", !active && "hidden md:flex")}>
          {!activeContact ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MessagesSquare className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-semibold">{emptyTitle}</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">{emptyDesc}</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActive(null)} aria-label="Volver">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{activeContact.full_name || activeContact.email}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{activeContact.email}</div>
                </div>
              </header>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/20 px-4 py-4">
                {loadingMsgs ? (
                  <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />)}</div>
                ) : messages.length === 0 ? (
                  <p className="py-10 text-center text-xs text-muted-foreground">Aún no hay mensajes. ¡Envía el primero!</p>
                ) : messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                        mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm",
                      )}>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <div className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {new Date(m.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); send(); }}
                className="flex items-center gap-2 border-t border-border bg-background px-3 py-2.5"
              >
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  disabled={sending}
                />
                <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Enviar">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
