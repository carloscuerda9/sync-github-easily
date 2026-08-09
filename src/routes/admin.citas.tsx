import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListSkeleton } from "@/components/ListSkeleton";
import { formatDateTime, TYPE_LABEL, type AppointmentType } from "@/lib/appointments";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/citas")({ component: AdminCitas });

interface Row {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: AppointmentType;
  status: string;
  notes: string | null;
  player: { full_name: string | null; email: string } | null;
  physio: { full_name: string | null; email: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  requested: "Solicitada",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  rejected: "Rechazada",
};

function AdminCitas() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,scheduled_at,duration_minutes,type,status,notes,player:profiles!appointments_player_id_fkey(full_name,email),physio:profiles!appointments_physio_id_fkey(full_name,email)")
        .order("scheduled_at", { ascending: false });
      setLoading(false);
      if (error) { toast.error("Error cargando citas"); return; }
      setRows((data ?? []) as unknown as Row[]);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Todas las citas</h1>
      {loading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay citas registradas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Fisio</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{formatDateTime(r.scheduled_at)}</td>
                    <td className="px-4 py-3">{r.player?.full_name ?? r.player?.email ?? "—"}</td>
                    <td className="px-4 py-3">{r.physio?.full_name ?? r.physio?.email ?? "—"}</td>
                    <td className="px-4 py-3">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
