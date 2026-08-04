import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListSkeleton } from "@/components/ListSkeleton";
import { Receipt, Upload, Download, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/fisio/facturacion")({ component: PhysioInvoices });

const FOLDER = "facturas";

export const INVOICE_TYPES = [
  { value: "material", label: "Material" },
  { value: "sesion_privada_fisio", label: "Sesión privada fisio" },
  { value: "sesion_privada_medico", label: "Sesión privada médico" },
  { value: "otro", label: "Otro" },
] as const;

type InvoiceType = (typeof INVOICE_TYPES)[number]["value"];

interface InvoiceRow {
  id: string;
  invoice_type: InvoiceType;
  amount: number;
  invoice_date: string;
  description: string;
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
  admin_id: string;
  admin?: { full_name: string | null; email: string } | null;
}

interface AdminOption {
  id: string;
  full_name: string | null;
  email: string;
}

function typeLabel(t: string) {
  return INVOICE_TYPES.find((i) => i.value === t)?.label ?? t;
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

function PhysioInvoices() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<InvoiceType | "">("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [adminId, setAdminId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data, error }, { data: adminData }] = await Promise.all([
      supabase
        .from("physio_invoices")
        .select("*, admin:admin_id(full_name, email)")
        .eq("physio_id", user.id)
        .order("invoice_date", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "superadmin")
        .eq("status", "approved")
        .order("full_name"),
    ]);
    if (error) toast.error(error.message);
    setRows((data as unknown as InvoiceRow[]) ?? []);
    setAdmins((adminData as AdminOption[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setType("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setAdminId("");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!type) return toast.error("Selecciona el tipo de factura");
    const total = Number(amount.replace(",", "."));
    if (!amount || Number.isNaN(total) || total < 0) return toast.error("Introduce un total válido");
    if (!date) return toast.error("Selecciona el día");
    if (description.trim().length < 3) return toast.error("Añade una breve descripción del gasto");
    if (description.trim().length > 500) return toast.error("La descripción es demasiado larga");
    if (!adminId) return toast.error("Selecciona el administrador destinatario");
    if (!file) return toast.error("Adjunta el archivo de la factura");

    setSaving(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/${FOLDER}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) {
      setSaving(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase.from("physio_invoices").insert({
      physio_id: user.id,
      admin_id: adminId,
      invoice_type: type,
      amount: total,
      invoice_date: date,
      description: description.trim(),
      file_path: path,
      file_name: safe,
      file_size: file.size,
    });
    setSaving(false);
    if (error) {
      await supabase.storage.from("documents").remove([path]);
      toast.error(error.message);
      return;
    }
    toast.success("Factura registrada");
    setOpen(false);
    resetForm();
    load();
  };

  const handleView = async (item: InvoiceRow) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(item.file_path, 60);
    if (error || !data) {
      toast.error(error?.message || "Error");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (item: InvoiceRow) => {
    if (!confirm(`¿Eliminar la factura ${item.file_name}?`)) return;
    const { error } = await supabase.from("physio_invoices").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from("documents").remove([item.file_path]);
    toast.success("Factura eliminada");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturas</h1>
          <p className="text-muted-foreground">
            Registra tus facturas con su importe y envíalas al administrador que corresponda
          </p>
        </div>
        <Button className="h-11" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Subir factura
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Aún no has subido ninguna factura</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((f) => (
            <div key={f.id} className="border rounded-lg p-4 bg-card flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {isImage(f.file_name) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {typeLabel(f.invoice_type)} · {Number(f.amount).toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{f.description}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatDate(f.invoice_date)} · {formatBytes(f.file_size)} · Para:{" "}
                    {f.admin?.full_name || f.admin?.email || "Administrador"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-11" onClick={() => handleView(f)}>
                  <Download className="h-3 w-3 mr-1" />
                  Ver
                </Button>
                <Button size="sm" variant="outline" className="h-11" onClick={() => handleDelete(f)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva factura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de factura</Label>
              <Select value={type} onValueChange={(v) => setType(v as InvoiceType)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Total a facturar (€)</Label>
                <Input
                  className="h-11"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Día</Label>
                <Input className="h-11" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Razón del gasto</Label>
              <Textarea
                value={description}
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descripción del gasto"
              />
            </div>

            <div className="space-y-2">
              <Label>Administrador destinatario</Label>
              <Select value={adminId} onValueChange={setAdminId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecciona el administrador" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name || a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {admins.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay administradores disponibles.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Archivo (foto, PDF o documento)</Label>
              <Input
                ref={inputRef}
                className="h-11"
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button className="w-full h-11" onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar factura"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
