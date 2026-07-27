import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface InvoiceFile {
  name: string;
  path: string;
  size: number;
  created_at: string;
  physioName: string;
  clubName: string;
}

const FOLDER = "facturas";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(name);
}
function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}
function displayName(name: string) {
  return name.replace(/^\d+-/, "");
}

function AdminInvoices() {
  const [files, setFiles] = useState<InvoiceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ file: InvoiceFile; url: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: physios, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, clubs:club_id(name)")
      .eq("role", "physio");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const all: InvoiceFile[] = [];
    for (const p of physios ?? []) {
      const prefix = `${p.id}/${FOLDER}`;
      const { data } = await supabase.storage
        .from("documents")
        .list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      for (const f of data ?? []) {
        if (!f.name || f.name.endsWith("/")) continue;
        all.push({
          name: f.name,
          path: `${prefix}/${f.name}`,
          size: (f.metadata as { size?: number } | null)?.size ?? 0,
          created_at: f.created_at ?? new Date().toISOString(),
          physioName: p.full_name || p.email,
          clubName: (p.clubs as { name?: string } | null)?.name ?? "Sin club",
        });
      }
    }
    all.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setFiles(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePreview = async (item: InvoiceFile) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(item.path, 300);
    if (error || !data) {
      toast.error(error?.message || "No se pudo abrir la factura");
      return;
    }
    setPreview({ file: item, url: data.signedUrl });
  };

  const term = search.trim().toLowerCase();
  const filtered = term
    ? files.filter(
        (f) =>
          displayName(f.name).toLowerCase().includes(term) ||
          f.physioName.toLowerCase().includes(term) ||
          f.clubName.toLowerCase().includes(term),
      )
    : files;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Todas las facturas</h1>
        <p className="text-muted-foreground">
          Facturas subidas por los fisioterapeutas. Solo visualización, sin descarga.
        </p>
      </div>

      <Input
        placeholder="Buscar por archivo, fisio o club..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-11 max-w-md"
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-card">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No hay facturas subidas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <div
              key={f.path}
              className="border rounded-lg p-4 bg-card flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {isImage(f.name) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{displayName(f.name)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {f.physioName} · {f.clubName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(f.created_at)} · {formatBytes(f.size)}
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
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">
              {preview ? displayName(preview.file.name) : ""}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div
              className="w-full"
              onContextMenu={(e) => e.preventDefault()}
            >
              {isImage(preview.file.name) ? (
                <img
                  src={preview.url}
                  alt={displayName(preview.file.name)}
                  className="w-full max-h-[70vh] object-contain rounded-md select-none pointer-events-none"
                  draggable={false}
                />
              ) : isPdf(preview.file.name) ? (
                <iframe
                  src={`${preview.url}#toolbar=0&navpanes=0`}
                  title={displayName(preview.file.name)}
                  className="w-full h-[70vh] rounded-md border"
                />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Este tipo de archivo no se puede previsualizar.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Vista de solo lectura · {preview.file.physioName} · {preview.file.clubName}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
