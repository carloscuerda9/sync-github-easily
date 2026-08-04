import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ListSkeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Receipt, Eye, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/facturas")({ component: AdminInvoices });

const INVOICE_TYPES: Record<string, string> = {
  material: "Material",
  sesion_privada_fisio: "Sesión privada fisio",
  sesion_privada_medico: "Sesión privada médico",
  otro: "Otro",
};

interface InvoiceRow {
  id: string;
  invoice_type: string;
  amount: number;
  invoice_date: string;
  description: string;
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
  physio?: { full_name: string | null; email: string; club_id: string | null } | null;
  clubName?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(name);
}
function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

function AdminInvoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ item: InvoiceRow; url: string } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("physio_invoices")
      .select("*, physio:physio_id(full_name, email, club_id, clubs:club_id(name))")
      .eq("admin_id", user.id)
      .order("invoice_date", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const mapped = ((data as unknown as (InvoiceRow & {
      physio?: { clubs?: { name?: string } | null } | null;
    })[]) ?? []).map((r) => ({
      ...r,
      clubName: r.physio?.clubs?.name ?? "Sin club",
    }));
    setRows(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePreview = async (item: InvoiceRow) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(item.file_path, 300);
    if (error || !data) {
      toast.error(error?.message || "No se pudo abrir la factura");
      return;
    }
    setPreview({ item, url: data.signedUrl });
  };

  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((f) =>
        [
          f.file_name,
          f.description,
          INVOICE_TYPES[f.invoice_type] ?? f.invoice_type,
          f.physio?.full_name ?? "",
          f.physio?.email ?? "",
          f.clubName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : rows;

  const total = filtered.reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Facturas recibidas</h1>
        <p className="text-muted-foreground">
          Facturas que los fisioterapeutas te han enviado. Solo visualización, sin descarga.
        </p>
      </div>

      <Input
        placeholder="Buscar por tipo, descripción, fisio o club..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-11 max-w-md"
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No has recibido facturas</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} factura(s) · Total {total.toFixed(2)} €
          </p>
          <div className="space-y-2">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="border rounded-lg p-4 bg-card flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    {isImage(f.file_name) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {INVOICE_TYPES[f.invoice_type] ?? f.invoice_type} · {Number(f.amount).toFixed(2)} €
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{f.description}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDate(f.invoice_date)} · {f.physio?.full_name || f.physio?.email} · {f.clubName} ·{" "}
                      {formatBytes(f.file_size)}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-11" onClick={() => handlePreview(f)}>
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview ? preview.item.file_name : ""}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="w-full" onContextMenu={(e) => e.preventDefault()}>
              {isImage(preview.item.file_name) ? (
                <img
                  src={preview.url}
                  alt={preview.item.file_name}
                  className="w-full max-h-[70vh] object-contain rounded-md select-none pointer-events-none"
                  draggable={false}
                />
              ) : isPdf(preview.item.file_name) ? (
                <iframe
                  src={`${preview.url}#toolbar=0&navpanes=0`}
                  title={preview.item.file_name}
                  className="w-full h-[70vh] rounded-md border"
                />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Este tipo de archivo no se puede previsualizar.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Vista de solo lectura · {INVOICE_TYPES[preview.item.invoice_type] ?? preview.item.invoice_type} ·{" "}
                {Number(preview.item.amount).toFixed(2)} € · {preview.item.physio?.full_name || preview.item.physio?.email} ·{" "}
                {preview.item.clubName}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
