import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Receipt, Euro, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jugador/facturas")({ component: PlayerInvoices });

type InvoiceStatus = "draft" | "sent" | "paid";

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  concept: string | null;
  status: InvoiceStatus;
  issued_at: string;
  paid_at: string | null;
  physio_id: string;
  physio?: { full_name: string | null; email: string } | null;
}

const STATUS_LABEL: Record<InvoiceStatus, string> = { draft: "Borrador", sent: "Pendiente", paid: "Pagada" };
const STATUS_COLOR: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  paid: "bg-green-500/10 text-green-700 dark:text-green-400",
};

const formatMoney = (n: number, c = "EUR") => new Intl.NumberFormat("es-ES", { style: "currency", currency: c }).format(n);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

function PlayerInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // Players only see invoices once they are sent or paid (not drafts that physio hasn't sent)
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("player_id", user.id)
      .in("status", ["sent", "paid"])
      .order("issued_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const inv = (data as Invoice[]) ?? [];
    const physioIds = [...new Set(inv.map((i) => i.physio_id))];
    if (physioIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name, email").in("id", physioIds);
      const map = new Map(((ps as { id: string; full_name: string | null; email: string }[]) ?? []).map((p) => [p.id, p]));
      inv.forEach((i) => { i.physio = map.get(i.physio_id) ?? null; });
    }
    setInvoices(inv);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const stats = useMemo(() => {
    const pending = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + Number(i.amount), 0);
    const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    return { pending, paid };
  }, [invoices]);

  const markPaid = async (id: string) => {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Factura marcada como pagada");
    load();
  };

  const filtered = (s: "all" | "sent" | "paid") => s === "all" ? invoices : invoices.filter((i) => i.status === s);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis facturas</h1>
        <p className="text-muted-foreground">Consulta tus facturas y pagos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Euro className="h-5 w-5" />Pendiente de pago</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatMoney(stats.pending)}</div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><CheckCircle2 className="h-5 w-5" />Pagado</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatMoney(stats.paid)}</div>
        </div>
      </div>

      <Tabs defaultValue="sent">
        <TabsList>
          <TabsTrigger value="sent">Pendientes ({filtered("sent").length})</TabsTrigger>
          <TabsTrigger value="paid">Pagadas ({filtered("paid").length})</TabsTrigger>
          <TabsTrigger value="all">Todas ({invoices.length})</TabsTrigger>
        </TabsList>
        {(["sent", "paid", "all"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Cargando...</p>
            ) : filtered(tab).length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-card">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No hay facturas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered(tab).map((inv) => (
                  <div key={inv.id} className="border rounded-lg p-4 bg-card flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-lg">{formatMoney(Number(inv.amount), inv.currency)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                      </div>
                      <p className="text-sm">{inv.concept || "Sin concepto"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        De {inv.physio?.full_name || inv.physio?.email || "—"} · {formatDate(inv.issued_at)}
                        {inv.paid_at && ` · Pagada ${formatDate(inv.paid_at)}`}
                      </p>
                    </div>
                    {inv.status === "sent" && (
                      <Button size="sm" onClick={() => markPaid(inv.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />Marcar pagada
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
