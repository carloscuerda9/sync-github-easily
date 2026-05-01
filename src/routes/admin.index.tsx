import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, Receipt, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [stats, setStats] = useState({ users: 0, pending: 0, appointments: 0, invoices: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("appointments").select("*", { count: "exact", head: true }),
      supabase.from("invoices").select("*", { count: "exact", head: true }),
    ]).then(([u, p, a, i]) => {
      setStats({
        users: u.count ?? 0,
        pending: p.count ?? 0,
        appointments: a.count ?? 0,
        invoices: i.count ?? 0,
      });
    });
  }, []);

  const cards = [
    { label: "Usuarios totales", value: stats.users, icon: Users },
    { label: "Pendientes de aprobar", value: stats.pending, icon: Clock, accent: true },
    { label: "Citas registradas", value: stats.appointments, icon: Calendar },
    { label: "Facturas emitidas", value: stats.invoices, icon: Receipt },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Panel superadmin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Resumen general de We Fix You.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <c.icon className={`h-4 w-4 ${c.accent ? "text-accent-foreground" : "text-muted-foreground"}`} />
            </div>
            <div className="mt-2 text-3xl font-extrabold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
