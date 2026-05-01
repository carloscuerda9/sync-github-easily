import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Plus, Euro, Send, CheckCircle2, FileDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/fisio/facturacion")({ component: PhysioInvoices });

type InvoiceStatus = "draft" | "sent" | "paid";

interface Player { id: string; full_name: string | null; email: string }
interface Appointment { id: string; scheduled_at: string; player_id: string }
interface Invoice {
  id: string;
  amount: number;
  currency: string;
  concept: string | null;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
  player_id: string;
  appointment_id: string | null;
  player?: { full_name: string | null; email: string } | null;
}

const STATUS_LABEL: Record<InvoiceStatus, string> = { draft: "Borrador", sent: "Enviada", paid: "Pagada" };
const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-green-500/10 text-green-700 dark:text-green-400",
};

function formatMoney(n: number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(n);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function PhysioInvoices() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // form
  const [playerId, setPlayerId] = useState("");
  const [appointmentId, setAppointmentId] = useState<string>("none");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [pRes, aRes, iRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("role", "player"),
      supabase.from("appointments").select("id, scheduled_at, player_id").eq("physio_id", user.id).order("scheduled_at", { ascending: false }),
      supabase.from("invoices").select("*, player:profiles!invoices_player_id_fkey(full_name, email)").eq("physio_id", user.id).order("issued_at", { ascending: false }),
    ]);
    setPlayers((pRes.data as Player[]) ?? []);
    setAppointments((aRes.data as Appointment[]) ?? []);
    // Fallback: load player names if join missing
    const inv = (iRes.data as Invoice[]) ?? [];
    if (inv.length && !inv[0].player) {
      const map = new Map((pRes.data as Player[] ?? []).map((p) => [p.id, p]));
      inv.forEach((i) => { i.player = map.get(i.player_id) ?? null; });
    }
    setInvoices(inv);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const playerAppointments = useMemo(
    () => appointments.filter((a) => a.player_id === playerId),
    [appointments, playerId],
  );

  const stats = useMemo(() => {
    const total = invoices.reduce((s, i) => s + Number(i.amount), 0);
    const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const pending = total - paid;
    return { total, paid, pending, count: invoices.length };
  }, [invoices]);

  const resetForm = () => {
    setPlayerId(""); setAppointmentId("none"); setAmount(""); setConcept("");
  };

  const handleCreate = async () => {
    if (!user || !playerId || !amount) {
      toast.error("Selecciona jugador e importe");
      return;
    }
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error("Importe inválido");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("invoices").insert({
      physio_id: user.id,
      player_id: playerId,
      appointment_id: appointmentId === "none" ? null : appointmentId,
      amount: numericAmount,
      currency: "EUR",
      concept: concept.trim() || null,
      status: "draft",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Factura creada");
    resetForm();
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    if (status !== "paid") patch.paid_at = null;
    const { error } = await supabase.from("invoices").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Factura marcada como ${STATUS_LABEL[status].toLowerCase()}`);
    load();
  };

  const filtered = (s: InvoiceStatus | "all") => s === "all" ? invoices : invoices.filter((i) => i.status === s);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
          <p className="text-muted-foreground">Gestiona tus facturas e ingresos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva factura</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear factura</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Jugador *</Label>
                <Select value={playerId} onValueChange={(v) => { setPlayerId(v); setAppointmentId("none"); }}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un jugador" /></SelectTrigger>
                  <SelectContent>
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cita asociada (opcional)</Label>
                <Select value={appointmentId} onValueChange={setAppointmentId} disabled={!playerId}>
                  <SelectTrigger><SelectValue placeholder="Sin cita asociada" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cita asociada</SelectItem>
                    {playerAppointments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{formatDate(a.scheduled_at)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Importe (EUR) *</Label>
                <Input type="number" step="0.01" min="0" placeholder="50.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Concepto</Label>
                <Textarea placeholder="Sesión de fisioterapia..." value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={500} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={submitting}>{submitting ? "Creando..." : "Crear"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Receipt className="h-5 w-5" />} label="Facturas" value={String(stats.count)} />
        <StatCard icon={<Euro className="h-5 w-5" />} label="Total emitido" value={formatMoney(stats.total)} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Cobrado" value={formatMoney(stats.paid)} />
        <StatCard icon={<Send className="h-5 w-5 text-primary" />} label="Pendiente" value={formatMoney(stats.pending)} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todas ({invoices.length})</TabsTrigger>
          <TabsTrigger value="draft">Borradores ({filtered("draft").length})</TabsTrigger>
          <TabsTrigger value="sent">Enviadas ({filtered("sent").length})</TabsTrigger>
          <TabsTrigger value="paid">Pagadas ({filtered("paid").length})</TabsTrigger>
        </TabsList>
        {(["all", "draft", "sent", "paid"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Cargando...</p>
            ) : filtered(tab).length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-card">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No hay facturas en esta categoría</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered(tab).map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} role="physio" onStatusChange={updateStatus} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">{icon}<span>{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export function InvoiceRow({
  invoice, role, onStatusChange,
}: {
  invoice: Invoice;
  role: "physio" | "player";
  onStatusChange: (id: string, status: InvoiceStatus) => void;
}) {
  return (
    <div className="border rounded-lg p-4 bg-card flex items-center justify-between gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold">{formatMoney(Number(invoice.amount), invoice.currency)}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[invoice.status]}`}>{STATUS_LABEL[invoice.status]}</span>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {role === "physio" ? (invoice.player?.full_name || invoice.player?.email || "—") : invoice.concept || "Sin concepto"}
        </p>
        {role === "physio" && invoice.concept && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{invoice.concept}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Emitida {formatDate(invoice.issued_at)}
          {invoice.paid_at && ` · Pagada ${formatDate(invoice.paid_at)}`}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {role === "physio" && invoice.status === "draft" && (
          <Button size="sm" variant="outline" onClick={() => onStatusChange(invoice.id, "sent")}>
            <Send className="h-3 w-3 mr-1" />Enviar
          </Button>
        )}
        {invoice.status !== "paid" && (
          <Button size="sm" onClick={() => onStatusChange(invoice.id, "paid")}>
            <CheckCircle2 className="h-3 w-3 mr-1" />Marcar pagada
          </Button>
        )}
        {role === "physio" && invoice.status === "paid" && (
          <Button size="sm" variant="outline" onClick={() => onStatusChange(invoice.id, "sent")}>
            Reabrir
          </Button>
        )}
      </div>
    </div>
  );
}
