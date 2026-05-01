import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

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
                      <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "rejected")}>
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Rechazar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
