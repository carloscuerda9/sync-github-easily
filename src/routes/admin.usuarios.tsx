import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteUser } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/usuarios")({
  component: UsersAdmin,
});

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

function UsersAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const removeUser = useServerFn(deleteUser);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,status,created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Error cargando usuarios"); return; }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) { toast.error("Error actualizando"); return; }
    toast.success(status === "approved" ? "Aprobado" : "Rechazado");
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await removeUser({ data: { userId: toDelete.id } });
      toast.success("Usuario eliminado");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error eliminando usuario");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Usuarios</h1>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay usuarios todavía.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.role}</span></td>
                  <td className="px-4 py-3">
                    <span className={
                      r.status === "approved" ? "rounded-full bg-success/15 px-2 py-0.5 text-xs text-success-foreground" :
                      r.status === "pending" ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900" :
                      "rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive"
                    }>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status !== "approved" && (
                      <Button size="sm" variant="outline" className="mr-2" onClick={() => updateStatus(r.id, "approved")}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprobar
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="outline" className="mr-2" onClick={() => updateStatus(r.id, "rejected")}>
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Rechazar
                      </Button>
                    )}
                    {r.role !== "superadmin" && (
                      <Button size="sm" variant="destructive" onClick={() => setToDelete(r)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la cuenta de{" "}
              <span className="font-semibold">{toDelete?.full_name ?? toDelete?.email}</span> y todos sus datos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
