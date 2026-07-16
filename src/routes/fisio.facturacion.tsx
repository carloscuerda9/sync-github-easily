import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ListSkeleton";
import { Receipt, Upload, Download, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/fisio/facturacion")({ component: PhysioInvoices });

interface FileItem {
  name: string;
  path: string;
  size: number;
  created_at: string;
}

const FOLDER = "facturas";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(name);
}
function displayName(name: string) {
  // strip leading timestamp prefix "1700000000000-"
  return name.replace(/^\d+-/, "");
}

function PhysioInvoices() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const prefix = `${user.id}/${FOLDER}`;
    const { data, error } = await supabase.storage
      .from("documents")
      .list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const items: FileItem[] = (data ?? [])
      .filter((f) => f.name && !f.name.endsWith("/"))
      .map((f) => ({
        name: f.name,
        path: `${prefix}/${f.name}`,
        size: (f.metadata as { size?: number } | null)?.size ?? 0,
        created_at: f.created_at ?? new Date().toISOString(),
      }));
    setFiles(items);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (list: FileList | null) => {
    if (!list || !list.length || !user) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(list)) {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${FOLDER}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) toast.error(`${file.name}: ${error.message}`);
      else ok++;
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (ok) toast.success(`${ok} archivo(s) subido(s)`);
    load();
  };

  const handleDownload = async (item: FileItem) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(item.path, 60);
    if (error || !data) { toast.error(error?.message || "Error"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`¿Eliminar ${displayName(item.name)}?`)) return;
    const { error } = await supabase.storage.from("documents").remove([item.path]);
    if (error) { toast.error(error.message); return; }
    toast.success("Archivo eliminado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturas</h1>
          <p className="text-muted-foreground">Sube y guarda tus facturas (PDF, imágenes, documentos)</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Subiendo..." : "Subir factura"}
          </Button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : files.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Aún no has subido ninguna factura</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.path} className="border rounded-lg p-4 bg-card flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {isImage(f.name) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{displayName(f.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(f.created_at)} · {formatBytes(f.size)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleDownload(f)}>
                  <Download className="h-3 w-3 mr-1" />Ver
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(f)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
